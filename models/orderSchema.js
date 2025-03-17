const mongoose = require("mongoose");
const { Schema } = mongoose;
const {v4:uuidv4} = require("uuid")

const orderSchema = new Schema({
    orderId: {
        type: String,
        default: ()=>uuidv4(), // Generates a unique order ID
        unique: true
    },
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    orderedItems: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            required: true
        },
        price : {
            type : Number,
            default : 0
        },
        totalPrice : {
            type : Number,
            default : 0
            
        }

    }],
    totalPrice : {
        type : Number,
        required : true
    },
    discount : {
        type : Number,
        default:0
    },
    finalAmount : {
        type : Number,
        required : true

    },
    address: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required : true
    },
    invoiceDate : {
        type : Date,
    },
    status :{
        type : String,
        required: true,
        enum : ["pending","processing","shipped","delivered","cancelled","Return Requested","Returned","Rejected"]

    }, 
    createdOn : {
        type:Date,
        default:Date.now,
        required:true
    },
    couponApplied : {
        type:Boolean,
        default: false
    },
    PaymentMethod : {
        type : String,
        required: true,
        enum : ["cod","razorpay","wallet"]
    }
    

})

const Order = mongoose.model("Order", orderSchema);

module.exports = Order;