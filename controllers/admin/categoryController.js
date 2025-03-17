const { parse } = require("dotenv")
const Category = require("../../models/categorySchema")

const categoryInfo = async (req, res) => {
    try {
        console.log("req.query.search:", req.query.search)
        let search = ""
        if (req.query.search) {
            search = req.query.search

        }
        const page = parseInt(req.query.page) || 1;
        const limit = 4;
        const skip = (page - 1) * limit;

        const categoryData = await Category.find({
            $or: [
                { name: { $regex: search, $options: "i" } }  // Case-insensitive search
            ]
        })
            .sort({ createdAt: -1 }) // Sorting by latest created categories
            .skip(skip)  // Skipping records for pagination
            .limit(limit); // Limiting the number of records per page

        const totalCategories = await Category.countDocuments()
        const totalPages = Math.ceil(totalCategories / limit)
        res.render("category", {
            cat: categoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories,
            search:search
        })
    } catch (error) {

        console.error(error);
        res.redirect("/pageerror")

    }
}

const addCategory = async (req, res) => {
    const { name, description } = req.body
    try {
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(400).json({ error: "Category already exist" })

        }

        const newCategory = new Category({
            name,
            description
        })
        await newCategory.save()
        return res.json({ message: "Category added succesfully" })

    } catch (error) {
        return res.status(500).json({ error: "internal Server error" })
    }
}

const getListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } })
        res.redirect("/admin/category")

    } catch (error) {
        res.redirect("/pageerror")
    }
}

const getUnListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } })
        res.redirect("/admin/category")

    } catch (error) {
        res.redirect("/pageerror")
    }
}

const getEditCategory = async (req, res) => {
    try {
        const id = req.query.id;
        const category = await Category.findOne({ _id: id })
        res.render("edit-category", { category: category })

    } catch (error) {
        res.redirect("/pageerror")
    }
}

const editCategory = async (req, res) => {
    try {
        const id = req.params.id
        const { categoryName, description } = req.body
        const existingCategory = await Category.findOne({ name: categoryName })

        if (existingCategory) {
            return res.status(400).json({ error: "Category exists, please choose another name" })
        }

        const updateCategory = await Category.findByIdAndUpdate(id, {
            name: categoryName,
            description: description
        }, { new: true })

        if (updateCategory) {
            res.redirect("/admin/category")
        } else {
            res.status(404).jsom({ error: "Category not found" })
        }


    } catch (error) {
        res.status(500).json({ error: "Internal server error" })
    }
}




module.exports = {
    categoryInfo,
    addCategory,
    getListCategory,
    getUnListCategory,
    getEditCategory,
    editCategory

}