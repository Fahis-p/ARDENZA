const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema.js")
const Address = require("../../models/addressSchema.js")
const Coupon = require("../../models/couponSchema.js")
const Order = require("../../models/orderSchema.js")
const Wallet = require("../../models/walletSchema")
const Razorpay = require("razorpay");
const crypto = require("crypto");

const getCheckout = async (req, res) => {
    try {
        const userId = req.session.user._id;

        if (!userId) {
            return res.status(401).json({ message: "Unauthorized access" });
        }


        const currentAddress = await Address.findOne({ userId: userId });


        const cartDetailsFull = await Cart.findOne({ userId: userId }).populate('items.productId');

        let grandTotal = 0;

        if (cartDetailsFull && cartDetailsFull.items) {
            grandTotal = cartDetailsFull.items.reduce((acc, item) => acc + item.totalPrice, 0);
        }


        const coupons = await Coupon.find({
            userId: { $nin: [userId] }
        });


        const wallet = await Wallet.findOne({ userId: userId });

        console.log("Coupons:", coupons);

        res.render("checkout", {
            user: userId,
            data: [],
            grandTotal,
            product: [],
            userAddress: currentAddress ? currentAddress.address : null,
            index: 0,
            messages: " ",
            cart: cartDetailsFull,
            coupon: coupons,
            walletBalance: wallet ? wallet.balance : 0
        });

    } catch (error) {
        console.error("Error in getCheckout:", error);
        res.status(500).json({ message: "Something went wrong. Please try again later." });
    }
};



const addCheckoutAddress = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findOne({ _id: userId })
        const { addressType, name, city, landMark, state, pincode, phone, altPhone } = req.body;

        const userAddress = await Address.findOne({ userId: userData._id })
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
            })

            await newAddress.save()

        } else {

            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone })
            await userAddress.save()
        }


        res.redirect("/checkout")





    } catch (error) {

        console.error("Error adding address from checkout", error)
        res.redirect("/pageNotFound")

    }
}


const editCheckoutAddress = async (req, res) => {
    try {
        const userId = req.session.user
        const userData = await User.findOne({ _id: userId })
        const { addressType, name, city, landMark, state, pincode, phone, altPhone, address_id } = req.body;

        const findAddress = await Address.findOne({
            "address._id": address_id
        })


        if (!findAddress) {

            res.redirect("/pageNotFound")

        }

        await Address.updateOne({
            "address._id": address_id
        },
            {
                $set: {
                    "address.$": {
                        _id: address_id,
                        addressType: addressType,
                        name: name,
                        city: city,
                        landMark: landMark,
                        state: state,
                        pincode: pincode,
                        phone: phone,
                        altPhone: altPhone

                    }
                }
            }
        )

        res.redirect("/checkout")

    } catch (error) {

        console.error("Error in edit address from checkout", error)
        res.redirect("/pageNotFound")

    }
}


const applyCoupon = async (req, res) => {
    try {

        const userId = req.session.user
        const { couponCode, subtotal } = req.body;

        // Example validation
        if (!couponCode) {
            return res.json({ success: false, message: "Invalid coupon!" });
        }

        const coupon = await Coupon.find({ name: couponCode })
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found!" });
        }

        await Coupon.updateOne(
            { _id: coupon[0]._id },
            { $addToSet: { userId: userId } }
        );


        const discount = coupon[0].offerPrice;
        const newTotal = subtotal - discount;

        res.json({
            success: true,
            discount,
            newTotal
        });


    } catch (error) {

        console.error("Server error:", error);
        res.status(500).json({ success: false, message: "Internal Server Error" });

    }
}


const removeCoupon = async (req, res) => {

    try {

        const userId = req.session.user._id

        const { couponCode, subtotal } = req.body;

        const coupon = await Coupon.find({ name: couponCode });
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found!" });
        }



        await Coupon.updateOne(
            { _id: coupon[0]._id },
            { $pull: { userId: userId } }
        );




        const cart = await Cart.find({ userId: userId })
        const cartTotal = cart[0].items.reduce((subTotal, item) => subTotal + item.totalPrice, 0);

        res.json({ success: true, message: "Coupon removed successfully!", cartTotal });


    } catch (error) {

        console.error("Error removing coupon:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again!" });

    }

}

const postCheckout = async (req, res) => {
    try {


        const userId = req.session.user._id

        const { shippingAddress, paymentMethod, totalAmount, orderedItems, couponCode, discountAmount } = req.body;

        console.log("Shipping Address:", shippingAddress);
        console.log("Payment Method:", paymentMethod);
        console.log("Total Amount:", totalAmount);
        console.log("Ordered Items:", orderedItems);
        console.log("Coupon Code:", couponCode);
        console.log("Discount Amount:", discountAmount);

        // Check product availability


        const orderedData = JSON.parse(orderedItems)




        let unavailableItems = [];
        for (let item of orderedData) {
            const product = await Product.findById(item.productId);
            if (!product || product.quantity < item.quantity) {
                unavailableItems.push({ name: product?.productName || "Unknown", reason: "Out of stock" });
            }
        }


        if (unavailableItems.length > 0) {
            return res.status(400).json({ success: false, unavailableItems });
        }


        // // Reduce stock quantity
        for (let item of orderedData) {
            await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });
        }
        const totalPrice = orderedData.reduce((total, item) => total + item.totalPrice, 0)
        const finalAmount = totalPrice - discountAmount + 40
        const orderedItemsList = []
        for (let item of orderedData) {
            let productObj = {
                productId: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.totalPrice
            }
            orderedItemsList.push(productObj)
        }

        if (paymentMethod === "wallet") {
            const wallet = await Wallet.findOne({ userId });

            if (!wallet || wallet.balance < finalAmount) {
                return res.json({
                    success: false,
                    error: "Insufficient wallet balance.",
                });
            }

            // Deduct amount from wallet
            wallet.balance -= finalAmount;

            // Add a transaction record in wallet
            wallet.transactions.push({
                type: "debit",
                amount: finalAmount,
                description: "Ordered",
                date: new Date(),
            });

            await wallet.save();
        }




        // Create new order
        const newOrder = new Order({
            address: shippingAddress,
            PaymentMethod: paymentMethod,
            totalPrice: totalPrice,
            orderedItems: orderedItemsList,
            discount: discountAmount,
            status: "processing",
            couponApplied: false,
            finalAmount: finalAmount,
            userId: userId

        });
        await newOrder.save();

        await Cart.deleteMany({ userId });




        res.json({ success: true, orderId: newOrder._id });
    } catch (error) {

        console.log(error)
        return res.status(400).json({ success: false, message: "broo failed again" });

    }
}

const validateCheckoutItems = async (req, res) => {
    try {
        let { orderedItems } = req.body;
        orderedItems = JSON.parse(orderedItems);


        let unavailableItems = [];

        for (let item of orderedItems) {
            const product = await Product.findById(item.productId._id);

            if (!product || product.quantity < item.quantity) {
                unavailableItems.push({
                    productId: item.productId._id,
                    productName: item.productId.productName,
                    reason: product ? "Out of stock" : "Product not found"
                });
            }
        }

        if (unavailableItems.length > 0) {
            return res.status(400).json({ success: false, unavailableItems });
        }

        return res.json({ success: true, message: "All items are available." });
    } catch (error) {

        console.error("Validation Error:", error);
        return res.status(500).json({ success: false, error: error.message });

    }
}

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});
// const razorpay = new Razorpay({
//     key_id:'rzp_test_JgvLO1LVFXqLkX',
//     key_secret:'yyfF6dyqqDRGqvQDdvlKnZLb'
// });

const createRazorpayOrder = async (req,res)=>{
    try {
        const { amount, currency } = req.body;
        const options = {
            amount: amount * 100, // Razorpay accepts paise
            currency,
            receipt: `receipt_${Date.now()}`,
        };
        const order = await razorpay.orders.create(options);
        res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            amount: order.amount,
            currency: order.currency,
            order_id: order.id,
        });
    } catch (error) {
        console.error("Error creating Razorpay order:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}

const verifyPayment = async (req,res)=>{
    try {

        const userId = req.session.user._id

        let {
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            shippingAddress,
            orderedItems,
            totalAmount,
            couponCode,
            discountAmount,
            paymentMethod,
            paymentStatus,
            orderStatus
        } = req.body;

        if (!razorpay_order_id) {
            return res.status(400).json({ success: false, message: "Missing Razorpay order ID" });
        }

        
        let status = "failed";
        let itemStatus = "failed"; // default to failed

        if (razorpay_payment_id && razorpay_signature) {
            const generatedSignature = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                .digest("hex");

            if (generatedSignature !== razorpay_signature) {
                return res.status(400).json({ success: false, message: "Invalid payment signature" });
            }

            paymentStatus = "paid"; 
            status = "processing";
            itemStatus = "ordered"; // set to ordered on successful payment
        }

        orderedItems = JSON.parse(orderedItems);

        let unavailableItems = [];

        for (let item of orderedItems) {
            const product = await Product.findById(item.productId._id);

            if (!product || product.quantity < item.quantity) {
                unavailableItems.push({
                    productId: item.productId._id,
                    productName: item.productId.productName,
                    reason: product ? "Out of stock" : "Product not found"
                });
            }
        }

        if (unavailableItems.length > 0) {
            return res.status(400).json({ success: false, unavailableItems });
        }

        for (let item of orderedItems) {
            await Product.findByIdAndUpdate(item.productId._id, { $inc: { quantity: -item.quantity } });
        }

        const totalPrice = orderedItems.reduce((total, item) => total + item.totalPrice, 0)
        const finalAmount = totalPrice - discountAmount + 40
        const orderedItemsList = []
        for (let item of orderedItems) {
            let productObj = {
                productId: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                totalPrice: item.totalPrice
            }
            orderedItemsList.push(productObj)
        }

        const newOrder = new Order({
            address: shippingAddress,
            PaymentMethod: paymentMethod,
            totalPrice: totalPrice,
            orderedItems: orderedItemsList,
            discount: discountAmount,
            status: orderStatus ?? "processing",
            paymentStatus: paymentStatus ?? "paid",
            couponApplied: false,
            finalAmount: finalAmount,
            userId: userId 

        }); 
        await newOrder.save();

        await Cart.deleteMany({ userId });




        //below check

        console.log("Order Confirmed:", {
            paymentId: razorpay_payment_id,
            amount: totalAmount,
            shippingAddress,
            couponCode,
            discountAmount,
            paymentMethod,
        });

        console.log("ordered",orderedItems)

        console.log("req.body here at verify payment",req.body)

        


        return res.status(200).json({ success: true, orderId:newOrder.orderId});
    } catch (error) {
        console.error("Payment verification error:", error);
        res.status(500).json({ success: false, message: "Server error during payment verification" });
    }
}


const retryPayment = async (req,res)=>{
    try {
        const { 
            orderId ,
            razorpay_order_id,
            razorpay_signature,
            razorpay_payment_id,

        } = req.body;

        if (!razorpay_order_id) {
            return res.status(400).json({ success: false, message: "Missing Razorpay order ID" });
        }

        let paymentStatus = 'failed'
        let status = "failed";
        let itemStatus = "failed"; // default to failed

        if (razorpay_payment_id && razorpay_signature) {
            const generatedSignature = crypto
                .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
                .update(`${razorpay_order_id}|${razorpay_payment_id}`)
                .digest("hex");

            if (generatedSignature !== razorpay_signature) {
                return res.status(400).json({ success: false, message: "Invalid payment signature" });
            }

            paymentStatus = "paid"; 
            status = "processing";
            itemStatus = "ordered"; // set to ordered on successful payment
        }

        // Find the order by orderId
        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }


        // Update order status and payment status
        order.status = status;
        order.paymentStatus = paymentStatus;

        // Save the updated order
        await order.save();

        res.json({ success: true, message: "Payment retried successfully", order });
    } catch (error) {
        console.error("Error retrying payment:", error);
        res.status(500).json({ success: false, message: "Server error" });
    }
}




module.exports = {
    getCheckout,
    addCheckoutAddress,
    editCheckoutAddress,
    applyCoupon,
    removeCoupon,
    postCheckout,
    validateCheckoutItems,
    createRazorpayOrder,
    verifyPayment,
    retryPayment
}