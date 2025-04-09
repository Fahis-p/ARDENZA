
const Order = require("../../models/orderSchema")


const dashboardData = async (req,res)=>{

    try {
        const period = req.query.period || 'monthly';
        
        if (!['daily', 'weekly', 'monthly', 'yearly'].includes(period)) {
            return res.status(400).json({ error: 'Invalid period parameter' });
        }

        
    let dateFilter = {};

    
    const now = new Date();
    switch (period) {
      case 'weekly':
        dateFilter = { createdOn: { $gte: new Date(now.setDate(now.getDate() - 7)) } };
        break;
      case 'yearly':
        dateFilter = { createdOn: { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) } };
        break;
      case 'daily':
        dateFilter = { createdOn: { $gte: new Date(now.setDate(now.getDate() - 1)) } };
        break;
      default: // monthly
        dateFilter = { createdOn: { $gte: new Date(now.setMonth(now.getMonth() - 1)) } };
    }

    console.log("dateFilter",dateFilter)

      const totalRevenue = await Order.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, total: { $sum: '$currentAmount' } } }
        ])
     
      const  totalCustomers = await  Order.aggregate([
            { $match: dateFilter },
            { $group: { _id: '$userId' } },
            { $count: 'total' }
          ])

      const totalOrders = await  Order.countDocuments(dateFilter)

      const salesByDate = await Order.aggregate([
        { $match: dateFilter },
        { $group: { 
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdOn' } },
          total: { $sum: '$currentAmount' }
        }},
        { $sort: { _id: 1 } }
      ])

      const customerGrowth = await Order.aggregate([
        { $match: dateFilter },
        { $group: { 
          _id: { 
            $dateToString: { format: '%Y-%m-%d', date: '$createdOn' } 
          },
          count: { $addToSet: '$userId' } 
        }},
        { $project: {
          _id: '$_id',
          count: { $size: '$count' } 
        }},
        { $sort: { _id: 1 } }
      ])

      const topCategories = await Order.aggregate([
        { $match: dateFilter },
        { $unwind: '$orderedItems' },
        { $lookup: {
          from: 'products',
          localField: 'orderedItems.productId',
          foreignField: '_id',
          as: 'productDetails'
        }},
        { $unwind: '$productDetails' },
        { $lookup: {
          from: 'categories', 
          localField: 'productDetails.category',
          foreignField: '_id',
          as: 'categoryDetails'
        }},
        { $unwind: '$categoryDetails' },
        { $group: { 
          _id: '$categoryDetails.name', 
          totalSales: { $sum: '$orderedItems.totalPrice' }
        }},
        { $sort: { totalSales: -1 } },
        { $limit: 5 }
      ])

      console.log("topCategories",topCategories)

      const topProducts = await Order.aggregate([
        { $match: dateFilter }, 
        { $unwind: '$orderedItems' }, 
        { $lookup: { 
          from: 'products',
          localField: 'orderedItems.productId',
          foreignField: '_id',
          as: 'productDetails'
        }},
        { $unwind: '$productDetails' }, 
        { $group: { 
          _id: '$productDetails.productName', 
          totalQuantity: { $sum: '$orderedItems.quantity' } 
        }},
        { $sort: { totalQuantity: -1 } },
        { $limit: 5 } 
      ]);
      

      console.log("topProducts",topProducts)


      let recentOrders = await  Order.find(dateFilter)
      .sort({ createdOn: -1 })
      .limit(5)
      .populate({
        path: 'orderedItems.productId',
        select: 'productName salePrice' 
      })
      .populate('userId', 'name email') 
      .lean()


      recentOrders = recentOrders.map(order => ({
        ...order,
        orderedItems: order.orderedItems.filter(item =>
          ["delivered","processing", "shipped", "Rejected"].includes(item.itemStatus)
        )
      }));

      console.log("recentOrders",recentOrders[0].orderedItems)

      

      

      const response = {
        totalRevenue: totalRevenue[0]?.total || 0,
        totalCustomers: totalCustomers[0]?.total || 0,
        totalOrders,
        salesByDate,
        customerGrowth,
        topCategories,
        topProducts,
        recentOrders
      }
          
      
          res.json(response);


    } catch (error) {
        console.error('Error generating dashboard data:', error);
        res.status(500).json({ error: 'Internal server error' });
    }

}








module.exports = {
    dashboardData
}