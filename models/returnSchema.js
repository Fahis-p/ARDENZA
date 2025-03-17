const mongoose = require("mongoose");
const { Schema } = mongoose;

const returnSchema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    orderId: {
        type: String,  
        required: true
    },
    orderOid: {
        type: Schema.Types.ObjectId,
        ref: "Order",
        required: true
    },
    returnReason: {
        type: String,
        required: true
    },
    returnStatus: {
        type: String,
        enum: ["Pending", "Approved", "Rejected", "Returned"],
        default: "Pending"
    },
    rejectReason:{
        type: String,  
        default: "none"

    },
    createdOn: {
        type: Date,
        default: Date.now
    }
});

const Return = mongoose.model("Return", returnSchema);

module.exports = Return;
