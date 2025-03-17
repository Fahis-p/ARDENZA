const express = require("express")
const passport = require("../config/passport")
const router = express.Router()
const userController = require("../controllers/user/userController")
const {userAuth,adminAuth}= require("../middlewares/auth")
const productController = require("../controllers/user/productController")
const profileController = require("../controllers/user/profileController")
const wishlistController = require("../controllers/user/wishlistController")
const cartController = require("../controllers/user/cartController.js")
const checkoutController = require("../controllers/user/checkoutController.js")
const userOrderController = require("../controllers/user/userOrderController.js")


//Error management
router.get("/pageNotFound",userController.pageNotFound)

//Home page & shopping page
router.get("/",userController.loadHomepage)
router.get("/shop",userAuth,userController.loadShoppingPage)
router.get("/filter",userController.filterProduct)
router.get("/filterPrice",userController.filterByPrice)
router.post("/search",userController.searchProducts)

//sighnup management
router.get("/signup",userController.loadSignup)
router.post("/signup",userController.signup)
router.post("/verify_otp",userController.verifyOtp)
router.post("/resend_otp",userController.resendOtp)

router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"],prompt:"select_account"}))
router.get("/auth/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),userController.googleAuth,(req,res)=>{
    res.redirect("/")
  })


 //Login Management 
router.get("/login",userController.loadLogin)
router.post("/login",userController.login)

router.get("/logout",userController.logout)  



//product Managment
router.get("/productDetails",userAuth,productController.productDetails)

//wishlist Managment
router.get("/wishlist",userAuth,wishlistController.loadWishlist)
router.post("/addToWishlist",userAuth,wishlistController.addToWishlist)
router.delete("/removeFromWishlist",userAuth,wishlistController.removeFromWishlist)


//cartManagment
router.get("/cart",userAuth,cartController.loadCart)
router.post("/addToCart",userAuth, cartController.addToCart)
router.post("/changeQuantity",userAuth, cartController.changeQuantity)
router.post("/deleteItem",userAuth,cartController.deleteCartItem)

//CheckoutManagment
router.get("/checkout",userAuth,checkoutController.getCheckout)
router.post("/addCheckoutAddress",userAuth,checkoutController.addCheckoutAddress)
router.post("/editCheckoutAddress",userAuth,checkoutController.editCheckoutAddress)
router.post("/applyCoupon",userAuth,checkoutController.applyCoupon)
router.post("/removeCoupon",userAuth,checkoutController.removeCoupon)
router.post("/checkout",userAuth,checkoutController.postCheckout)

//orderManagment
router.get("/orderTab",userAuth,userOrderController.orderTab)
router.get("/orderDetails",userAuth,userOrderController.orderDetails)
router.post("/returnOrder",userAuth,userOrderController.returnOrder)
router.post("/cancelOrder",userAuth,userOrderController.userCancelOrder)
router.get('/downloadInvoice/:orderId',userAuth,userOrderController.generateInvoicePDF)

//profile Management 
router.get("/forgot-password",profileController.getForgotPassPage)
router.post("/forgot-email-valid",profileController.getForgotEmailValid)
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp)
router.get("/reset-password",profileController.getResetPassPage)
router.post("/resend-forgot-otp",profileController.resendOtp)
router.post("/reset-password",profileController.postNewPassword)
router.get("/userProfile",userAuth,profileController.userProfile)
router.get("/change-password",userAuth,profileController.changePassword)
router.post("/change-password",userAuth,profileController.changePasswordValid)
router.post("/verify-changepassword-otp",userAuth,profileController.verifyChangePassOtp)

//Address Managment
router.get("/addAddress",userAuth,profileController.addAddress);
router.post("/addAddress",userAuth,profileController.postAddAddress);
router.get("/editAddress",userAuth,profileController.editAddress);
router.post("/editAddress",userAuth,profileController.postEditAddress);
router.get("/deleteAddress",userAuth,profileController.deleteAddress);



module.exports = router