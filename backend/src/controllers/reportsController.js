// backend/src/controllers/reportsController.js
const db = require('../config/db');

// ── GET /api/reports/overview - Tổng quan KPI ────────────────────────────────
const getOverview = async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date(new Date().setDate(1)).toISOString().slice(0, 10); // đầu tháng
    const dateTo   = to   || new Date().toISOString().slice(0, 10);                      // hôm nay

    // Doanh thu, đơn hàng, khách hàng, doanh thu tiền mặt trong kỳ
    const [[current]] = await db.query(`
      SELECT
        COUNT(CASE WHEN order_status != 'cancelled' THEN 1 END) AS total_orders,
        COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS total_revenue,
        COALESCE(AVG(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE NULL END), 0) AS avg_order_value,
        COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) AS cancelled_orders,
        COUNT(DISTINCT CASE WHEN order_status != 'cancelled' THEN COALESCE(customer_id, CONCAT('order_', id)) END) AS total_customers,
        COALESCE(SUM(CASE WHEN order_status != 'cancelled' AND payment_method = 'cash' THEN total_amount ELSE 0 END), 0) AS cash_revenue
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ?
    `, [dateFrom, dateTo]);

    // Kỳ trước (cùng số ngày)
    const days  = Math.max(1, Math.round((new Date(dateTo) - new Date(dateFrom)) / 86400000) + 1);
    const prevTo   = new Date(new Date(dateFrom).getTime() - 86400000).toISOString().slice(0, 10);
    const prevFrom = new Date(new Date(dateFrom).getTime() - days * 86400000).toISOString().slice(0, 10);

    const [[prev]] = await db.query(`
      SELECT
        COUNT(CASE WHEN order_status != 'cancelled' THEN 1 END) AS total_orders,
        COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS total_revenue,
        COALESCE(AVG(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE NULL END), 0) AS avg_order_value,
        COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) AS cancelled_orders,
        COUNT(DISTINCT CASE WHEN order_status != 'cancelled' THEN COALESCE(customer_id, CONCAT('order_', id)) END) AS total_customers
      FROM orders
      WHERE DATE(created_at) BETWEEN ? AND ?
    `, [prevFrom, prevTo]);

    // Tồn kho cảnh báo
    const [[stockWarning]] = await db.query(`
      SELECT SUM(stock_quantity = 0) AS out_of_stock,
             SUM(stock_quantity <= min_stock AND stock_quantity > 0) AS low_stock
      FROM products WHERE is_active = TRUE
    `);

    // Nhân viên hoạt động
    const [[staffStats]] = await db.query(`
      SELECT COUNT(DISTINCT cashier_id) AS active_cashiers
      FROM orders WHERE DATE(created_at) BETWEEN ? AND ?
    `, [dateFrom, dateTo]);

    // Helper tính tăng trưởng
    const calcGrowth = (curr, prevVal) => {
      if (prevVal === undefined || prevVal === null || Number(prevVal) === 0) return null;
      return (((Number(curr) - Number(prevVal)) / Number(prevVal)) * 100).toFixed(1);
    };

    res.json({
      success: true,
      data: {
        period: { from: dateFrom, to: dateTo, days },
        current: {
          total_orders:    Number(current.total_orders),
          total_revenue:   Number(current.total_revenue),
          avg_order_value: Number(current.avg_order_value),
          cancelled_orders: Number(current.cancelled_orders),
          total_customers:  Number(current.total_customers),
          cash_revenue:     Number(current.cash_revenue)
        },
        prev: {
          total_orders:    Number(prev.total_orders),
          total_revenue:   Number(prev.total_revenue),
          avg_order_value: Number(prev.avg_order_value),
          cancelled_orders: Number(prev.cancelled_orders),
          total_customers:  Number(prev.total_customers)
        },
        growth: {
          revenue:   calcGrowth(current.total_revenue, prev.total_revenue),
          orders:    calcGrowth(current.total_orders, prev.total_orders),
          customers: calcGrowth(current.total_customers, prev.total_customers),
          aov:       calcGrowth(current.avg_order_value, prev.avg_order_value),
          cancelled: calcGrowth(current.cancelled_orders, prev.cancelled_orders)
        },
        stock_warning: {
          out_of_stock: Number(stockWarning.out_of_stock),
          low_stock:    Number(stockWarning.low_stock),
        },
        active_cashiers: Number(staffStats.active_cashiers),
      }
    });
  } catch (error) {
    console.error('getOverview error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ── GET /api/reports/revenue - Doanh thu theo ngày ───────────────────────────
const getRevenue = async (req, res) => {
  try {
    const { from, to, group_by = 'day' } = req.query;
    const dateFrom = from || new Date(new Date().setDate(1)).toISOString().slice(0, 10);
    const dateTo   = to   || new Date().toISOString().slice(0, 10);

    let groupExpr = 'DATE(created_at)';
    let labelExpr = 'DATE(created_at)';
    if (group_by === 'month') { groupExpr = labelExpr = 'DATE_FORMAT(created_at, "%Y-%m")'; }
    if (group_by === 'week')  { groupExpr = 'YEARWEEK(created_at, 1)'; labelExpr = 'DATE_FORMAT(MIN(created_at), "%Y-%m-%d")'; }

    const [rows] = await db.query(`
      SELECT
        ${labelExpr}                    AS label,
        COUNT(*)                        AS orders,
        COALESCE(SUM(total_amount),0)   AS revenue,
        COALESCE(AVG(total_amount),0)   AS avg_value
      FROM orders
      WHERE order_status != 'cancelled'
        AND DATE(created_at) BETWEEN ? AND ?
      GROUP BY ${groupExpr}
      ORDER BY ${groupExpr} ASC
    `, [dateFrom, dateTo]);

    res.json({ success: true, data: rows.map(r => ({
      label:   r.label,
      orders:  Number(r.orders),
      revenue: Number(r.revenue),
      avg:     Number(r.avg_value),
    }))});
  } catch (error) {
    console.error('getRevenue error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ── GET /api/reports/top-products - Sản phẩm bán chạy ───────────────────────
const getTopProducts = async (req, res) => {
  try {
    const { from, to, limit = 10 } = req.query;
    const dateFrom = from || new Date(new Date().setDate(1)).toISOString().slice(0, 10);
    const dateTo   = to   || new Date().toISOString().slice(0, 10);
    const lim      = Math.min(50, parseInt(limit) || 10);

    const [rows] = await db.query(`
      SELECT
        oi.product_id,
        oi.product_name,
        SUM(oi.quantity)  AS total_qty,
        SUM(oi.subtotal)  AS total_revenue,
        COUNT(DISTINCT oi.order_id) AS order_count
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      WHERE o.order_status != 'cancelled'
        AND DATE(o.created_at) BETWEEN ? AND ?
      GROUP BY oi.product_id, oi.product_name
      ORDER BY total_qty DESC
      LIMIT ${lim}
    `, [dateFrom, dateTo]);

    res.json({ success: true, data: rows.map(r => ({
      product_id:    r.product_id,
      product_name:  r.product_name,
      total_qty:     Number(r.total_qty),
      total_revenue: Number(r.total_revenue),
      order_count:   Number(r.order_count),
    }))});
  } catch (error) {
    console.error('getTopProducts error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ── GET /api/reports/by-cashier - Doanh thu theo nhân viên ───────────────────
const getByCashier = async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date(new Date().setDate(1)).toISOString().slice(0, 10);
    const dateTo   = to   || new Date().toISOString().slice(0, 10);

    const [rows] = await db.query(`
      SELECT
        u.id, u.full_name, u.username,
        COUNT(o.id)               AS total_orders,
        COALESCE(SUM(o.total_amount),0) AS total_revenue
      FROM users u
      LEFT JOIN orders o ON o.cashier_id = u.id
        AND o.order_status != 'cancelled'
        AND DATE(o.created_at) BETWEEN ? AND ?
      WHERE u.is_active = TRUE AND u.role IN ('cashier','admin')
      GROUP BY u.id, u.full_name, u.username
      ORDER BY total_revenue DESC
    `, [dateFrom, dateTo]);

    res.json({ success: true, data: rows.map(r => ({
      id: r.id, full_name: r.full_name, username: r.username,
      total_orders:  Number(r.total_orders),
      total_revenue: Number(r.total_revenue),
    }))});
  } catch (error) {
    console.error('getByCashier error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ── GET /api/reports/payment-methods - Tỷ lệ phương thức thanh toán ──────────
const getPaymentMethods = async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date(new Date().setDate(1)).toISOString().slice(0, 10);
    const dateTo   = to   || new Date().toISOString().slice(0, 10);

    const [rows] = await db.query(`
      SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(total_amount),0) AS revenue
      FROM orders
      WHERE order_status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ?
      GROUP BY payment_method
    `, [dateFrom, dateTo]);

    res.json({ success: true, data: rows.map(r => ({
      method: r.payment_method,
      count:   Number(r.count),
      revenue: Number(r.revenue),
    }))});
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── GET /api/reports/category-revenue - Doanh thu theo danh mục ───────────────
const getCategoryRevenue = async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date(new Date().setDate(1)).toISOString().slice(0, 10);
    const dateTo   = to   || new Date().toISOString().slice(0, 10);

    const [rows] = await db.query(`
      SELECT 
        COALESCE(c.name, 'Chưa phân loại') AS category,
        COALESCE(SUM(oi.subtotal), 0) AS revenue,
        COALESCE(SUM(oi.quantity), 0) AS quantity
      FROM order_items oi
      INNER JOIN orders o ON oi.order_id = o.id
      LEFT JOIN products p ON oi.product_id = p.id
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE o.order_status != 'cancelled'
        AND DATE(o.created_at) BETWEEN ? AND ?
      GROUP BY c.name, p.category_id
      ORDER BY revenue DESC
    `, [dateFrom, dateTo]);

    res.json({
      success: true,
      data: rows.map(r => ({
        category: r.category,
        revenue: Number(r.revenue),
        quantity: Number(r.quantity)
      }))
    });
  } catch (error) {
    console.error('getCategoryRevenue error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ── GET /api/reports/revenue-by-shift - Doanh thu theo ca ─────────────────────
const getRevenueByShift = async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFrom = from || new Date(new Date().setDate(1)).toISOString().slice(0, 10);
    const dateTo   = to   || new Date().toISOString().slice(0, 10);

    // Query shifts in the period
    const [rows] = await db.query(`
      SELECT 
        s.id,
        s.user_id,
        s.start_time,
        s.end_time,
        u.full_name AS cashier_name,
        DATE_FORMAT(s.start_time, '%d/%m') AS label,
        COALESCE(s.total_sales, 0) AS revenue,
        s.total_orders AS orders
      FROM shifts s
      INNER JOIN users u ON s.user_id = u.id
      WHERE DATE(s.start_time) BETWEEN ? AND ?
      ORDER BY s.start_time ASC
    `, [dateFrom, dateTo]);

    const results = [];
    for (const shift of rows) {
      if (shift.end_time === null) {
        // Open shift: calculate actual sales from orders table
        const [[stats]] = await db.query(`
          SELECT COALESCE(SUM(total_amount), 0) AS total_sales, COUNT(id) AS total_orders
          FROM orders
          WHERE cashier_id = ? AND order_status != 'cancelled' AND created_at >= ?
        `, [shift.user_id, shift.start_time]);
        results.push({
          id: shift.id,
          cashier_name: shift.cashier_name,
          label: shift.label,
          revenue: Number(stats.total_sales),
          orders: Number(stats.total_orders),
          start_time: shift.start_time
        });
      } else {
        results.push({
          id: shift.id,
          cashier_name: shift.cashier_name,
          label: shift.label,
          revenue: Number(shift.revenue),
          orders: Number(shift.orders),
          start_time: shift.start_time
        });
      }
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('getRevenueByShift error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

module.exports = { 
  getOverview, 
  getRevenue, 
  getTopProducts, 
  getByCashier, 
  getPaymentMethods,
  getCategoryRevenue,
  getRevenueByShift
};
