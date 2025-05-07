const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const User = require("../../models/userSchema")

const productDetails = async (req,res)=>{
    try {

        const userId = req.session.user;
        const userData = await User.findById(userId)
        const productId = req.query.id
        const product = await Product.findById(productId).populate('category')
        const findCategory = product.category;
        const categoryOffer = findCategory ?.categoryOffer || 0
        const productOffer = product.productOffer||0
        const totalOffer = categoryOffer + productOffer;
        
        const relatedProducts = await Product.find({
            category: findCategory._id,
            _id: { $ne: productId }, // exclude the current product
            isBlocked: false,
            quantity: { $gt: 0 }
          }).limit(3);

        console.log("relatedProducts",relatedProducts)

        res.render("product-details",{
            user:userData,
            product:product,
            quantity:product.quantity,
            totalOffer:totalOffer,
            category:findCategory,
            suggestion:relatedProducts


        })


        
    } catch (error) {

        console.error("Error for fetching product details",error)
        res.redirect("/pageNotFound")
    }
}





module.exports = {
    productDetails
}