const Product = require("../../models/productSchema")
const Category = require("../../models/categorySchema")
const Brand = require("../../models/brandSchema")
const User = require("../../models/userSchema")
const fs = require("fs")
const path = require("path")
const sharp = require("sharp")



const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true })
        const brand = await Brand.find({ isBlocked: false })
        res.render("product-add", {
            cat: category,
            brand: brand
        })

    } catch (error) {
        res.redirect("/pageerror")
    }
}

const addProducts = async (req, res) => {
    try {
        console.log("Received files in add product:", req.files);
        const products = req.body;
        console.log("products:",products)
        const productExists = await Product.findOne({
            productName: products.productName,
        });
        if (!productExists) {
            const images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
                    await sharp(originalImagePath).resize({ width: 440, height: 440 }).toFile(resizedImagePath)
                    images.push(req.files[i].filename)
                }
            }

            const categoryId = await Category.findOne({ name: products.category })
            if (!categoryId) {
                return res.status(400).join("Invalid category name")

            }
            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                brand: products.brand,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                createdAt: new Date(),
                quantity: products.quantity,
                size: products.size,
                color: products.color,
                productImage: images,
                status: 'Available'



            });
            await newProduct.save();
            return res.redirect("/admin/addProducts")

        } else {
            return res.status(400).json("Product already exist,please try with another name")
        }

    } catch (error) {
        console.error("Error saving product", error);
        return res.redirect("/admin/pageerror")
    }

}

const getAllProducts = async (req,res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 4;

        const productData = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }

            ]
        }).limit(limit * 1)
        .skip((page - 1) * limit)
        .populate('category')
        .exec();


        const count = await Product.find({
            $or: [
                { productName: { $regex: new RegExp(".*" + search + ".*", "i") } },
                { brand: { $regex: new RegExp(".*" + search + ".*", "i") } }

            ]
        }).countDocuments();
        
        const category = await Category.find({isListed:true})
        const brand = await Brand.find({isBlocked:false})
        
        if(category && brand){
            res.render("products",{
                data:productData,
                currentPage:page,
                totalPages:Math.ceil(count/limit),
                cat:category,
                brand:brand,
                search:search


            })
        }else{
            res.render("page-404")
        }

    } catch (error) {

        res.redirect("/admin/pageerror")

    }
}


const blockProduct = async (req,res)=>{
    try{
        let id = req.query.id
        await Product.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect("/admin/products")
    }catch(error){
       res.redirect("/admin/pageerror")
    }
}

const unblockProduct = async (req,res)=>{
    try{
        let id = req.query.id
        await Product.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect("/admin/products")
    }catch(error){
       res.redirect("/admin/pageerror")
    }
}

const getEditProduct = async (req,res)=>{
    try{
        const id = req.query.id
        const product = await Product.findOne({_id:id})
        const category = await Category.find({})
        const brand = await Brand.find({})
        res.render("edit-product",{
            product:product,
            cat:category,
            brand:brand
        })

    }catch (error){
        res.redirect("/admin/pageerror")
    }
}

const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        const data = req.body;

        // Check if a product with the same name already exists (excluding the current product)
        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        if (existingProduct) {
            return res.status(400).json({ error: "Product with this name already exists. Please try with another name" });
        }

        // Initialize an array to hold the updated image filenames
        let updatedImages = [...product.productImage]; // Copy the existing images

        // If new images are uploaded, replace the specific images in the array
        if (req.files && req.files.length > 0) {
            let imageIndexes = Array.isArray(data.imageIndexes) ? data.imageIndexes : [data.imageIndexes];
            
            imageIndexes = imageIndexes.filter(num => num !== '' && Number(num) > 0);

            req.files.forEach((file, i) => {
                const index = parseInt(imageIndexes[i]) - 1; // Convert to zero-based index
                if (index >= 0 && index < updatedImages.length) {
                    updatedImages[index] = file.filename; // Replace the specific image
                } else {
                    updatedImages.push(file.filename); // Add new image if index is out of bounds
                }
            });
        }

        // Prepare the update fields
        const updateFields = {
            productName: data.productName,
            description: data.description,
            brand: data.brand,
            category: product.category, // Assuming category is not being updated
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            quantity: data.quantity,
            size: data.size,
            color: data.color,
            productImage: updatedImages, // Update the productImage array
        };

        // Update the product in the database
        await Product.findByIdAndUpdate(id, updateFields, { new: true });

        // Redirect to the products page
        res.redirect("/admin/products");

    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};


const deleteSingleImage = async (req,res)=>{
    try {
        
        const {imageNameToServer,productIdToServer} = req.body;
        const product = await Product.findByIdAndUpdate(productIdToServer,{$pull:{productImage:imageNameToServer}})
        const imagePath = path.join("public","uploads","re-image",imageNameToServer)
        if(fs.existsSync(imagePath)){
            await fs.unlinkSync(imagePath)
            console.log(`Image ${imageNameToServer} deleted successfully`)

        }else {
            console.log(`Image ${imageNameToServer} not found`)
        }

       res.send({status:true})


    } catch (error) {

        res.redirect("/pageerror")
        
    }
}



module.exports = {
    getProductAddPage,
    addProducts,
    getAllProducts,
    blockProduct,
    unblockProduct,
    getEditProduct,
    editProduct,
    deleteSingleImage
}