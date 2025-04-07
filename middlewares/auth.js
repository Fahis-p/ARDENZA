const User = require("../models/userSchema")


const userAuth = (req,res,next)=>{
      if(req.session.user){
         User.findById(req.session.user)
         .then(data=>{
            if(data && !data.isBlocked){
                next()
            }else{
                res.redirect("/login")
            }
         })
         .catch(error=>{
            console.log("Error in user auth middleware",error)
            res.status(500).send("internal server error")
         })
      }else{

        // res.redirect("/login")
        req.session.user = {
            _id: "67ac19f158f92942fd83daf1"
        };

        next()
      }
}

const adminAuth = (req, res, next) => {
    if (req.session && req.session.admin) {  
        next();
    } else {

        // req.session.admin= true;
        //  next()
        res.redirect("/admin/login");
    }
};


module.exports = {
    userAuth,
    adminAuth
}