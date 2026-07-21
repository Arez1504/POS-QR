// backend/src/models/customerModel.js
const db = require('../config/db');

const CustomerModel = {
  // Tìm khách theo SĐT
  findByPhone: async (phone) => {
    const [rows] = await db.execute(
      'SELECT * FROM customers WHERE phone = ? AND is_active = TRUE',
      [phone]
    );
    return rows[0] || null;
  },

  // Tìm khách theo SĐT kể cả đã bị vô hiệu hóa
  findByPhoneIncludingInactive: async (phone) => {
    const [rows] = await db.execute(
      'SELECT * FROM customers WHERE phone = ?',
      [phone]
    );
    return rows[0] || null;
  },

  // Tìm khách theo ID
  findById: async (id) => {
    const [rows] = await db.execute(
      'SELECT * FROM customers WHERE id = ? AND is_active = TRUE',
      [id]
    );
    return rows[0] || null;
  },

  // Tạo khách hàng mới
  create: async ({ name, phone, email, address, date_of_birth, gender, note }) => {
    const [result] = await db.execute(
      `INSERT INTO customers (name, phone, email, address, date_of_birth, gender, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, email || null, address || null, date_of_birth || null, gender || null, note || null]
    );
    return result.insertId;
  },

  // Cập nhật khách hàng
  update: async (id, { name, phone, email, address, date_of_birth, gender, note }) => {
    await db.execute(
      `UPDATE customers SET name = ?, phone = ?, email = ?, address = ?,
       date_of_birth = ?, gender = ?, note = ?, updated_at = NOW()
       WHERE id = ?`,
      [name, phone, email || null, address || null, date_of_birth || null, gender || null, note || null, id]
    );
  },

  // Cộng điểm cho khách (dùng trong transaction)
  addPoints: async (conn, customerId, pointsToAdd, orderId, note) => {
    const [rows] = await conn.execute(
      'SELECT reward_points FROM customers WHERE id = ? FOR UPDATE',
      [customerId]
    );
    if (!rows.length) throw new Error('Không tìm thấy khách hàng');
    const before = rows[0].reward_points;
    const after = before + pointsToAdd;

    await conn.execute(
      'UPDATE customers SET reward_points = ?, total_spent = total_spent + 0 WHERE id = ?',
      [after, customerId]
    );

    await conn.execute(
      `INSERT INTO point_transactions (customer_id, order_id, type, points, balance_before, balance_after, note)
       VALUES (?, ?, 'earn', ?, ?, ?, ?)`,
      [customerId, orderId, pointsToAdd, before, after, note || `Tích điểm đơn hàng`]
    );
    return after;
  },

  // Trừ điểm (đổi điểm) - dùng trong transaction
  redeemPoints: async (conn, customerId, pointsToRedeem, orderId, note) => {
    const [rows] = await conn.execute(
      'SELECT reward_points FROM customers WHERE id = ? FOR UPDATE',
      [customerId]
    );
    if (!rows.length) throw new Error('Không tìm thấy khách hàng');
    const before = rows[0].reward_points;
    if (before < pointsToRedeem) throw new Error(`Khách chỉ có ${before} điểm, không đủ ${pointsToRedeem} điểm`);
    const after = before - pointsToRedeem;

    await conn.execute(
      'UPDATE customers SET reward_points = ? WHERE id = ?',
      [after, customerId]
    );

    await conn.execute(
      `INSERT INTO point_transactions (customer_id, order_id, type, points, balance_before, balance_after, note)
       VALUES (?, ?, 'redeem', ?, ?, ?, ?)`,
      [customerId, orderId, -pointsToRedeem, before, after, note || `Đổi điểm giảm giá`]
    );
    return after;
  },

  // Cập nhật tổng chi tiêu
  updateTotalSpent: async (conn, customerId, amount) => {
    await conn.execute(
      'UPDATE customers SET total_spent = total_spent + ? WHERE id = ?',
      [amount, customerId]
    );
  },

  // Danh sách khách hàng có phân trang + tìm kiếm
  getList: async ({ page = 1, limit = 20, search = '' }) => {
    const offset = (page - 1) * limit;
    let where = 'WHERE is_active = TRUE';
    const params = [];
    if (search) {
      where += ' AND (name LIKE ? OR phone LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    const [rows] = await db.query(
      `SELECT * FROM customers ${where} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM customers ${where}`, params
    );
    return { rows, total };
  },
};

module.exports = CustomerModel;
