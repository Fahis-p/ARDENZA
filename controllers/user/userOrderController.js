const User = require("../../models/userSchema")
const Address = require("../../models/addressSchema")
const Order = require("../../models/orderSchema")
const Return = require("../../models/returnSchema")
const path = require('path');
const fs = require('fs');
const PDFDocument = require('pdfkit');
const { cancelOrder } = require("../admin/adOrderController");


const orderTab = async (req, res) => {
    try {

        const userId = req.session.user;
        const userData = await User.findById(userId);

        console.log("req.query.search:", req.query.search)
        let search = ""
        if (req.query.search) {
            search = req.query.search

        }
        let page = 1
        if (req.query.page) {
            page = parseInt(req.query.page);

        }
        const limit = 3

        const orders = await Order.find({ 
            userId: userId, 
            orderId: { $regex: search, $options: "i" }  
        })
        .populate("orderedItems.productId")
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

        console.log("order:", orders)
        const orderData = orders.map((items) => {

            return {
                image: items.orderedItems[0].productId.productImage[0],
                orderId: items.orderId,
                finalAmount: items.finalAmount,
                status: items.status,
                itemCount: items.orderedItems.length

            }
        })

        const totalItems = await Order.find({
            userId: userId, 
            orderId: { $regex: search, $options: "i" }
        }).countDocuments();
        const totalPages = Math.ceil(totalItems / limit);

        res.render('orderTab', {
            orderData,
            user: userData,
            totalPages,
            currentPage:page,
            search
        });
    } catch (error) {
        console.error("Error for retrive profile data", error)
        res.redirect("/pageNotFound")

    }
}

const orderDetails = async (req, res) => {
    try {
        const userId = req.session.user;
        const userData = await User.findById(userId)
        const orderId = req.query.orderId;
        const orderDetails = await Order.findOne({ orderId: orderId }).populate("orderedItems.productId")
        if (!orderDetails) {
            return res.status(404).send("Order not found");
        }
        const addressData = await Address.findOne({ userId: userId })
        const address = addressData.address.find(addr => addr._id.toString() === orderDetails.address.toString());

        // Calculate the total amount dynamically
        // order.totalAmount = order.products.reduce((sum, product) => sum + (product.quantity * product.price), 0);

        res.render("orderDetails", {
            user: userData,
            order: orderDetails,
            address
        });

    } catch (error) {

        console.error("Error fetching order details:", error);
        res.status(500).send("Server error");


    }
}


const returnOrder = async (req, res) => {
    try {
        const { orderId, reason } = req.body;
        const order = await Order.findOne({ orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const existingReturn = await Return.findOne({ orderId });
        if (existingReturn) {
            return res.status(400).json({ success: false, message: "Return request already submitted for this order" });
        }

        // Create a new return request
        const newReturn = new Return({
            userId: order.userId, // Extract userId from order
            orderId,
            orderOid: order._id,
            returnReason: reason,
            returnStatus: "Pending"
        });
        await newReturn.save();

        order.status = "Return Requested";
        await order.save();

        return res.status(200).json({ success: true, message: "Return request submitted successfully" });


    } catch (error) {

        console.error("Error processing return order:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });

    }
}

const userCancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        console.log("orderId:", orderId)

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }

        const order = await Order.findOne({
            orderId: orderId
        });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        if (order.status === 'cancelled') {
            return res.status(400).json({ success: false, message: "Order is already cancelled" });
        }
        if (order.PaymentMethod !== 'cod') {
            const wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) {
                // Create a new wallet and add the order amount
                const newWallet = new Wallet({
                    userId: order.userId,
                    balance: order.finalAmount,  // Initial balance is the credited amount
                    transactions: [
                        {
                            amount: order.finalAmount,
                            type: "credit",
                            description: "Cancelled Order"
                        }
                    ]
                });

                await newWallet.save();
                console.log("New wallet created with credited amount!");
            } else {
                // If wallet exists, update balance and add a credit transaction
                wallet.balance += order.finalAmount;
                wallet.transactions.push({
                    amount: order.finalAmount,
                    type: "credit",
                    description: "Cancelled Order"
                });

                await wallet.save();
                console.log("Wallet updated with credited amount!");
            }


        }

        order.status = 'cancelled';
        await order.save();


        return res.json({ success: true, message: "Order cancelled successfully" });

    } catch (error) {

        console.error("Error cancelling order:", error);
        res.status(500).json({ success: false, message: "Internal server error" });

    }
}




const generateInvoicePDF = async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId }).populate("orderedItems.productId").populate('userId')
        // .populate('userId', 'name email phone')
        // .populate('order_items.productId', 'productName price');

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        const addressData = await Address.findOne({ userId: order.userId });
        const address = addressData ? addressData.address.find(addr => addr._id.toString() === order.address.toString()) : {};
        console.log("addressData:", addressData)
        console.log("address:", address)

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const filePath = path.join(__dirname, "../../public/invoices", `invoice_${orderId}.pdf`);
        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);



        // Header Section
        doc.fontSize(24).font('Helvetica-Bold').text('Ardenza', { align: 'center' }).moveDown(0.5);
        doc.fontSize(16).text('Invoice', { align: 'center' }).moveDown(0.5);
        let ypose = doc.y
        doc.fontSize(10)
            .text(`Order ID: ${orderId}`, 50, ypose)
            .text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`, 50, ypose, { align: 'right' })
            .moveDown(1);


        // Customer Details
        doc.fontSize(12).font('Helvetica-Bold').text('Customer Details').moveDown(0.5);
        doc.font('Helvetica')
        doc.fontSize(10)
            .text(`Name: ${order.userId.name}`)
            .text(`Email: ${order.userId.email}`)
            .text(`Phone: ${order.userId.phone}`)
            .text(`Address: ${address.city}, ${address.state}, ${address.pincode}`)
            .moveDown(1);

        // Order Information
        doc.fontSize(12).font('Helvetica-Bold').text('Order Information').moveDown(0.5);
        doc.font('Helvetica')
        doc.fontSize(10)
            .text(`Status: ${order.status}`)
            .text(`Payment Method: ${order.PaymentMethod}`)
            .text(`Coupon Applied: ${order.couponApplied ? 'Yes' : 'No'}`)
            .text(`Discount: ${order.discount || 0}`)
            .moveDown(1);

        // Order Summary Table
        doc.fontSize(12).font('Helvetica-Bold').text('Order Summary').moveDown(0.5);
        const tableHeaders = ['Product', 'Price', 'Quantity', ' ', 'Total'];
        const columnWidths = [200, 80, 80, 80, 80];
        let yPosition = doc.y;

        doc.rect(50, yPosition, 500, 25).fill('#f0f0f0');
        doc.fillColor('black').font('Helvetica-Bold').fontSize(10);

        let xPosition = 50;
        tableHeaders.forEach((header, i) => {
            doc.text(header, xPosition, yPosition + 7, { width: columnWidths[i], align: 'center' });
            xPosition += columnWidths[i];
        });

        yPosition += 35;
        doc.moveDown(0.5);
        doc.font('Helvetica').fontSize(10).fillColor('black');

        order.orderedItems.forEach((item) => {
            if (yPosition > 750) {
                doc.addPage();
                yPosition = 50;
            }

            xPosition = 50;
            doc.text(item.productId.productName, xPosition, yPosition, { width: columnWidths[0], align: 'center' });
            xPosition += columnWidths[0];
            doc.text(`Rs ${item.price}`, xPosition, yPosition, { width: columnWidths[1], align: 'center' });
            xPosition += columnWidths[1];
            doc.text(`${item.quantity}`, xPosition, yPosition, { width: columnWidths[2], align: 'center' });
            xPosition += columnWidths[2];
            xPosition += columnWidths[3];
            doc.text(`Rs ${item.price * item.quantity}`, xPosition, yPosition, { width: columnWidths[4], align: 'center' });
            yPosition += 20;
        });




        // Total Calculation
        const startX = 350;
        const amountX = 450;
        let currentY = doc.y + 20;
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(2);

        doc.fontSize(12).font('Helvetica-Bold');
        doc.text('Subtotal', startX, currentY);
        doc.text(`Rs ${order.totalPrice}`, amountX, currentY);

        currentY += 20;
        doc.font('Helvetica');
        doc.text('Discount', startX, currentY);
        doc.text(`Rs ${order.discount || 0}`, amountX, currentY);

        currentY += 20;
        doc.font('Helvetica');
        doc.text('Shipping charge', startX, currentY);
        doc.text('Rs 40 ', amountX, currentY);


        currentY += 20;
        doc.font('Helvetica-Bold');
        doc.text('Grand Total', startX, currentY);
        doc.text(`Rs ${order.finalAmount}`, amountX, currentY);

        doc.moveDown(1);

        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown(2);


        ypose = doc.y + 100



        // Footer

        doc.text("Thanks for choosing Ardenza", 50, ypose, { align: 'center' });
        doc.moveDown();
        doc.fontSize(8).text("Return & Exchange Policy: www.ardenza.com/return-policy", 50, doc.y, { align: 'center' });
        doc.fontSize(8).text("Contact Us: 7994102605", 50, doc.y, { align: 'center' })
        doc.fontSize(8).text("Email: contact@ardenza.com", 50, doc.y, { align: 'center' })
        doc.fontSize(8).text("Visit Us: www.ardenza.com", 50, doc.y, { align: 'center' })
        doc.moveDown();
        doc.fontSize(8).text('© 2024 Ardenza. All rights reserved.', 50, 780, { align: 'center' });

        doc.end();

        stream.on('finish', () => {
            res.download(filePath, `invoice_${orderId}.pdf`, (err) => {
                if (err) {
                    console.error("Error downloading invoice:", err);
                    res.status(500).send("Error downloading invoice");
                }
                fs.unlinkSync(filePath);
            });
        });
    } catch (error) {
        console.log("Error generating invoice PDF", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};






module.exports = {
    orderTab,
    orderDetails,
    returnOrder,
    userCancelOrder,
    generateInvoicePDF

}