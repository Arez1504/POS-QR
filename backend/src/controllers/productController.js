// backend/src/controllers/productController.js
const db = require('../config/db');
const { logActivity } = require('../utils/logger');

// GET /api/products - Lấy danh sách sản phẩm
const getProducts = async (req, res) => {
  try {
    const search      = req.query.search      || '';
    const category_id = req.query.category_id || '';
    const page        = Math.max(1, parseInt(req.query.page)  || 1);
    const limit       = Math.min(100, parseInt(req.query.limit) || 20);
    const offset      = (page - 1) * limit;

    let where = 'WHERE p.is_active = TRUE';
    const params = [];

    if (search) {
      where += ' AND (p.name LIKE ? OR p.sku LIKE ? OR p.barcode LIKE ?)';
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (category_id) {
      where += ' AND p.category_id = ?';
      params.push(parseInt(category_id));
    }

    // Dùng query() thay execute() để tránh ER_WRONG_ARGUMENTS với LIMIT/OFFSET
    const sql = `SELECT p.*, c.name as category_name
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 ${where}
                 ORDER BY p.created_at DESC
                 LIMIT ${limit} OFFSET ${offset}`;

    const [products] = await db.query(sql, params);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM products p ${where}`, params
    );

    res.json({ success: true, data: products, total, page, limit });
  } catch (error) {
    console.error('getProducts error:', error.message);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};


// GET /api/products/:id
const getProduct = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT p.*, c.name as category_name FROM products p
       LEFT JOIN categories c ON p.category_id = c.id WHERE p.id = ?`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/products - Thêm sản phẩm
const createProduct = async (req, res) => {
  try {
    const { category_id, name, sku, barcode, description, price, cost_price, stock_quantity, min_stock, unit, image } = req.body;

    if (!name || !price) return res.status(400).json({ success: false, message: 'Tên và giá sản phẩm là bắt buộc' });

    const [result] = await db.execute(
      `INSERT INTO products (category_id, name, sku, barcode, description, price, cost_price, stock_quantity, min_stock, unit, image)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [category_id || null, name, sku || null, barcode || null, description || null,
       price, cost_price || 0, stock_quantity || 0, min_stock || 5, unit || 'cái', image || null]
    );

    const [newProduct] = await db.execute('SELECT * FROM products WHERE id = ?', [result.insertId]);
    
    await logActivity(req, 'Thêm sản phẩm', `Đã thêm sản phẩm "${name}" (Mã: ${sku || barcode || 'Không có'}, Giá bán: ${Number(price).toLocaleString('vi-VN')}đ, Tồn kho: ${stock_quantity || 0})`);

    res.status(201).json({ success: true, message: 'Thêm sản phẩm thành công', data: newProduct[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'SKU hoặc mã vạch đã tồn tại' });
    console.error('createProduct error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// PUT /api/products/:id - Sửa sản phẩm
const updateProduct = async (req, res) => {
  try {
    const { category_id, name, sku, barcode, description, price, cost_price, stock_quantity, min_stock, unit, image, is_active } = req.body;

    const [existing] = await db.execute('SELECT id FROM products WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    await db.execute(
      `UPDATE products SET category_id=?, name=?, sku=?, barcode=?, description=?, price=?, 
       cost_price=?, stock_quantity=?, min_stock=?, unit=?, image=?, is_active=? WHERE id=?`,
      [category_id || null, name, sku || null, barcode || null, description || null,
       price, cost_price || 0, stock_quantity || 0, min_stock || 5, unit || 'cái',
       image || null, is_active !== undefined ? is_active : true, req.params.id]
    );

    const [updated] = await db.execute('SELECT * FROM products WHERE id = ?', [req.params.id]);

    await logActivity(req, 'Sửa sản phẩm', `Đã cập nhật sản phẩm "${name}" (ID: ${req.params.id}, Mã: ${sku || barcode || 'Không có'}, Giá bán: ${Number(price).toLocaleString('vi-VN')}đ, Tồn kho: ${stock_quantity || 0})`);

    res.json({ success: true, message: 'Cập nhật thành công', data: updated[0] });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(400).json({ success: false, message: 'SKU hoặc mã vạch đã tồn tại' });
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// DELETE /api/products/:id - Xóa cứng khỏi database
const deleteProduct = async (req, res) => {
  try {
    const [existing] = await db.execute('SELECT id, name, sku FROM products WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ success: false, message: 'Không tìm thấy sản phẩm' });

    await db.execute('DELETE FROM products WHERE id = ?', [req.params.id]);

    await logActivity(req, 'Xóa sản phẩm', `Đã xóa sản phẩm "${existing[0].name}" (ID: ${req.params.id}, SKU: ${existing[0].sku || 'Không có'})`);

    res.json({ success: true, message: 'Đã xóa sản phẩm' });
  } catch (error) {
    console.error('deleteProduct error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// GET /api/products/categories - Lấy danh mục
const getCategories = async (req, res) => {
  try {
    const [rows] = await db.execute('SELECT * FROM categories WHERE is_active = TRUE ORDER BY name');
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getCategories };