const mongoose = require("mongoose");
const Order = require("../../models/orderSchema")
const Product = require("../../models/productSchema");
const Wallet = require("../../models/walletSchema")
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const fs = require('fs');
const { Transaction } = require("mongodb");

const loadSummarypage = (req,res)=>{
    try {

           

            
        res.render("dashSummary",{
        totalSales: 0,
        totalDiscounts: 0,
        totalOrders: 0,
        topProducts:{},
        transactions:[]


        })

    } catch (error) {
        res.redirect("/pageerror")
        
    }
}
const getBestSellingProducts = async (startDate, endDate) => {
    try {
        
        const bestSellingProducts = await Order.aggregate([
            
            {
                $match: {
                    createdOn: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },

            
            { $unwind: "$orderedItems" },

            
            {
                $group: {
                    _id: "$orderedItems.productId",
                    totalQuantity: { $sum: "$orderedItems.quantity" },
                    totalRevenue: { $sum: "$orderedItems.totalPrice" }
                }
            },

            
            { $sort: { totalQuantity: -1 } },

            
            { $limit: 10 },

            
            {
                $lookup: {
                    from: "products", 
                    localField: "_id",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },

            
            { $unwind: "$productDetails" },

            
            {
                $lookup: {
                    from: "categories", 
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },

            
            { $unwind: "$categoryDetails" },

            
            {
                $project: {
                    productName: "$productDetails.productName",
                    categoryName: "$categoryDetails.name",
                    price: "$productDetails.salePrice",
                    totalQuantity: 1,
                    revenue: "$totalRevenue"
                }
            }
        ]);

        return bestSellingProducts;
    } catch (error) {
        console.error("Error fetching best selling products:", error);
        throw error;
    }
};

const getBestSellingCategories = async (startDate, endDate) => {
    try {
        const bestSellingCategories = await Order.aggregate([
            
            {
                $match: {
                    createdOn: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },

            
            { $unwind: "$orderedItems" },

            
            {
                $lookup: {
                    from: "products", 
                    localField: "orderedItems.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },

            
            { $unwind: "$productDetails" },

            
            {
                $lookup: {
                    from: "categories", 
                    localField: "productDetails.category",
                    foreignField: "_id",
                    as: "categoryDetails"
                }
            },

            
            { $unwind: "$categoryDetails" },

            
            {
                $group: {
                    _id: "$categoryDetails._id",
                    categoryName: { $first: "$categoryDetails.name" },
                    sold: { $sum: "$orderedItems.quantity" },
                    revenue: { $sum: "$orderedItems.totalPrice" }
                }
            },

            
            { $sort: { sold: -1 } },

            
            { $limit: 10 }
        ]);

        return bestSellingCategories;
    } catch (error) {
        console.error("Error fetching best selling categories:", error);
        throw error;
    }
};

const getBestSellingBrands = async (startDate, endDate) => {
    try {
        const bestSellingBrands = await Order.aggregate([
            {
                $match: {
                    createdOn: {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            { $unwind: "$orderedItems" },
            {
                $lookup: {
                    from: "products",
                    localField: "orderedItems.productId",
                    foreignField: "_id",
                    as: "productDetails"
                }
            },
            { $unwind: "$productDetails" },
            {
                $group: {
                    _id: "$productDetails.brand", 
                    totalSold: { $sum: "$orderedItems.quantity" },
                    totalRevenue: { $sum: "$orderedItems.totalPrice" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $project: {
                    brandName: "$_id",
                    totalSold: 1,
                    totalRevenue: 1
                }
            }
        ]);

        return bestSellingBrands;
    } catch (error) {
        console.error("Error fetching best-selling brands:", error);
        throw error;
    }
};


const getTransactions = async (startDate, endDate) => {
    try {
        const transactions = await Wallet.aggregate([
            
            {
                $match: {
                    "transactions.date": {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            
            
            { $unwind: "$transactions" },
            
           
            {
                $match: {
                    "transactions.date": {
                        $gte: new Date(startDate),
                        $lte: new Date(endDate)
                    }
                }
            },
            
            
            {
                $lookup: {
                    from: "users", 
                    localField: "userId",
                    foreignField: "_id",
                    as: "user"
                }
            },
            
            
            { $unwind: "$user" },
            
            
            {
                $project: {
                    _id: "$transactions._id",
                    userId: {
                        _id: "$user._id",
                        name: "$user.name",
                        email: "$user.email",
                        phone: "$user.phone"
                    },
                    amount: "$transactions.amount",
                    type: "$transactions.type",
                    description: "$transactions.description",
                    date: "$transactions.date",
                    orderId: "$transactions.orderId"
                }
            },
            
            
            { $sort: { date: -1 } }
        ]);

        return transactions;
    } catch (error) {
        console.error("Error fetching transactions:", error);
        throw error;
    }
};



const calculateSalesData = async (startDate, endDate) => {
    try {
        
        const orders = await Order.find({
            createdOn: { $gte: startDate, $lte: endDate },
        });

        
        const totalSales = orders.reduce((sum, order) => sum + order.finalAmount, 0);
        const totalDiscounts = orders.reduce((sum, order) => sum + order.discount, 0);
        const totalOrders = orders.length;

        return {
            totalSales,
            totalDiscounts,
            totalOrders,
        };
    } catch (error) {
        console.error("Error calculating sales data:", error);
        throw error;
    }
};

const parseISOWeek = (weekString) => {
    const [year, week] = weekString.split("-W"); 
    const startOfYear = new Date(year, 0, 1); 
    const startOfWeek = new Date(startOfYear); 

    
    startOfWeek.setDate(startOfWeek.getDate() + (week - 1) * 7 - startOfYear.getDay());
    return startOfWeek;
};



const salesSummaryReport = async (req, res) => {
    try {
        console.log("yes")
        const { period, date, week, year, startDate, endDate } = req.query;
        const yearValue = Array.isArray(year) ? year[0] : year;

        
        if (period === "daily" && !date) {
            return res.status(400).json({ error: "Date is required for daily reports." });
        }
        if (period === "weekly" && !week) {
            return res.status(400).json({ error: "Week is required for weekly reports." });
        }
        if (period === "yearly" && !yearValue) {
            return res.status(400).json({ error: "Year is required for yearly reports." });
        }
        if (period === "custom" && (!startDate || !endDate)) {
            return res.status(400).json({ error: "Start date and end date are required for custom reports." });
        }

        
        let start, end;

       
        switch (period) {
            case "daily":
                start = new Date(date);
                start.setHours(0, 0, 0, 0); 
                end = new Date(date);
                end.setHours(23, 59, 59, 999); 
                break;

            case "weekly":
                const startOfWeek = parseISOWeek(week);
                start = new Date(startOfWeek);
                start.setDate(start.getDate() - start.getDay());
                start.setHours(0, 0, 0, 0);
                end = new Date(start);
                end.setDate(end.getDate() + 6); 
                end.setHours(23, 59, 59, 999);
                break;

            case "yearly":
                start = new Date(yearValue, 0, 1); 
                start.setHours(0, 0, 0, 0);
                end = new Date(yearValue, 11, 31); 
                end.setHours(23, 59, 59, 999);
                break;

            case "custom":
                start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                break;

            default:
                return res.status(400).json({ error: "Invalid period selected." });
        }

       
        const reportData = await calculateSalesData(start, end);
        const topProducts = await getBestSellingProducts(start, end);
        const topCategories = await getBestSellingCategories(start, end)
        const topBrands = await getBestSellingBrands(start, end)
        const transactions = await getTransactions(start, end)

        console.log("topProducts:",topProducts)
        console.log("topBrands:",topBrands)

        console.log("here is the tansaction data",transactions)

        

        res.json({reportData,topProducts,transactions,topCategories,topBrands});
    } catch (error) {
        console.error("Error generating sales report:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};








module.exports = {
    loadSummarypage,
    salesSummaryReport
}