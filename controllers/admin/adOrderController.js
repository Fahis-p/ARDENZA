const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")
const Order = require("../../models/orderSchema")
const Return = require("../../models/returnSchema")
const Wallet = require("../../models/walletSchema")


const getOrders = async (req, res) => {
    try {
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

        const orderList = await Order.find({
            orderId: { $regex: search, $options: "i" }  
        })
        .populate("userId")
        .populate("orderedItems.productId")
        .sort({ createdOn: -1 })
        .limit(limit)
        .skip((page - 1) * limit);

        const returnOrders = await Return.find({ returnStatus: "Pending" }).populate('userId')

        const totalItems = await Order.find({
            orderId: { $regex: search, $options: "i" } 
        }).countDocuments();
        const totalPages = Math.ceil(totalItems / limit);





        res.render('order', {
            currentPage: page,
            totalPages,
            totalItems,
            itemsPerPage: limit,
            orders: orderList,
            returnRequests: returnOrders,
            search
        })



    } catch (error) {

        console.log("error:", error)

        res.redirect("/pageNotFound")

    }
}


const updateOrder = async (req, res) => {
    try {

        const { orderId, status } = req.body;

        // Validate input
        if (!orderId || !status) {
            return res.status(400).json({ success: false, message: "Order ID and status are required" });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { status },
            { new: true } // Return the updated document
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        res.status(200).json({ success: true, message: "Order status updated successfully", order: updatedOrder });



    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}


const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        console.log("orderId:",orderId)

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
        if(order.PaymentMethod!=='cod'){
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


const approveReturn = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(400).json({ success: false, message: "Order ID is required" });
        }
        console.log("orderId:", orderId)
        const order = await Order.findOne({ orderId })

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        const returnOrder = await Return.findOne({ orderId: order.orderId });
        console.log("returnOrder:", returnOrder)

        // Check if order is eligible for return approval
        if (order.status !== "Return Requested") {
            return res.status(400).json({ success: false, message: "Order is not in return requested state" });
        }



        // Update order status to 'Returned'
        order.status = "Returned";
        await order.save();
        returnOrder.returnStatus = "Returned"
        await returnOrder.save()

        for (const item of order.orderedItems) {
            const product = await Product.findById(item.productId); // Find product by ID

            if (product) {
                product.quantity += item.quantity; // Increase stock based on returned quantity
                await product.save(); // Save updated product stock
            }
        }

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
                        description: "Returned Order"
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
                description: "Returned Order"
            });

            await wallet.save();
            console.log("Wallet updated with credited amount!");
        }



        res.status(200).json({ success: true, message: "Return approved successfully" });

    } catch (error) {

        console.error("Error while approving return:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });

    }
}

const rejectReturn = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const order = await Order.findOne({ orderId })

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }
        const returnOrder = await Return.findOne({ orderId });

        if (!returnOrder) {
            return res.status(404).json({ success: false, message: "Return request not found" });
        }

        order.status = "Rejected";
        await order.save();
        returnOrder.returnStatus = "Rejected";
        returnOrder.rejectReason = reason; // Optionally store the rejection reason
        await returnOrder.save(); // Save the changes

        return res.json({ success: true, message: "Return request rejected successfully" });

    } catch (error) {
        console.error("Error rejecting return request:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });
    }
}




module.exports = {
    getOrders,
    updateOrder,
    cancelOrder,
    approveReturn,
    rejectReturn
}