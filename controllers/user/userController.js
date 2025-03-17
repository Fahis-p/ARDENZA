
const User = require("../../models/userSchema.js")
const Category = require("../../models/categorySchema.js")
const Product = require("../../models/productSchema.js")
const Brand = require("../../models/brandSchema.js")
const env = require("dotenv").config()
const nodemailer = require("nodemailer")
const bcrypt = require("bcrypt")

const pageNotFound = async (req, res) => {
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const googleAuth = async (req, res, next) => {

    try {
        const user = await User.findById(req.session.passport.user);
        req.session.user = user; // Store full user data
        next()
    } catch (error) {
        console.log("Error storing session user:", error);
        res.redirect("/signup");
    }
}


const loadHomepage = async (req, res) => {
    try {

        const user = req.session.user
        const categories = await Category.find({ isListed: true })
        let productData = await Product.find(
            {
                isBlocked: false,
                category: { $in: categories.map(category => category._id) },
                quantity: { $gt: 0 }
            }

        ).sort({ updatedAt: -1 })
            .limit(4);




        if (user) {
            const userData = await User.findOne({ _id: user._id })
            res.render("home", { user: userData, products: productData })

        } else {


            return res.render("home", { user: null, products: productData })

        }


    } catch (error) {
        console.log("home page not found");
        res.status(500).send("server error")
    }
}
const loadSignup = async (req, res) => {
    try {
        if (req.session.user) {
            return res.redirect("/")
        }
        return res.render("signup")
    } catch (error) {
        console.log("signup page not found", error);
        res.status(500).send("server error")
    }
}
const loadShoppingPage = async (req, res) => {
    try {

        const user = req.session.user;
        const userData = await User.findOne({ _id: user })
        const categories = await Category.find({ isListed: true })
        const categoryIds = categories.map((category) => category._id.toString())
        const page = parseInt(req.query.page) || 1;
        const limit = 9
        const skip = (page - 1) * limit
        const products = await Product.find({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 }

        }).sort({ createdOn: -1 }).skip(skip).limit(limit);

        const totalProducts = await Product.countDocuments({
            isBlocked: false,
            category: { $in: categoryIds },
            quantity: { $gt: 0 }
        })

        let selectedPrice= { gt: 0, lt: 1000000 }

        const totalPages = Math.ceil(totalProducts / limit)

        const brands = await Brand.find({ isBlocked: false })

        const categoriesWithIds = categories.map(category => ({ _id: category._id, name: category.name }))

        req.session.filteredProducts = null

        res.render("shop", {
            user: userData,
            products: products,
            category: categoriesWithIds,
            brand: brands,
            totalProducts: totalProducts,
            currentPage: page,
            totalPages: totalPages,
            selectedCategory: null,
            selectedBrand: null,
            selectedPrice
        })

    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const filterProduct = async (req, res) => {
    try {
        const user = req.session.user;
        const category = req.query.category;
        const brand = req.query.brand

        const findCategory = category ? await Category.findOne({ _id: category, isListed: true  }) : null
        const findBrand = brand ? await Brand.findOne({ _id: brand }) : null
        const brands = await Brand.find({}).lean()
        const query = {
            isBlocked: false,
            quantity: { $gt: 0 }
        }

        if (findCategory) {
            query.category = findCategory._id

        }

        if (findBrand) {

            query.brand = findBrand.brandName

        }

        let selectedPrice= { gt: 0, lt: 1000000 }

        let findProducts = await Product.find(query).lean()
        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn))
        const categories = await Category.find({ isListed: true })

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage)
        const currentProduct = findProducts.slice(startIndex, endIndex)
        let userData = null
        if (user) {
            userData = await User.findOne({ _id: user })
            if (userData) {
                const searchEntry = {
                    category: findCategory ? findCategory._id : null,
                    brand: findBrand ? findBrand.brandName : null,
                    searchedOn: new Date()
                }
                userData.searchHistory.push(searchEntry)
                await userData.save()
            }
        }

        req.session.filteredProducts = currentProduct
        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            selectedCategory: category || null,
            selectedBrand: brand || null,
            selectedPrice
        })


    } catch (error) {

        res.redirect("/pageNotFound")


    }
}

const filterByPrice = async (req, res) => {
    try {
        const user = req.session.user
        const userData = await User.findOne({ _id: user })
        const brands = await Brand.find({}).lean()
        const categories = await Category.find({ isListed: true }).lean()

        const greater = Number(req.query.gt);
        const lesser = Number(req.query.lt);

        const selectedPrice = {
            gt: !isNaN(greater) ? greater : 0,
            lt: !isNaN(lesser) ? lesser : 1000000
        };

        let findProducts = await Product.find({
            salePrice: { $gt: greater, $lt: lesser }, isBlocked: false, quantity: { $gt: 0 }
        }).lean()
        findProducts.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn))

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(findProducts.length / itemsPerPage)
        const currentProduct = findProducts.slice(startIndex, endIndex)
        req.session.filteredProducts = findProducts
        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            selectedCategory: null,
            selectedBrand: null,
            selectedPrice
        })


    } catch (error) {

        console.log(error)
        res.redirect("/pageNotFound")

    }
}

const searchProducts = async (req, res) => {
    try {
        const user = req.session.user
        const userData = await User.findOne({ _id: user })
        let search = req.body.query

        const brands = await Brand.find({}).lean()
        const categories = await Category.find({ isListed: true }).lean()
        const categoryIds = categories.map(category => category._id.toString())
        let searchResult = []
        if (req.session.filteredProducts && req.session.filteredProducts.length > 0) {
            searchResult = req.session.filteredProducts.filter(product =>
                product.productName.toLowerCase().includes(search.toLowerCase())
            )
        } else {
            searchResult = await Product.find({
                productName: { $regex: ".*" + search + ".*", $options: "i" },
                isBlocked: false,
                quantity: { $gt: 0 },
                category: { $in: categoryIds }
            })

        }

        searchResult.sort((a, b) => new Date(b.createdOn) - new Date(a.createdOn))

        let selectedPrice= { gt: 0, lt: 1000000 }

        let itemsPerPage = 6;
        let currentPage = parseInt(req.query.page) || 1;
        let startIndex = (currentPage - 1) * itemsPerPage
        let endIndex = startIndex + itemsPerPage;
        let totalPages = Math.ceil(searchResult.length / itemsPerPage)
        const currentProduct = searchResult.slice(startIndex, endIndex)

        res.render("shop", {
            user: userData,
            products: currentProduct,
            category: categories,
            brand: brands,
            totalPages,
            currentPage,
            count: searchResult.length,
            search,
            selectedCategory: null,
            selectedBrand: null,
            selectedPrice

        })

    } catch (error) {

        console.log("Error:", error)
        res.redirect("/pageNotFound")

    }
}



function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString()
}
async function sendVerificationEmail(email, otp) {
    try {
        console.log("📩 Email before sending:", email);

        if (!email) {
            throw new Error("Recipient email is missing or invalid  what.");
        }
        const transporter = nodemailer.createTransport({
            service: "gmail",
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }
        })
        const info = await transporter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "verify your email account",
            text: `your OTP is ${otp}`,
            html: `<b>your OTP: ${otp}</b>`
        })

        return info.accepted.length > 0


    } catch (error) {
        console.error("sent verification mail failed", error)
        return false
    }
}

const signup = async (req, res) => {


    try {

        const { name, phone, email, password, cPassword } = req.body
        if (password !== cPassword) {
            return res.render("signup", { message: "Password do not match" })
        }
        const findUser = await User.findOne({ email })
        if (findUser) {
            return res.render("signup", { message: "User with this email already exist" })
        }
        if (req.session.userOtp && !req.session.otpExpiresAt) {
            return res.render("verify_otp", { timer: req.session.timer, otpExpiresAt: null })
        }
        if (req.session.userOtp && req.session.otpExpiresAt) {
            return res.render("verify_otp", { timer: req.session.otpExpiresAt, otpExpiresAt: null })
        }


        const otp = generateOtp()
        const emailSent = await sendVerificationEmail(email, otp)
        if (!emailSent) {
            return res.json("email-error")
        }
        req.session.userOtp = otp
        req.session.userData = { name, phone, email, password }
        req.session.timer = Date.now() + 60000; // Store expiry time (current time + 60s)
        res.render("verify_otp", { timer: req.session.timer, otpExpiresAt: null })
        console.log("OTP_Sent", otp)

    } catch (error) {
        console.error("signup error", error)
        res.status(500).redirect("/pageNotFound")
    }
}

const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash
    } catch (error) {

    }
}

const verifyOtp = async (req, res) => {
    try {
        const { otp } = req.body
        console.log(otp)
        if (otp === req.session.userOtp) {
            const user = req.session.userData
            const passwordHash = await securePassword(user.password)
            const saveUserData = new User({
                name: user.name,
                email: user.email,
                phone: user.phone,
                password: passwordHash
            })
            await saveUserData.save()
            // req.session.user = saveUserData.id
            req.session.user = {
                _id: saveUserData._id
            };

            res.json({ success: true, redirectUrl: "/" })
        } else {
            res.status(400).json({ sucess: false, message: "inavalid otp, please try again" })
        }
    } catch (error) {
        console.error("error verification on otp", error)
        res.status(500).json({ success: true, message: "an error occured" })
    }
}

const resendOtp = async (req, res) => {
    try {
        const { email } = req.session.userData
        if (!email) {
            return res.status(400).json({ success: false, message: "Email not found in session" })
        }
        const otp = generateOtp()
        req.session.userOtp = otp
        req.session.otpExpiresAt = Date.now() + 60000;
        const emailSent = await sendVerificationEmail(email, otp)
        if (emailSent) {
            console.log("resend otp", otp)
            res.status(200).json({
                success: true,
                message: "OTP Resend successfully",
                otpExpiresAt: req.session.otpExpiresAt
            })
        } else {
            res.status(500).json({ success: false, message: "failed to resend OTP, please try again" })
        }
    } catch (error) {
        console.log("ERROR sending OTP", error)
        res.status(500).json({ success: false, message: "internal server Error, please try again" })

    }
}

const loadLogin = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.render("login")
        } else {
            res.redirect("/")
        }
    } catch (error) {

        res.redirect("/pageNotFound")

    }
}

const login = async (req, res) => {
    try {
        const { email, password } = req.body
        const findUser = await User.findOne({ isAdmin: 0, email: email })
        if (!findUser) {
            return res.render("login", { message: "User not found" })
        }
        if (findUser.isBlocked) {
            return res.render("login", { message: "User is blocked" })
        }

        const passwordMatch = await bcrypt.compare(password, findUser.password)
        if (!passwordMatch) {
            return res.render("login", { message: "Incorrect password" })
        }

        req.session.user = {
            _id: findUser._id
        };
        res.redirect("/")

    } catch (error) {
        console.error("login error", error)
        res.render("login", { message: "login failed , please try" })
    }
}

const logout = async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log("session distruction error", err.message)
                return res.redirect("/pageNotFound")
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("logout error")
        res.redirect("/pageNotFound")

    }
}


module.exports = {
    loadHomepage,
    pageNotFound,
    googleAuth,
    loadSignup,
    loadShoppingPage,
    filterProduct,
    filterByPrice,
    searchProducts,
    signup,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout
}
