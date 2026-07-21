// backend/src/controllers/aiTools.js
// 7 hàm truy vấn dữ liệu READ-ONLY cho AI function calling
const db = require('../config/db');

// ── TOOL DEFINITIONS (gửi cho Gemini) ─────────────────────────────────────────
const toolDefinitions = [
  {
    name: 'get_sales_summary',
    description: 'Lấy tổng kết doanh thu, số đơn hàng, giá trị trung bình đơn trong một khoảng thời gian. Dùng khi người dùng hỏi về doanh thu, doanh số, bán được bao nhiêu.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month', 'custom'],
          description: 'Khoảng thời gian. Dùng "today" cho hôm nay, "yesterday" cho hôm qua, v.v.'
        },
        from_date: { type: 'string', description: 'Ngày bắt đầu format YYYY-MM-DD (chỉ cần khi period=custom)' },
        to_date: { type: 'string', description: 'Ngày kết thúc format YYYY-MM-DD (chỉ cần khi period=custom)' }
      },
      required: ['period']
    }
  },
  {
    name: 'get_inventory_alerts',
    description: 'Lấy danh sách sản phẩm sắp hết hàng (tồn kho thấp) hoặc đã hết hàng. Dùng khi người dùng hỏi về tồn kho, hàng sắp hết, cần nhập thêm.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['all', 'out_of_stock', 'low_stock'],
          description: '"out_of_stock" = hết hàng (tồn = 0), "low_stock" = sắp hết, "all" = cả hai'
        },
        limit: { type: 'number', description: 'Số lượng kết quả tối đa (mặc định 10)' }
      },
      required: ['type']
    }
  },
  {
    name: 'get_top_products',
    description: 'Lấy danh sách sản phẩm bán chạy nhất theo doanh thu hoặc số lượng. Dùng khi người dùng hỏi sản phẩm bán chạy, top sản phẩm.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'this_week', 'this_month', 'last_month', 'all_time'],
          description: 'Khoảng thời gian thống kê'
        },
        sort_by: {
          type: 'string',
          enum: ['revenue', 'quantity'],
          description: 'Sắp xếp theo doanh thu hoặc số lượng bán'
        },
        limit: { type: 'number', description: 'Số sản phẩm top (mặc định 5)' }
      },
      required: ['period']
    }
  },
  {
    name: 'get_customer_info',
    description: 'Lấy thông tin khách hàng thành viên: tổng chi tiêu, điểm tích lũy, số đơn. Dùng khi người dùng hỏi về khách hàng, thành viên, điểm thưởng.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Tên hoặc số điện thoại khách hàng để tìm. Để trống = lấy tổng quan.' },
        top: { type: 'number', description: 'Lấy top N khách hàng chi tiêu nhiều nhất (mặc định 5)' }
      }
    }
  },
  {
    name: 'get_cashier_performance',
    description: 'Lấy hiệu suất làm việc của nhân viên thu ngân: số đơn, doanh thu, giá trị trung bình. Dùng khi hỏi hiệu suất nhân viên, ai bán giỏi nhất.',
    parameters: {
      type: 'object',
      properties: {
        period: {
          type: 'string',
          enum: ['today', 'this_week', 'this_month'],
          description: 'Khoảng thời gian đánh giá'
        }
      },
      required: ['period']
    }
  },
  {
    name: 'get_shift_info',
    description: 'Lấy thông tin ca làm việc: ca hiện tại đang mở, ca gần nhất, lịch sử ca. Dùng khi hỏi về ca làm, ai đang trực, tiền két.',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['current', 'recent', 'today'],
          description: '"current" = ca đang mở, "recent" = ca gần nhất, "today" = tất cả ca hôm nay'
        }
      },
      required: ['type']
    }
  },
  {
    name: 'get_business_insights',
    description: 'Phân tích xu hướng kinh doanh: so sánh kỳ trước, tỷ lệ thanh toán, khung giờ bán chạy, tốc độ tăng trưởng. Dùng khi hỏi phân tích, xu hướng, gợi ý kinh doanh.',
    parameters: {
      type: 'object',
      properties: {
        aspect: {
          type: 'string',
          enum: ['growth', 'payment_methods', 'peak_hours', 'overview'],
          description: '"growth" = so sánh tăng trưởng, "payment_methods" = tỷ lệ thanh toán, "peak_hours" = khung giờ, "overview" = tổng quan'
        }
      },
      required: ['aspect']
    }
  }
];

// ── HELPER: Tính ngày theo period ─────────────────────────────────────────────
function getDateRange(period, fromDate, toDate) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  switch (period) {
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = new Date(now); y.setDate(y.getDate() - 1);
      const yd = y.toISOString().slice(0, 10);
      return { from: yd, to: yd };
    }
    case 'this_week': {
      const d = now.getDay() || 7; // Monday = 1
      const mon = new Date(now); mon.setDate(now.getDate() - d + 1);
      return { from: mon.toISOString().slice(0, 10), to: today };
    }
    case 'last_week': {
      const d = now.getDay() || 7;
      const lastMon = new Date(now); lastMon.setDate(now.getDate() - d - 6);
      const lastSun = new Date(now); lastSun.setDate(now.getDate() - d);
      return { from: lastMon.toISOString().slice(0, 10), to: lastSun.toISOString().slice(0, 10) };
    }
    case 'this_month': {
      const fm = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { from: fm, to: today };
    }
    case 'last_month': {
      const fm = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10);
      const lm = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      return { from: fm, to: lm };
    }
    case 'all_time':
      return { from: '2020-01-01', to: today };
    case 'custom':
      return { from: fromDate || today, to: toDate || today };
    default:
      return { from: today, to: today };
  }
}

// ── TOOL IMPLEMENTATIONS ──────────────────────────────────────────────────────

async function get_sales_summary({ period, from_date, to_date }) {
  const { from, to } = getDateRange(period, from_date, to_date);

  const [[current]] = await db.query(`
    SELECT
      COUNT(CASE WHEN order_status != 'cancelled' THEN 1 END) AS total_orders,
      COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS total_revenue,
      COALESCE(AVG(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE NULL END), 0) AS avg_order_value,
      COUNT(CASE WHEN order_status = 'cancelled' THEN 1 END) AS cancelled_orders,
      COALESCE(SUM(CASE WHEN order_status != 'cancelled' AND payment_method = 'cash' THEN total_amount ELSE 0 END), 0) AS cash_revenue,
      COALESCE(SUM(CASE WHEN order_status != 'cancelled' AND payment_method = 'qr_transfer' THEN total_amount ELSE 0 END), 0) AS qr_revenue
    FROM orders
    WHERE DATE(created_at) BETWEEN ? AND ?
  `, [from, to]);

  // Kỳ trước để so sánh
  const days = Math.max(1, Math.round((new Date(to) - new Date(from)) / 86400000) + 1);
  const prevTo = new Date(new Date(from).getTime() - 86400000).toISOString().slice(0, 10);
  const prevFrom = new Date(new Date(from).getTime() - days * 86400000).toISOString().slice(0, 10);

  const [[prev]] = await db.query(`
    SELECT
      COUNT(CASE WHEN order_status != 'cancelled' THEN 1 END) AS total_orders,
      COALESCE(SUM(CASE WHEN order_status != 'cancelled' THEN total_amount ELSE 0 END), 0) AS total_revenue
    FROM orders
    WHERE DATE(created_at) BETWEEN ? AND ?
  `, [prevFrom, prevTo]);

  const growthRevenue = Number(prev.total_revenue) > 0
    ? (((Number(current.total_revenue) - Number(prev.total_revenue)) / Number(prev.total_revenue)) * 100).toFixed(1)
    : null;

  return {
    period: { from, to, days },
    total_orders: Number(current.total_orders),
    total_revenue: Number(current.total_revenue),
    avg_order_value: Math.round(Number(current.avg_order_value)),
    cancelled_orders: Number(current.cancelled_orders),
    cash_revenue: Number(current.cash_revenue),
    qr_revenue: Number(current.qr_revenue),
    comparison: {
      prev_revenue: Number(prev.total_revenue),
      prev_orders: Number(prev.total_orders),
      revenue_growth_percent: growthRevenue
    }
  };
}

async function get_inventory_alerts({ type = 'all', limit = 10 }) {
  const lim = Math.min(30, limit);
  let where = 'WHERE p.is_active = TRUE';

  if (type === 'out_of_stock') {
    where += ' AND p.stock_quantity = 0';
  } else if (type === 'low_stock') {
    where += ' AND p.stock_quantity > 0 AND p.stock_quantity <= COALESCE(p.min_stock, 5)';
  } else {
    where += ' AND p.stock_quantity <= COALESCE(p.min_stock, 5)';
  }

  const [rows] = await db.query(`
    SELECT p.id, p.name, p.sku, p.barcode, p.stock_quantity, 
           COALESCE(p.min_stock, 5) AS min_stock, p.price
    FROM products p
    ${where}
    ORDER BY p.stock_quantity ASC
    LIMIT ${lim}
  `);

  const [[counts]] = await db.query(`
    SELECT 
      SUM(CASE WHEN stock_quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock_count,
      SUM(CASE WHEN stock_quantity > 0 AND stock_quantity <= COALESCE(min_stock, 5) THEN 1 ELSE 0 END) AS low_stock_count
    FROM products WHERE is_active = TRUE
  `);

  return {
    summary: {
      out_of_stock: Number(counts.out_of_stock_count),
      low_stock: Number(counts.low_stock_count)
    },
    products: rows.map(r => ({
      name: r.name,
      sku: r.sku,
      stock_quantity: Number(r.stock_quantity),
      min_stock: Number(r.min_stock),
      price: Number(r.price)
    }))
  };
}

async function get_top_products({ period, sort_by = 'revenue', limit = 5 }) {
  const { from, to } = getDateRange(period);
  const lim = Math.min(20, limit);
  const orderCol = sort_by === 'quantity' ? 'total_qty' : 'total_revenue';

  const [rows] = await db.query(`
    SELECT
      oi.product_name,
      SUM(oi.quantity) AS total_qty,
      SUM(oi.subtotal) AS total_revenue,
      COUNT(DISTINCT oi.order_id) AS order_count
    FROM order_items oi
    INNER JOIN orders o ON oi.order_id = o.id
    WHERE o.order_status != 'cancelled'
      AND DATE(o.created_at) BETWEEN ? AND ?
    GROUP BY oi.product_id, oi.product_name
    ORDER BY ${orderCol} DESC
    LIMIT ${lim}
  `, [from, to]);

  return {
    period: { from, to },
    sort_by,
    products: rows.map((r, i) => ({
      rank: i + 1,
      name: r.product_name,
      quantity_sold: Number(r.total_qty),
      revenue: Number(r.total_revenue),
      order_count: Number(r.order_count)
    }))
  };
}

async function get_customer_info({ query, top = 5 }) {
  if (query && query.trim()) {
    // Tìm khách hàng cụ thể
    const searchTerm = `%${query.trim()}%`;
    const [rows] = await db.query(`
      SELECT c.id, c.name, c.phone, c.reward_points, c.total_spent,
             c.membership_tier, c.visit_count,
             COUNT(o.id) AS order_count,
             MAX(o.created_at) AS last_order_date
      FROM customers c
      LEFT JOIN orders o ON o.customer_id = c.id AND o.order_status != 'cancelled'
      WHERE c.is_active = TRUE AND (c.name LIKE ? OR c.phone LIKE ?)
      GROUP BY c.id
      LIMIT 5
    `, [searchTerm, searchTerm]);

    return { type: 'search', results: rows.map(r => ({
      name: r.name,
      phone: r.phone,
      reward_points: Number(r.reward_points),
      total_spent: Number(r.total_spent),
      membership_tier: r.membership_tier,
      order_count: Number(r.order_count),
      last_order: r.last_order_date
    }))};
  }

  // Tổng quan khách hàng
  const [[summary]] = await db.query(`
    SELECT COUNT(*) AS total, SUM(reward_points) AS total_points,
           SUM(total_spent) AS total_spent
    FROM customers WHERE is_active = TRUE
  `);

  const [topCustomers] = await db.query(`
    SELECT name, phone, total_spent, reward_points, membership_tier
    FROM customers WHERE is_active = TRUE
    ORDER BY total_spent DESC LIMIT ?
  `, [Math.min(10, top)]);

  return {
    type: 'overview',
    total_customers: Number(summary.total),
    total_points: Number(summary.total_points),
    total_spent: Number(summary.total_spent),
    top_customers: topCustomers.map(r => ({
      name: r.name, phone: r.phone,
      total_spent: Number(r.total_spent),
      reward_points: Number(r.reward_points),
      tier: r.membership_tier
    }))
  };
}

async function get_cashier_performance({ period }) {
  const { from, to } = getDateRange(period);

  const [rows] = await db.query(`
    SELECT
      u.id, u.full_name, u.username,
      COUNT(o.id) AS total_orders,
      COALESCE(SUM(o.total_amount), 0) AS total_revenue,
      COALESCE(AVG(o.total_amount), 0) AS avg_order_value
    FROM users u
    LEFT JOIN orders o ON o.cashier_id = u.id
      AND o.order_status != 'cancelled'
      AND DATE(o.created_at) BETWEEN ? AND ?
    WHERE u.is_active = TRUE AND u.role IN ('cashier', 'admin')
    GROUP BY u.id, u.full_name, u.username
    ORDER BY total_revenue DESC
  `, [from, to]);

  return {
    period: { from, to },
    cashiers: rows.map((r, i) => ({
      rank: i + 1,
      name: r.full_name,
      username: r.username,
      total_orders: Number(r.total_orders),
      total_revenue: Number(r.total_revenue),
      avg_order_value: Math.round(Number(r.avg_order_value))
    }))
  };
}

async function get_shift_info({ type }) {
  if (type === 'current') {
    const [rows] = await db.query(`
      SELECT s.*, u.full_name AS cashier_name
      FROM shifts s
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.end_time IS NULL
      ORDER BY s.start_time DESC
    `);

    if (rows.length === 0) return { message: 'Hiện tại không có ca nào đang mở.' };

    const results = [];
    for (const shift of rows) {
      const [[stats]] = await db.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS sales, COUNT(id) AS orders
        FROM orders WHERE cashier_id = ? AND order_status != 'cancelled' AND created_at >= ?
      `, [shift.user_id, shift.start_time]);

      results.push({
        cashier: shift.cashier_name,
        start_time: shift.start_time,
        opening_cash: Number(shift.opening_cash),
        current_sales: Number(stats.sales),
        current_orders: Number(stats.orders)
      });
    }
    return { type: 'current', shifts: results };
  }

  if (type === 'today') {
    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await db.query(`
      SELECT s.*, u.full_name AS cashier_name
      FROM shifts s INNER JOIN users u ON s.user_id = u.id
      WHERE DATE(s.start_time) = ?
      ORDER BY s.start_time DESC
    `, [today]);

    return {
      type: 'today',
      shifts: rows.map(r => ({
        cashier: r.cashier_name,
        start_time: r.start_time,
        end_time: r.end_time,
        opening_cash: Number(r.opening_cash),
        closing_cash: r.closing_cash ? Number(r.closing_cash) : null,
        total_sales: Number(r.total_sales || 0),
        total_orders: Number(r.total_orders || 0),
        status: r.end_time ? 'closed' : 'open'
      }))
    };
  }

  // recent
  const [rows] = await db.query(`
    SELECT s.*, u.full_name AS cashier_name
    FROM shifts s INNER JOIN users u ON s.user_id = u.id
    ORDER BY s.start_time DESC LIMIT 5
  `);

  return {
    type: 'recent',
    shifts: rows.map(r => ({
      cashier: r.cashier_name,
      start_time: r.start_time,
      end_time: r.end_time,
      total_sales: Number(r.total_sales || 0),
      total_orders: Number(r.total_orders || 0),
      status: r.end_time ? 'closed' : 'open'
    }))
  };
}

async function get_business_insights({ aspect }) {
  const today = new Date().toISOString().slice(0, 10);

  if (aspect === 'payment_methods') {
    const { from, to } = getDateRange('this_month');
    const [rows] = await db.query(`
      SELECT payment_method, COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders WHERE order_status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ?
      GROUP BY payment_method
    `, [from, to]);

    const total = rows.reduce((s, r) => s + Number(r.revenue), 0);
    return {
      aspect: 'payment_methods',
      period: { from, to },
      methods: rows.map(r => ({
        method: r.payment_method === 'cash' ? 'Tiền mặt' : 'Chuyển khoản QR',
        count: Number(r.count),
        revenue: Number(r.revenue),
        percentage: total > 0 ? ((Number(r.revenue) / total) * 100).toFixed(1) + '%' : '0%'
      }))
    };
  }

  if (aspect === 'peak_hours') {
    const { from, to } = getDateRange('this_month');
    const [rows] = await db.query(`
      SELECT HOUR(created_at) AS hour,
             COUNT(*) AS order_count,
             COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders
      WHERE order_status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ?
      GROUP BY HOUR(created_at)
      ORDER BY order_count DESC
    `, [from, to]);

    return {
      aspect: 'peak_hours',
      hours: rows.map(r => ({
        hour: `${r.hour}:00 - ${r.hour}:59`,
        orders: Number(r.order_count),
        revenue: Number(r.revenue)
      }))
    };
  }

  if (aspect === 'growth') {
    const thisMonth = getDateRange('this_month');
    const lastMonth = getDateRange('last_month');

    const [[curr]] = await db.query(`
      SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders WHERE order_status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ?
    `, [thisMonth.from, thisMonth.to]);

    const [[prev]] = await db.query(`
      SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount), 0) AS revenue
      FROM orders WHERE order_status != 'cancelled' AND DATE(created_at) BETWEEN ? AND ?
    `, [lastMonth.from, lastMonth.to]);

    const revenueGrowth = Number(prev.revenue) > 0
      ? (((Number(curr.revenue) - Number(prev.revenue)) / Number(prev.revenue)) * 100).toFixed(1)
      : null;
    const orderGrowth = Number(prev.orders) > 0
      ? (((Number(curr.orders) - Number(prev.orders)) / Number(prev.orders)) * 100).toFixed(1)
      : null;

    return {
      aspect: 'growth',
      this_month: { revenue: Number(curr.revenue), orders: Number(curr.orders) },
      last_month: { revenue: Number(prev.revenue), orders: Number(prev.orders) },
      growth: { revenue_percent: revenueGrowth, order_percent: orderGrowth }
    };
  }

  // overview
  const summaryData = await get_sales_summary({ period: 'this_month' });
  const inventoryData = await get_inventory_alerts({ type: 'all', limit: 3 });
  const topData = await get_top_products({ period: 'this_month', limit: 3 });

  return {
    aspect: 'overview',
    sales: summaryData,
    inventory_alerts: inventoryData.summary,
    top_products: topData.products
  };
}

// Map tên tool → hàm thực thi
const toolExecutors = {
  get_sales_summary,
  get_inventory_alerts,
  get_top_products,
  get_customer_info,
  get_cashier_performance,
  get_shift_info,
  get_business_insights
};

module.exports = { toolDefinitions, toolExecutors };
