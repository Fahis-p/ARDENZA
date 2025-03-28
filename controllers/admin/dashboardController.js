const mongoose = require("mongoose");
const Order = require("../../models/orderSchema")
const Product = require("../../models/productSchema");
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');


const getBestSellingProducts = async (startDate, endDate) => {
    try {
        const bestSellingProducts = await Order.aggregate([
            // Match orders within the specified date range
            {
                $match: {
                    createdOn: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },

            // Unwind the orderedItems array to process each product individually
            { $unwind: "$orderedItems" },

            // Group by productId and calculate total quantity and revenue
            {
                $group: {
                    _id: "$orderedItems.productId",
                    totalQuantity: { $sum: "$orderedItems.quantity" },
                    totalRevenue: { $sum: "$orderedItems.totalPrice" }
                }
            },

            // Sort by totalQuantity in descending order
            { $sort: { totalQuantity: -1 } },

            // Limit to top 10 products (or any number you want)
            { $limit: 10 },

            // Lookup product details from the Product collection
            {
                $lookup: {
                    from: "products", // Name of the Product collection
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },

            // Unwind the productDetails array (since lookup returns an array)
            { $unwind: "$productDetails" },

            // Lookup category details from the Category collection
            {
                $lookup: {
                    from: "categories", // Name of the Category collection
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },

            // Unwind the categoryDetails array
            { $unwind: "$categoryDetails" },

            // Project the required fields
            {
                $project: {
                    productName: "$productDetails.productName",
                    categoryName: "$categoryDetails.name",
                    price: "$productDetails.salePrice",
                    totalQuantity: 1,
                    revenue: "$totalRevenue"
                }
            }
        ]);

        return bestSellingProducts;
    } catch (error) {
        console.error("Error fetching best selling products:", error);
        throw error;
    }
};



const calculateSalesData = async (startDate, endDate) => {
    try {
        // Fetch orders within the date range
        const orders = await Order.find({
            createdOn: { $gte: startDate, $lte: endDate },
        });

        // Calculate total sales, discounts, and orders
        const totalSales = orders.reduce((sum, order) => sum + order.finalAmount, 0);
        const totalDiscounts = orders.reduce((sum, order) => sum + order.discount, 0);
        const totalOrders = orders.length;

        return {
            totalSales,
            totalDiscounts,
            totalOrders,
        };
    } catch (error) {
        console.error("Error calculating sales data:", error);
        throw error;
    }
};

const parseISOWeek = (weekString) => {
    const [year, week] = weekString.split("-W"); // Split into year and week number
    const startOfYear = new Date(year, 0, 1); // Start of the year
    const startOfWeek = new Date(startOfYear); // Clone the start of the year

    // Calculate the start of the week
    startOfWeek.setDate(startOfWeek.getDate() + (week - 1) * 7 - startOfYear.getDay());
    return startOfWeek;
};



const salesReport = async (req, res) => {
    try {
        const { period, date, week, year, startDate, endDate } = req.query;
        const yearValue = Array.isArray(year) ? year[0] : year;

        console.log("Period:", period);
        console.log("Date:", date);
        console.log("Week:", week);
        console.log("Year:", yearValue);
        console.log("Start Date:", startDate);
        console.log("End Date:", endDate);

        // Validate input based on the selected period
        if (period === "daily" && !date) {
            return res.status(400).json({ error: "Date is required for daily reports." });
        }
        if (period === "weekly" && !week) {
            return res.status(400).json({ error: "Week is required for weekly reports." });
        }
        if (period === "yearly" && !yearValue) {
            return res.status(400).json({ error: "Year is required for yearly reports." });
        }
        if (period === "custom" && (!startDate || !endDate)) {
            return res.status(400).json({ error: "Start date and end date are required for custom reports." });
        }

        
        let start, end;

        // Set date range based on the selected period
        switch (period) {
            case "daily":
                start = new Date(date);
                start.setHours(0, 0, 0, 0); // Start of the day
                end = new Date(date);
                end.setHours(23, 59, 59, 999); // End of the day
                break;

            case "weekly":
                const startOfWeek = parseISOWeek(week);
                start = new Date(startOfWeek);
                start.setDate(start.getDate() - start.getDay());
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setDate(end.getDate() + 6); 
                end.setHours(23, 59, 59, 999);
                break;

            case "yearly":
                start = new Date(yearValue, 0, 1); // Start of the year
                start.setHours(0, 0, 0, 0);
                end = new Date(yearValue, 11, 31); // End of the year
                end.setHours(23, 59, 59, 999);
                break;

            case "custom":
                start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                break;

            default:
                return res.status(400).json({ error: "Invalid period selected." });
        }

        // Calculate sales data using the reusable function
        const reportData = await calculateSalesData(start, end);
        const topProducts = await getBestSellingProducts(start, end);

        console.log("topProducts:",topProducts)

        res.json({reportData,topProducts});
    } catch (error) {
        console.error("Error generating sales report:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};

const fetchSalesData = async (period, date, week, year, startDate, endDate) => {
    let start, end;

    console.log("Period:", period);
        console.log("Date:", date);
        console.log("Week:", week);
        console.log("Year:", year);
        console.log("Start Date:", startDate);
        console.log("End Date:", endDate);

    // Set date range based on the selected period
    switch (period) {
        case 'daily':
            start = new Date(date);
            start.setHours(0, 0, 0, 0);
            end = new Date(date);
            end.setHours(23, 59, 59, 999);
            break;

        case 'weekly':
            const [weekStart, weekEnd] = [startDate , endDate]
            start = new Date(weekStart);
            end = new Date(weekEnd);
            break;

        case 'yearly':
            start = new Date(year, 0, 1);
            end = new Date(year, 11, 31);
            break;

        case 'custom':
            start = new Date(startDate);
            end = new Date(endDate);
            break;

        default:
            throw new Error('Invalid period selected.');
    }

    // Fetch orders within the date range
    const orders = await Order.find({
        createdOn: { $gte: start, $lte: end }
    });

    // Calculate total sales, discounts, and orders
    const totalSales = orders.reduce((sum, order) => sum + order.finalAmount, 0);
    const totalDiscounts = orders.reduce((sum, order) => sum + order.discount, 0);
    const totalOrders = orders.length;

    // Fetch best selling products
    const topProducts = await getBestSellingProducts(start, end);

    return {
        totalSales,
        totalDiscounts,
        totalOrders,
        topProducts
    };
};


const salesReportPdf = async (req,res) => {
    try {

        const { period, date, week, year, startDate, endDate } = req.query;

        console.log("Period 1:", period);
        console.log("Date 1:", date);
        console.log("Week 1:", week);
        console.log("Year 1:", year);
        console.log("Start Date 1:", startDate);
        console.log("End Date 1:", endDate);

      const startDate1 = Array.isArray(req.query.startDate) ? req.query.startDate[1] : req.query.startDate;
      const endDate1 = Array.isArray(req.query.endDate) ? req.query.endDate[1] : req.query.endDate;
      const year1 = Array.isArray(req.query.year) ? req.query.year[1] : req.query.year;


        let sDate = startDate ? startDate1:date
        let eDate = endDate ? endDate1:date
        if(period === 'yearly'){
        sDate = year1 ? `01/01/${year1}`:sDate
        eDate = year1 ? `31/12/${year1}`:eDate
        }

        // Fetch sales data based on the selected period
        const salesData = await fetchSalesData(period, date, week, year1, startDate1, endDate1);

        // Create a new PDF document
        const doc = new PDFDocument();

        // Set response headers for PDF download
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.pdf');

        // Pipe the PDF document to the response
        doc.pipe(res);

        // Add content to the PDF
        doc.fontSize(18).text('Sales Report', { align: 'center' }).moveDown();

        // Add period information
        doc.fontSize(12).text(`Period: ${period} report`).moveDown();
        doc.text(`Start Date: ${sDate}`).moveDown();
        doc.text(`End Date: ${eDate}`).moveDown();
        doc.text(`Total Sales: Rs ${salesData.totalSales.toFixed(2)}`).moveDown();
        doc.text(`Total Discounts: Rs ${salesData.totalDiscounts.toFixed(2)}`).moveDown();
        doc.text(`Total Orders: ${salesData.totalOrders}`).moveDown();

        // Add best selling products table
        doc.fontSize(14).text('Best Selling Products', { underline: true }).moveDown();

        // Define table columns and rows
        const table = {
            headers: ['Product Name', 'Category', 'Price', 'Sold', 'Revenue'],
            rows: salesData.topProducts.map(product => [
                product.productName,
                product.categoryName || 'N/A',
                `Rs ${product.price.toFixed(2)}`,
                product.totalQuantity,
                `Rs ${product.revenue.toFixed(2)}`
            ])
        };

        // Draw the table
        let startX = 50;
        let startY = doc.y;
        const columnWidth = 100;
        const rowHeight = 40;

        // Draw table headers
        doc.font('Helvetica-Bold');
        table.headers.forEach((header, i) => {
            doc.text(header, startX + i * columnWidth, startY, { width: columnWidth, align: 'left' });
        });
        doc.moveDown();

        // Draw table rows
        doc.font('Helvetica');
        table.rows.forEach((row, rowIndex) => {
            const y = startY + (rowIndex + 1) * rowHeight;
            row.forEach((cell, colIndex) => {
                doc.text(cell, startX + colIndex * columnWidth, y, { width: columnWidth, align: 'left' });
            });

            doc.moveTo(startX, y + rowHeight) // Start point of the line
            .lineTo(startX + columnWidth * table.headers.length, y + rowHeight ) // End point of the line
            .stroke();
            
            let space = 10; // Space in units (adjust as needed)
            startY += space;
        });

        // Finalize the PDF
        doc.end();

        
    } catch (error) {

        console.error('Error generating PDF:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
        
    }
}


const salesReportExcel = async (req,res)=>{
    try {
        const { period, date, week, year, startDate, endDate } = req.query;

        console.log("Period:", period);
        console.log("Date:", date);
        console.log("Week:", week);
        console.log("Year:", year);
        console.log("Start Date:", startDate);
        console.log("End Date:", endDate);

        const year1 = Array.isArray(req.query.year) ? req.query.year[1] : req.query.year;

        const salesData = await fetchSalesData(period, date, week, year1, startDate, endDate);
        
        // Create a new Excel workbook and worksheet
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Sales Report');

        // Add headers to the worksheet
        worksheet.columns = [
            { header: 'Product Name', key: 'productName', width: 30 },
            { header: 'Category', key: 'categoryName', width: 20 },
            { header: 'Price', key: 'price', width: 15 },
            { header: 'Sold', key: 'totalQuantity', width: 15 },
            { header: 'Revenue', key: 'revenue', width: 15 }
        ];

        // Add rows to the worksheet
        salesData.topProducts.forEach(product => {
            worksheet.addRow({
                productName: product.productName,
                categoryName: product.categoryName || 'N/A',
                price: `Rs ${product.price.toFixed(2)}`,
                totalQuantity: product.totalQuantity,
                revenue: `Rs ${product.revenue.toFixed(2)}`
            });
        });

        // Add summary data
        worksheet.addRow([]); // Empty row for spacing
        worksheet.addRow(['Total Sales', `Rs ${salesData.totalSales.toFixed(2)}`]);
        worksheet.addRow(['Total Discounts', `Rs ${salesData.totalDiscounts.toFixed(2)}`]);
        worksheet.addRow(['Total Orders', salesData.totalOrders]);

        // Set response headers for Excel download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=sales-report.xlsx');

        // Write the workbook to the response
        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error('Error generating Excel:', error);
        res.status(500).json({ error: 'Failed to generate Excel' });
    }
}



module.exports = {
    salesReport,
    salesReportPdf,
    salesReportExcel
}