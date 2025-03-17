const User = require("../../models/userSchema")
const Product = require("../../models/productSchema")
const Wishlist = require("../../models/wishlistSchema")

const loadWishlist = async (req,res)=>{
    try {
        const userId = req.session.user
        const user = await User.findById(userId)

        const wishlist = await Wishlist.findOne({ userId }).populate('products.productId')


        if(wishlist){
        res.render("wishlist",{
            user,
            wishlist:wishlist
        })
            }else{

                res.render("wishlist",{
                    user,
                    wishlist:{}
                })

            }

    } catch (error) {

        console.error("error in opening wishlist page",error)
        res.redirect("/pageNotFound")
        
    }
}

const addToWishlist = async (req,res)=>{
    try {
        const userId = req.session.user
        const { productId } = req.body;

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            
            wishlist = new Wishlist({ userId, products: [{ productId }] });
        } else {
            
            const productExists = wishlist.products.some(item => item.productId.equals(productId));

            if (productExists) {
                return res.status(400).json({ message: "Product already in wishlist!" });
            }

            
            wishlist.products.push({ productId });
        }

        
        await wishlist.save();

        res.status(200).json({ message: "Product added to wishlist!" });
        
    } catch (error) {
        
    }
}

const removeFromWishlist =  async (req, res) => {
    try {
        const { productId } = req.body;

         const userId = req.session.user
        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(404).json({ message: "Wishlist not found" });
        }

        wishlist.products = wishlist.products.filter(product => product.productId.toString() !== productId);

        // Save the updated wishlist
        await wishlist.save();

        res.status(200).json({ message: "Product removed from wishlist" });

    } catch (error) {
        console.error("Error removing from wishlist:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
};

module.exports ={
    loadWishlist,
    addToWishlist,
    removeFromWishlist

}