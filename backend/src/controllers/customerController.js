// backend/src/controllers/customerController.js
const db = require('../config/db');
const CustomerModel = require('../models/customerModel');
const { logActivity } = require('../utils/logger');

// GET /api/customers?search=SĐT&page=1&limit=20
const getCustomers = async (req, res) => {
  try {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const search = req.query.search || '';

    const { rows, total } = await CustomerModel.getList({ page, limit, search });
    res.json({ success: true, data: rows, total, page, limit });
  } catch (error) {
    console.error('getCustomers error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// GET /api/customers/search?phone=0901234567
// Dùng tại màn hình POS để tra cứu nhanh bằng SĐT
const searchByPhone = async (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone || phone.trim().length < 5) {
      return res.status(400).json({ success: false, message: 'Vui lòng nhập ít nhất 5 số điện thoại' });
    }
    const customer = await CustomerModel.findByPhone(phone.trim());
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng với SĐT này' });
    }
    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('searchByPhone error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// GET /api/customers/:id
const getCustomer = async (req, res) => {
  try {
    const customer = await CustomerModel.findById(req.params.id);
    if (!customer) return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });

    // Lấy lịch sử điểm
    const [transactions] = await db.execute(
      `SELECT pt.*, o.order_code FROM point_transactions pt
       LEFT JOIN orders o ON pt.order_id = o.id
       WHERE pt.customer_id = ?
       ORDER BY pt.created_at DESC LIMIT 50`,
      [customer.id]
    );

    // Lấy lịch sử đơn hàng
    const [orders] = await db.execute(
      `SELECT id, order_code, total_amount, payment_method, order_status, created_at
       FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20`,
      [customer.id]
    );

    res.json({ success: true, data: { ...customer, point_transactions: transactions, orders } });
  } catch (error) {
    console.error('getCustomer error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// POST /api/customers - Tạo khách hàng mới
const createCustomer = async (req, res) => {
  try {
    const { name, phone, email, address, date_of_birth, gender, note } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Tên và Số điện thoại là bắt buộc' });
    }

    const trimmedPhone = phone.trim();
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      return res.status(400).json({ success: false, message: 'Số điện thoại phải đúng 10 chữ số' });
    }

    // Kiểm tra SĐT đã tồn tại chưa (kể cả đã bị vô hiệu hóa)
    const existing = await CustomerModel.findByPhoneIncludingInactive(trimmedPhone);
    if (existing) {
      if (!existing.is_active) {
        return res.status(409).json({
          success: false,
          message: 'Số điện thoại này đã được đăng ký nhưng đã bị vô hiệu hóa.'
        });
      }
      return res.status(409).json({ success: false, message: 'Số điện thoại này đã được đăng ký' });
    }

    // Định dạng date_of_birth nếu có gửi lên (cắt lấy phần YYYY-MM-DD từ chuỗi ISO)
    let formattedDOB = null;
    if (date_of_birth && date_of_birth.trim() !== '') {
      formattedDOB = date_of_birth.includes('T') ? date_of_birth.split('T')[0] : date_of_birth;
    }

    const id = await CustomerModel.create({ 
      name, 
      phone: trimmedPhone, 
      email, 
      address, 
      date_of_birth: formattedDOB, 
      gender, 
      note 
    });
    const customer = await CustomerModel.findById(id);

    await logActivity(req, 'Thêm khách hàng', `Đã thêm khách hàng thân thiết mới "${name}" (SĐT: ${trimmedPhone})`);

    res.status(201).json({ success: true, message: 'Tạo khách hàng thành công', data: customer });
  } catch (error) {
    console.error('createCustomer error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Số điện thoại này đã được sử dụng trong hệ thống' });
    }
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// PUT /api/customers/:id - Cập nhật khách hàng
const updateCustomer = async (req, res) => {
  try {
    const existing = await CustomerModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });

    const { name, phone, email, address, date_of_birth, gender, note } = req.body;
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: 'Tên và Số điện thoại là bắt buộc' });
    }

    const trimmedPhone = phone.trim();
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      return res.status(400).json({ success: false, message: 'Số điện thoại phải đúng 10 chữ số' });
    }

    // Kiểm tra SĐT trùng với khách khác (kể cả đã bị vô hiệu hóa)
    if (trimmedPhone !== existing.phone) {
      const dup = await CustomerModel.findByPhoneIncludingInactive(trimmedPhone);
      if (dup) {
        if (!dup.is_active) {
          return res.status(409).json({
            success: false,
            message: 'Số điện thoại này đã được dùng bởi một khách hàng đã bị vô hiệu hóa.'
          });
        }
        return res.status(409).json({ success: false, message: 'Số điện thoại đã được dùng bởi khách hàng khác' });
      }
    }

    // Định dạng date_of_birth nếu có gửi lên (cắt lấy phần YYYY-MM-DD từ chuỗi ISO)
    let formattedDOB = null;
    if (date_of_birth && date_of_birth.trim() !== '') {
      formattedDOB = date_of_birth.includes('T') ? date_of_birth.split('T')[0] : date_of_birth;
    }

    await CustomerModel.update(req.params.id, { 
      name, 
      phone: trimmedPhone, 
      email, 
      address, 
      date_of_birth: formattedDOB, 
      gender, 
      note 
    });
    const updated = await CustomerModel.findById(req.params.id);

    await logActivity(req, 'Sửa khách hàng', `Đã cập nhật thông tin khách hàng "${name}" (ID: ${req.params.id}, SĐT: ${trimmedPhone})`);

    res.json({ success: true, message: 'Cập nhật thành công', data: updated });
  } catch (error) {
    console.error('updateCustomer error:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'Số điện thoại này đã được sử dụng trong hệ thống' });
    }
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// DELETE /api/customers/:id - Xóa mềm (chỉ Admin)
const deleteCustomer = async (req, res) => {
  try {
    const existing = await CustomerModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ success: false, message: 'Không tìm thấy khách hàng' });

    await db.execute('UPDATE customers SET is_active = FALSE WHERE id = ?', [req.params.id]);

    await logActivity(req, 'Xóa khách hàng', `Đã xóa (vô hiệu hóa) khách hàng "${existing.name}" (ID: ${req.params.id}, SĐT: ${existing.phone})`);

    res.json({ success: true, message: 'Đã xóa khách hàng' });
  } catch (error) {
    console.error('deleteCustomer error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// GET /api/customers/:id/points - Lịch sử điểm
const getPointHistory = async (req, res) => {
  try {
    const [rows] = await db.execute(
      `SELECT pt.*, o.order_code FROM point_transactions pt
       LEFT JOIN orders o ON pt.order_id = o.id
       WHERE pt.customer_id = ?
       ORDER BY pt.created_at DESC`,
      [req.params.id]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getPointHistory error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = {
  getCustomers,
  searchByPhone,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getPointHistory,
};
