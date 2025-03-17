const User = require("../../models/userSchema");
const Product = require("../../models/productSchema");
const Cart = require("../../models/cartSchema.js")
const Wishlist = require("../../models/wishlistSchema")
const mongoose = require("mongoose");






const loadCart = async (req, res) => {
    try {

      const id = req.session.user?._id;  
if (!id) {
  return res.status(401).send("Unauthorized: No user logged in");
}


const user = await User.findById(id); 
if (!user) {
  return res.status(404).send("User not found");
}

const objectId = new mongoose.Types.ObjectId(id);

const cartDetailsFull = await Cart.findOne({userId:id})
if(cartDetailsFull){

if(cartDetailsFull.items.length === 0){
   return res.render("cart",
    {user, 
     data:[],
     grandTotal:0
     }
  )
 }


const cartDetails = await Cart.aggregate([
  { $match: { userId: objectId } },
  { $unwind: "$items" }, 
  {
    $lookup: {
      from: "products", 
      localField: "items.productId",
      foreignField: "_id",
      as: "productDetails"
    }
  },
  { $unwind: "$productDetails" }
  , 
  {
    $lookup: {
      from: "categories",
      localField: "productDetails.category",
      foreignField: "_id",
      as: "categoryDetails"
    }
  }
  
]);




const grandTotal = cartDetailsFull.items.reduce((acc, item) => acc + item.totalPrice, 0);

  res.render("cart", {
  user, 
  data:cartDetails,
  grandTotal
  });

   }else{

    res.render("cart", {
      user, 
      data:[],
      grandTotal:0
      });

   }

    } catch (error) {
      console.error("error in loading cart",error)
      res.redirect("/pageNotFound");
    }
  };



  const changeQuantity = async (req,res)=>{
    try {
      const userId = req.session.user._id
      const { productId, quantity } = req.body;
      const product = await Product.findById(productId);
        if (!product) {
            return res.status(400).json({ success: false, message: "Product not found" });
        }
        if (quantity > product.quantity) {
          return res.status(400).json({ success: false, message: "Not enough stock available" });
      }
       
      const cart = await Cart.findOneAndUpdate(
        { userId: userId, "items.productId": productId }, 
        { 
            $set: { "items.$.quantity": quantity, "items.$.totalPrice": quantity * product.salePrice } 
        },
        { new: true } // Returns the updated cart
    );
       
    console.log("count cart is :",cart)
      
    if (!cart) {
      return res.status(400).json({ success: false, message: "Cart not found" });
     }

     const grandTotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);

    
     return res.status(200).json({ success: true, message: "Quantity updated", grandTotal });


       


    } catch (error) {

      console.error("Error updating cart quantity:", error);
      return res.status(500).json({ success: false, message: "Internal Server Error" });
      
    }
  }

  const addToCart = async (req, res) => {
    try {
        const userId = req.session.user?._id;
        const { productId, quantity } = req.body;

        console.log("productId in add to cart:",productId)
        console.log("quantity in add to cart:",quantity)

        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized: No user logged in" });
        }

      

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        if (product.quantity < quantity) {
            return res.status(400).json({ success: false, message: "Not enough stock available" });
        }

        let cart = await Cart.findOne({ userId });

        if (!cart) {
            
            cart = new Cart({
                userId,
                items: [{
                    productId,
                    quantity,
                    price: product.salePrice,
                    totalPrice: product.salePrice * quantity
                }]
            });
        } else {
            
            const existingItemIndex = cart.items.findIndex(item => item.productId.equals(productId));

            

            if(existingItemIndex > -1 && cart.items[existingItemIndex].quantity + quantity >3){
              return res.status(400).json({ success: false, message: "cart limt is 3" });
            }

            console.log("this existingindex",existingItemIndex)

            

            if (existingItemIndex > -1 ) {
                
                cart.items[existingItemIndex].quantity += quantity;
                cart.items[existingItemIndex].totalPrice = cart.items[existingItemIndex].quantity * product.salePrice;
            } else {
                
                cart.items.push({
                    productId,
                    quantity,
                    price: product.salePrice,
                    totalPrice: product.salePrice * quantity
                });
            }
        }

        await cart.save();
        
        let wishlist = await Wishlist.findOne({ userId });
        if (wishlist) {
            wishlist.products = wishlist.products.filter(product => product.productId.toString() !== productId);
            await wishlist.save();
        }

        const grandTotal = cart.items.reduce((acc, item) => acc + item.totalPrice, 0);

        return res.status(200).json({ success: true, message: "Item added to cart", grandTotal });

    } catch (error) {
        console.error("Error adding item to cart:", error);
        return res.status(500).json({ success: false, message: "Internal Server Error" });
    }
};


const deleteCartItem = async (req, res) => {
  try {
      const { id } = req.body;

      if (!mongoose.Types.ObjectId.isValid(id)) {
          return res.status(400).json({ message: 'Invalid product ID' });
      }


      const updatedCart = await Cart.findOneAndUpdate(
          { "items.productId": id },
          { $pull: { items: { productId: id } } },
          { new: true }
      );

      if (!updatedCart) {
          return res.status(404).json({ message: 'Item not found in cart' });
      }


      res.json({ message: 'Item removed successfully' });
  } catch (error) {
      console.error('Error removing item:', error);
      res.status(500).json({ message: 'Internal Server Error' });
  }
}




module.exports = {
    loadCart,
    addToCart,
    changeQuantity,
    deleteCartItem
    
}