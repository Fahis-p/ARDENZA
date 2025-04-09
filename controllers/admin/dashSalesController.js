const Order = require("../../models/orderSchema")
const PDFDocument = require('pdfkit-table')
const ExcelJS = require('exceljs');

const loadReportpage = (req,res)=>{
    try {
            
        res.render("dashSales")

    } catch (error) {
        res.redirect("/pageerror")
        
    }
}

const salesReportData = async (req,res)=>{
    try {

        
        const { startDate, endDate, period } = req.query;
        console.log("check point  3",startDate, endDate, period )

        // Validate dates
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Start and end dates are required' });
        }

        // Convert dates to proper format
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999); 

        // Build the query
        const query = {
            createdOn: {
                $gte: start,
                $lte: end
            }
        };

        // Fetch orders with user details
        let orders = await Order.find(query)
            .populate({
                path: 'userId',
                select: 'name'
            })
            .sort({ createdOn: -1 }); 

        
            let allowedStatuses = ["delivered", "processing", "shipped", "Rejected"];

            orders = orders.filter(order =>
              allowedStatuses.includes(order.status)
            );

            console.log("orders", orders)

        
        let totalOrders = orders.length;
        let totalDiscount = 0;
        let totalSales = 0;

        orders.forEach(order => {

        totalDiscount += order.discount || 0; 
        totalSales += order.finalAmount || 0;

        })

        let summary = {
          totalOrders,
          totalDiscount,
          totalSales
        }

        // Format the response
        
        const formattedOrders = orders.map(order => ({
          
            _id: order.orderId,
            date: order.createdOn,
            customerName: order.userId?.name || 'Guest',
            status: order.status,
            discountAmount: order.discount,
            finalAmount: order.finalAmount
        }));
        

        res.json({
            success: true,
            orders: formattedOrders,
            summary
        });

    } catch (error) {
        console.error('Error fetching sales report data:', error);
        res.status(500).json({ 
            success: false,
            error: 'Failed to fetch sales report data' 
        });
    }
}
async function getFormattedOrders(startDate, endDate) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
  
    let orders = await Order.find({
      createdOn: { $gte: start, $lte: end }
    })
    .populate('userId', 'name')
    .sort({ createdOn: -1 });

    let allowedStatuses = ["delivered", "processing", "shipped", "Rejected"];

            orders = orders.filter(order =>
              allowedStatuses.includes(order.status)
            );

  
    return orders.map(order => ({
      orderId: order.orderId,
      date: order.createdOn,
      customerName: order.userId?.name || 'Guest',
      status: order.status,
      discountAmount: order.discount,
      finalAmount: order.finalAmount,
      currentAmount: order.currentAmount
    }));
  }

  const salesReportPdf = async (req,res)=>{
    try {
    const { startDate, endDate } = req.query;
    const orders = await getFormattedOrders(startDate, endDate);
    
    
    const totalOrders = orders.length;
    const totalSales = orders.reduce((sum, order) => sum + order.currentAmount, 0);
    const totalDiscount = orders.reduce((sum, order) => sum + order.discountAmount, 0);

    const doc = new PDFDocument({ margin: 30, size: 'A4' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');

    
    doc.font('Helvetica-Bold')
       .fontSize(20)
       .fillColor('#333333')
       .text('ARDENZA', { align: 'center' });
    doc.moveDown(0.5);

    // Report Title
    doc.font('Helvetica-Bold')
       .fontSize(18)
       .text('Sales Report', { align: 'center' });
    
    doc.moveDown(0.5);
    doc.font('Helvetica')
       .fontSize(12)
       .text(`From ${startDate} to ${endDate}`, { align: 'center' });
    doc.moveDown(2);

    
    const summaryWidth = 500;
    const summaryX = (doc.page.width - summaryWidth) / 2;
    
    doc.lineWidth(1)
       .strokeColor('#CCCCCC')
       .roundedRect(summaryX, 150, summaryWidth, 80, 8)
       .stroke()
       .fillColor('#F8F8F8')
       .roundedRect(summaryX, 150, summaryWidth, 80, 8)
       .fill();

    doc.font('Helvetica-Bold')
       .fontSize(14)
       .fillColor('#333333')
       .text('SUMMARY', summaryX + 20, 170);

    // Summary Content
    doc.font('Helvetica')
       .fontSize(12)
       .fillColor('#555555')
       .text(`Total Orders: ${totalOrders}`, summaryX + 20, 195)
       .text(`Total Sales: Rs ${totalSales.toLocaleString()}`, summaryX + 250, 195)
       .text(`Total Discount: Rs ${totalDiscount.toLocaleString()}`, summaryX + 20, 215)
       

    doc.moveDown(3);
    doc.x = 30

    
    const table = {
      headers: [
        { label: 'Order ID', property: 'orderId', width: 120 },
        { label: 'Date', property: 'date', width: 80 },
        { label: 'Customer', property: 'customerName', width: 100 },
        { label: 'Status', property: 'status', width: 80 },
        { label: 'Discount', property: 'discount', width: 80, align: 'center' },
        { label: 'Amount', property: 'amount', width: 80, align: 'center' }
      ],
      datas: orders.map(order => ({
        orderId: order.orderId,
        date: order.date.toLocaleDateString(),
        customerName: order.customerName,
        status: order.status,
        discount: `Rs ${order.discountAmount.toLocaleString()}`,
        amount: `Rs ${order.finalAmount.toLocaleString()}`
      })),
      options: {
        striped: true,
        stripedColors: ['#f5f5f5', '#ffffff'],
        padding: 5,
        headerPadding: 5,
        columnSpacing: 10,
        margin: { 
          top: 0, 
          left: (doc.page.width - 540) / 2, 
          right: 0, 
          bottom: 0 
        }
      }
    };

    
    await doc.table(table, {
      prepareHeader: () => doc.font('Helvetica-Bold').fontSize(12),
      prepareRow: () => doc.font('Helvetica').fontSize(10)
    });

    doc.pipe(res);
    doc.end();

  } catch (error) {
    console.error('PDF generation error:', error);
    res.status(500).send('Error generating PDF report');
  }
  }

  const salesReportExcel = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const orders = await getFormattedOrders(startDate, endDate);
        
        
        const totalOrders = orders.length;
        const totalSales = orders.reduce((sum, order) => sum + order.finalAmount, 0);
        const totalDiscount = orders.reduce((sum, order) => sum + order.discountAmount, 0);
    
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');
    
        
        worksheet.mergeCells('A1:F1');
        worksheet.getCell('A1').value = 'ARDENZA';
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        worksheet.getCell('A1').alignment = { horizontal: 'center' };
    
        
        worksheet.mergeCells('A2:F2');
        worksheet.getCell('A2').value = 'Sales Report';
        worksheet.getCell('A2').font = { bold: true, size: 14 };
        worksheet.getCell('A2').alignment = { horizontal: 'center' };
    
        
        worksheet.mergeCells('A3:F3');
        worksheet.getCell('A3').value = `From ${startDate} to ${endDate}`;
        worksheet.getCell('A3').alignment = { horizontal: 'center' };
        worksheet.getCell('A3').font = { size: 12 };
    
        
        worksheet.addRow([]);
    
        
        worksheet.mergeCells('A5:C5');
        worksheet.getCell('A5').value = 'SUMMARY';
        worksheet.getCell('A5').font = { bold: true, size: 12 };
        
        
        worksheet.getCell('A6').value = 'Total Orders';
        worksheet.getCell('B6').value = 'Total Sales';
        worksheet.getCell('C6').value = 'Total Discount';
        ['A6', 'B6', 'C6'].forEach(cell => {
          worksheet.getCell(cell).font = { bold: true };
          worksheet.getCell(cell).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
          };
          worksheet.getCell(cell).alignment = { horizontal: 'center' };
        });
    
        
        worksheet.getCell('A7').value = totalOrders;
        worksheet.getCell('B7').value = totalSales;
        worksheet.getCell('C7').value = totalDiscount;
        ['B7', 'C7'].forEach(cell => {
          worksheet.getCell(cell).numFmt = '"Rs" #,##0.00';
        });
    
        
        worksheet.addRow([]);
    
        
        worksheet.mergeCells('A9:F9');
        worksheet.getCell('A9').value = 'ORDERS LIST';
        worksheet.getCell('A9').font = { bold: true, size: 12 };
        worksheet.getCell('A9').alignment = { horizontal: 'center' };
    
        
        const columnHeaders = [
          'Order ID',
          'Date',
          'Customer',
          'Status',
          'Discount (Rs)',
          'Amount (Rs)'
        ];
        
        worksheet.addRow(columnHeaders); 
    
        
        worksheet.getRow(10).eachCell((cell, colNumber) => {
          cell.font = { bold: true };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFD3D3D3' }
          };
          cell.alignment = { horizontal: 'center' };
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        });
    
        
        orders.forEach(order => {
          worksheet.addRow([
            order.orderId,
            order.date,
            order.customerName,
            order.status,
            order.discountAmount,
            order.finalAmount
          ]);
        });
    
        
        const lastRow = worksheet.rowCount;
        for (let i = 11; i <= lastRow; i++) {
          worksheet.getCell(`E${i}`).numFmt = '"Rs" #,##0.00';
          worksheet.getCell(`F${i}`).numFmt = '"Rs" #,##0.00';
        }
    
        
        for (let i = 11; i <= lastRow; i++) {
          worksheet.getCell(`B${i}`).numFmt = 'dd/mm/yyyy';
        }
    
        
        worksheet.views = [{
          state: 'frozen',
          ySplit: 10
        }];
    
        
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');
    
        
        await workbook.xlsx.write(res);
        res.end();
    
      } catch (error) {
        console.error('Excel generation error:', error);
        res.status(500).send('Error generating Excel report');
      }
  };



module.exports = {
    loadReportpage,
    salesReportData,
    salesReportPdf,
    salesReportExcel
}
