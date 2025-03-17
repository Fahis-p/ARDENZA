const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema.js")
const Address = require("../../models/addressSchema.js")
const Coupon = require("../../models/couponSchema.js")
const Order = require("../../models/orderSchema.js")
const Wallet = require("../../models/walletSchema")

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



const addCheckoutAddress = async (req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findOne({_id:userId})
        const {addressType,name,city,landMark,state,pincode,phone,altPhone} = req.body;

        const userAddress = await Address.findOne({userId:userData._id})
        if(!userAddress){
            const newAddress = new Address({
                userId:userData._id,
                address: [{addressType,name,city,landMark,state,pincode,phone,altPhone}]
            })

            await newAddress.save()

        }else {

            userAddress.address.push({addressType,name,city,landMark,state,pincode,phone,altPhone})
            await userAddress.save()
        } 


        res.redirect("/checkout")

      
         

        
    } catch (error) {

        console.error("Error adding address from checkout",error)
        res.redirect("/pageNotFound")
        
    }
}


const editCheckoutAddress = async (req,res)=>{
    try {
        const userId = req.session.user
        const userData = await User.findOne({_id:userId})
        const {addressType,name,city,landMark,state,pincode,phone,altPhone,address_id} = req.body;

        const findAddress = await Address.findOne({
            "address._id": address_id
        })
         
        
        if(!findAddress){

            res.redirect("/pageNotFound")

        }

        await Address.updateOne({
            "address._id":address_id},
            {$set : {
               "address.$" :{
                _id:address_id,
                addressType : addressType,
                name: name,
                city: city,
                landMark: landMark,
                state: state,
                pincode: pincode,
                phone: phone,
                altPhone: altPhone

               }
            } }
        )

        res.redirect("/checkout")

    } catch (error) {

        console.error("Error in edit address from checkout",error)
        res.redirect("/pageNotFound")
        
    }
}


const applyCoupon = async (req,res)=>{
    try {

        const userId = req.session.user
        const { couponCode, subtotal } = req.body;

        // Example validation
        if (!couponCode) {
            return res.json({ success: false, message: "Invalid coupon!" });
        }

        const coupon = await Coupon.find({name:couponCode})
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


const removeCoupon = async (req,res)=>{

    try {

        const userId = req.session.user._id

        const { couponCode, subtotal } = req.body;

        const coupon = await Coupon.find({ name:couponCode });
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found!" });
        }

        

        await Coupon.updateOne(
            { _id: coupon[0]._id },
            { $pull: { userId: userId } }
        );


        
        
        const cart = await Cart.find({userId:userId})
        const cartTotal = cart[0].items.reduce((subTotal, item) => subTotal + item.totalPrice, 0);

        res.json({ success: true, message: "Coupon removed successfully!", cartTotal });


    } catch (error) {

        console.error("Error removing coupon:", error);
        res.status(500).json({ success: false, message: "Server error. Please try again!" });
        
    }

}

const postCheckout = async (req,res)=>{
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
        const totalPrice = orderedData.reduce((total,item)=>total+item.totalPrice,0)
        const finalAmount = totalPrice-discountAmount+40
        const orderedItemsList = []
        for (let item of orderedData) {
            let productObj = {
                productId: item.productId._id,
                quantity:item.quantity,
                price:item.price,
                totalPrice:item.totalPrice
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
            address:shippingAddress,
            PaymentMethod :paymentMethod,
            totalPrice:totalPrice,
            orderedItems:orderedItemsList,
            discount:discountAmount,
            status: "processing",
            couponApplied:false,
            finalAmount:finalAmount,
            userId:userId

        });
        await newOrder.save();

        await Cart.deleteMany({ userId });




        res.json({ success: true, orderId: newOrder._id });
    } catch (error) {

        console.log(error)
        return res.status(400).json({ success: false, message:"broo failed again" });
        
    }
}





module.exports = {
    getCheckout,
    addCheckoutAddress,
    editCheckoutAddress,
    applyCoupon,
    removeCoupon,
    postCheckout
}