// backend/src/controllers/inventoryController.js
const db = require('../config/db');
const { logActivity } = require('../utils/logger');

// ── GET /api/inventory - Tồn kho hiện tại ────────────────────────────────────
const getStock = async (req, res) => {
  try {
    const search   = req.query.search   || '';
    const category = req.query.category || '';
    const filter   = req.query.filter   || ''; // 'low' | 'out'
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(100, parseInt(req.query.limit) || 30);
    const offset   = (page - 1) * limit;

    let where = 'WHERE p.is_active = TRUE';
    const params = [];

    if (search) {
      where += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category) {
      where += ' AND c.name = ?';
      params.push(category);
    }
    if (filter === 'low')  { where += ' AND p.stock_quantity <= p.min_stock AND p.stock_quantity > 0'; }
    if (filter === 'out')  { where += ' AND p.stock_quantity = 0'; }

    const sql = `
      SELECT p.id, p.name, p.sku, p.barcode, p.stock_quantity, p.min_stock,
             p.cost_price, p.price, p.unit, c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${where}
      ORDER BY p.stock_quantity ASC, p.name ASC
      LIMIT ${limit} OFFSET ${offset}`;

    const [products] = await db.query(sql, params);
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM products p LEFT JOIN categories c ON p.category_id = c.id ${where}`, params
    );

    // Thống kê nhanh
    const [[stats]] = await db.query(`
      SELECT
        COUNT(*)                                         AS total_sku,
        SUM(stock_quantity)                              AS total_qty,
        SUM(stock_quantity <= min_stock AND stock_quantity > 0) AS low_stock,
        SUM(stock_quantity = 0)                          AS out_of_stock,
        SUM(stock_quantity * cost_price)                 AS total_value
      FROM products WHERE is_active = TRUE
    `);

    res.json({ success: true, data: products, total, page, limit, stats });
  } catch (error) {
    console.error('getStock error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ── POST /api/inventory/adjust - Nhập/xuất kho thủ công ─────────────────────
const adjustStock = async (req, res) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { product_id, type, quantity, note } = req.body;

    if (!product_id || !type || !quantity) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin: product_id, type, quantity' });
    }
    if (!['import', 'export', 'adjust'].includes(type)) {
      return res.status(400).json({ success: false, message: 'type phải là: import | export | adjust' });
    }
    const qty = parseInt(quantity);
    if (isNaN(qty) || qty === 0) {
      return res.status(400).json({ success: false, message: 'Số lượng không hợp lệ' });
    }

    const [[product]] = await conn.query('SELECT * FROM products WHERE id = ? AND is_active = TRUE', [product_id]);
    if (!product) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    const before = product.stock_quantity;
    let delta = 0;
    if (type === 'import') delta = Math.abs(qty);
    if (type === 'export') delta = -Math.abs(qty);
    if (type === 'adjust') delta = qty; // qty có thể âm hoặc dương

    const after = before + delta;
    if (after < 0) {
      return res.status(400).json({ success: false, message: `Tồn kho không đủ. Hiện có: ${before}` });
    }

    await conn.query('UPDATE products SET stock_quantity = ? WHERE id = ?', [after, product_id]);

    // Ghi log
    await conn.query(
      `INSERT INTO inventory_logs (product_id, user_id, type, quantity_before, quantity_change, quantity_after, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product_id, req.user.id, type, before, delta, after, note || null]
    );

    await conn.commit();

    await logActivity(req, 'Điều chỉnh kho', `Đã ${type === 'import' ? 'nhập' : type === 'export' ? 'xuất' : 'điều chỉnh'} sản phẩm "${product.name}" (Mã: ${product.sku || 'Không có'}, Thay đổi: ${delta > 0 ? '+' : ''}${delta}, Trước: ${before}, Sau: ${after}). Ghi chú: ${note || 'Không có'}`);

    res.json({
      success: true,
      message: `Đã ${type === 'import' ? 'nhập' : type === 'export' ? 'xuất' : 'điều chỉnh'} kho thành công`,
      data: { product_id, before, delta, after }
    });
  } catch (error) {
    await conn.rollback();
    console.error('adjustStock error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  } finally {
    conn.release();
  }
};

// ── GET /api/inventory/logs - Lịch sử xuất nhập kho ─────────────────────────
const getLogs = async (req, res) => {
  try {
    const page     = Math.max(1, parseInt(req.query.page)  || 1);
    const limit    = Math.min(100, parseInt(req.query.limit) || 30);
    const offset   = (page - 1) * limit;
    const { product_id, type, date } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (product_id) { where += ' AND il.product_id = ?';        params.push(parseInt(product_id)); }
    if (type)       { where += ' AND il.type = ?';               params.push(type); }
    if (date)       { where += ' AND DATE(il.created_at) = ?';   params.push(date); }

    const [logs] = await db.query(`
      SELECT il.*, p.name as product_name, p.sku, u.full_name as user_name
      FROM inventory_logs il
      LEFT JOIN products p ON il.product_id = p.id
      LEFT JOIN users u ON il.user_id = u.id
      ${where}
      ORDER BY il.created_at DESC
      LIMIT ${limit} OFFSET ${offset}`, params
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM inventory_logs il ${where}`, params
    );

    res.json({ success: true, data: logs, total, page, limit });
  } catch (error) {
    console.error('getLogs error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// ── GET /api/inventory/categories - Danh mục cho filter ─────────────────────
const getCategories = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT id, name FROM categories WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = { getStock, adjustStock, getLogs, getCategories };
