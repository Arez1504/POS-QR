// backend/src/routes/dashboardRoutes.js
const express = require('express');
const router  = express.Router();
const db      = require('../config/db');
const { verifyToken } = require('../middleware/authMiddleware');

router.use(verifyToken); // tất cả roles được phép

// GET /api/dashboard/stats?date=YYYY-MM-DD
router.get('/stats', async (req, res) => {
  try {
    const date = req.query.date || new Date().toISOString().slice(0, 10);

    // Doanh thu & đơn hàng hôm nay
    const [[today]] = await db.query(`
      SELECT
        COUNT(*)                      AS total_orders,
        COALESCE(SUM(total_amount),0) AS total_revenue,
        COALESCE(AVG(total_amount),0) AS avg_order_value,
        SUM(order_status = 'completed')  AS completed_orders,
        SUM(order_status = 'cancelled')  AS cancelled_orders
      FROM orders
      WHERE DATE(created_at) = ?
    `, [date]);

    // Hôm qua
    const yesterday = new Date(new Date(date).getTime() - 86400000).toISOString().slice(0, 10);
    const [[prev]] = await db.query(`
      SELECT
        COUNT(*)                      AS total_orders,
        COALESCE(SUM(total_amount),0) AS total_revenue
      FROM orders
      WHERE DATE(created_at) = ? AND order_status != 'cancelled'
    `, [yesterday]);

    // Tồn kho cảnh báo
    const [[stock]] = await db.query(`
      SELECT
        SUM(stock_quantity = 0)                          AS out_of_stock,
        SUM(stock_quantity <= min_stock AND stock_quantity > 0) AS low_stock
      FROM products WHERE is_active = TRUE
    `);

    // Nhân viên hoạt động hôm nay
    const [[staff]] = await db.query(`
      SELECT COUNT(DISTINCT cashier_id) AS active_cashiers
      FROM orders WHERE DATE(created_at) = ?
    `, [date]);

    const todayRevenue = Number(today.total_revenue);
    const prevRevenue  = Number(prev.total_revenue);
    const todayOrders  = Number(today.total_orders);
    const prevOrders   = Number(prev.total_orders);

    res.json({
      success: true,
      data: {
        date,
        today: {
          total_orders:    todayOrders,
          total_revenue:   todayRevenue,
          avg_order_value: Number(today.avg_order_value),
          completed_orders: Number(today.completed_orders),
          cancelled_orders: Number(today.cancelled_orders),
        },
        growth: {
          revenue: prevRevenue > 0
            ? ((todayRevenue - prevRevenue) / prevRevenue * 100).toFixed(1)
            : null,
          orders: prevOrders > 0
            ? ((todayOrders - prevOrders) / prevOrders * 100).toFixed(1)
            : null,
        },
        stock_warning: {
          out_of_stock: Number(stock.out_of_stock),
          low_stock:    Number(stock.low_stock),
        },
        active_cashiers: Number(staff.active_cashiers),
      }
    });
  } catch (err) {
    console.error('dashboard/stats error:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

// GET /api/dashboard/top-products?date=YYYY-MM-DD&limit=5
router.get('/top-products', async (req, res) => {
  try {
    const date  = req.query.date  || new Date().toISOString().slice(0, 10);
    const limit = Math.min(20, parseInt(req.query.limit) || 5);

    const [rows] = await db.query(`
      SELECT
        oi.product_id,
        oi.product_name,
        SUM(oi.quantity)              AS total_qty,
        SUM(oi.subtotal)              AS total_revenue,
        COUNT(DISTINCT oi.order_id)   AS order_count
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.order_status != 'cancelled'
        AND DATE(o.created_at) = ?
      GROUP BY oi.product_id, oi.product_name
      ORDER BY total_qty DESC
      LIMIT ${limit}
    `, [date]);

    res.json({
      success: true,
      data: rows.map(r => ({
        product_id:    r.product_id,
        product_name:  r.product_name,
        total_qty:     Number(r.total_qty),
        total_revenue: Number(r.total_revenue),
        order_count:   Number(r.order_count),
      }))
    });
  } catch (err) {
    console.error('dashboard/top-products error:', err.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + err.message });
  }
});

module.exports = router;
