// backend/src/controllers/userController.js
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { logActivity } = require('../utils/logger');

// ── GET /api/users ────────────────────────────────────────────────────────────
// Lấy danh sách tất cả users (chỉ admin)
const getUsers = async (req, res) => {
  try {
    const { role, is_active, search } = req.query;

    let sql = `SELECT id, username, full_name, email, phone, role, avatar, is_active, created_at
               FROM users WHERE 1=1`;
    const params = [];

    if (role) {
      sql += ' AND role = ?';
      params.push(role);
    }
    if (is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }
    if (search) {
      sql += ' AND (username LIKE ? OR full_name LIKE ? OR email LIKE ?)';
      const like = `%${search}%`;
      params.push(like, like, like);
    }

    sql += ' ORDER BY created_at DESC';

    const [rows] = await db.execute(sql, params);
    res.json({ success: true, users: rows });
  } catch (error) {
    console.error('getUsers error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── GET /api/users/:id ────────────────────────────────────────────────────────
const getUser = async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, username, full_name, email, phone, role, avatar, is_active, created_at FROM users WHERE id = ?',
      [req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }
    res.json({ success: true, user: rows[0] });
  } catch (error) {
    console.error('getUser error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── POST /api/users ────────────────────────────────────────────────────────────
// Tạo user mới (chỉ admin)
const createUser = async (req, res) => {
  try {
    const { username, password, full_name, email, phone, role, avatar } = req.body;

    // Validation
    if (!username || !password || !full_name || !role) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập: username, password, full_name, role'
      });
    }
    if (!['admin', 'cashier'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Role không hợp lệ. Chỉ cho phép: admin, cashier' });
    }
    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    // Kiểm tra username trùng
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Tên đăng nhập đã tồn tại' });
    }

    const hash = await bcrypt.hash(password, 10);
    const [result] = await db.execute(
      `INSERT INTO users (username, password, full_name, email, phone, role, avatar)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [username, hash, full_name, email || null, phone || null, role, avatar || null]
    );

    const [newUser] = await db.execute(
      'SELECT id, username, full_name, email, phone, role, avatar, is_active, created_at FROM users WHERE id = ?',
      [result.insertId]
    );

    res.status(201).json({ success: true, message: 'Tạo tài khoản thành công', user: newUser[0] });

    await logActivity(req, 'Thêm nhân viên', `Đã thêm nhân viên mới "${full_name}" (@${username}, Vai trò: ${role})`);
  } catch (error) {
    console.error('createUser error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── PUT /api/users/:id ────────────────────────────────────────────────────────
// Cập nhật thông tin user (chỉ admin)
const updateUser = async (req, res) => {
  try {
    const { full_name, email, phone, role, avatar, is_active } = req.body;
    const userId = req.params.id;

    // Không cho phép admin tự hạ quyền chính mình
    if (String(req.user.id) === String(userId) && role && role !== 'admin') {
      return res.status(400).json({ success: false, message: 'Không thể thay đổi role của chính mình' });
    }

    const fields = [];
    const values = [];

    if (full_name !== undefined) { fields.push('full_name = ?'); values.push(full_name); }
    if (email     !== undefined) { fields.push('email = ?');     values.push(email); }
    if (phone     !== undefined) { fields.push('phone = ?');     values.push(phone); }
    if (role      !== undefined) {
      if (!['admin', 'cashier'].includes(role)) {
        return res.status(400).json({ success: false, message: 'Role không hợp lệ. Chỉ cho phép: admin, cashier' });
      }
      fields.push('role = ?'); values.push(role);
    }
    if (avatar    !== undefined) { fields.push('avatar = ?');    values.push(avatar); }
    if (is_active !== undefined) { fields.push('is_active = ?'); values.push(is_active ? 1 : 0); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có thông tin cập nhật' });
    }

    values.push(userId);
    await db.execute(`UPDATE users SET ${fields.join(', ')} WHERE id = ?`, values);

    const [updated] = await db.execute(
      'SELECT id, username, full_name, email, phone, role, avatar, is_active, created_at FROM users WHERE id = ?',
      [userId]
    );

    res.json({ success: true, message: 'Cập nhật thành công', user: updated[0] });

    await logActivity(req, 'Sửa nhân viên', `Đã sửa thông tin nhân viên "${updated[0].full_name}" (@${updated[0].username}, Vai trò: ${updated[0].role}, Hoạt động: ${updated[0].is_active ? 'Có' : 'Không'})`);
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── PUT /api/users/:id/reset-password ─────────────────────────────────────────
// Admin reset mật khẩu cho user khác
const resetPassword = async (req, res) => {
  try {
    const { new_password } = req.body;
    const userId = req.params.id;

    if (!new_password || new_password.length < 6) {
      return res.status(400).json({ success: false, message: 'Mật khẩu phải có ít nhất 6 ký tự' });
    }

    const [rows] = await db.execute('SELECT id, username, full_name FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    const hash = await bcrypt.hash(new_password, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hash, userId]);

    await logActivity(req, 'Đặt lại mật khẩu', `Đã đặt lại mật khẩu cho nhân viên "${rows[0].full_name}" (@${rows[0].username})`);

    res.json({ success: true, message: 'Đặt lại mật khẩu thành công' });
  } catch (error) {
    console.error('resetPassword error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── DELETE /api/users/:id ─────────────────────────────────────────────────────
// Xóa mềm (deactivate) hoặc xóa hẳn (chỉ admin)
const deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Không cho phép tự xóa chính mình
    if (String(req.user.id) === String(userId)) {
      return res.status(400).json({ success: false, message: 'Không thể xóa tài khoản của chính mình' });
    }

    const [rows] = await db.execute('SELECT id, username FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy người dùng' });
    }

    // Xóa mềm: deactivate thay vì xóa hẳn
    await db.execute('UPDATE users SET is_active = FALSE WHERE id = ?', [userId]);

    await logActivity(req, 'Vô hiệu hóa nhân viên', `Đã vô hiệu hóa tài khoản nhân viên "${rows[0].username}" (ID: ${userId})`);

    res.json({ success: true, message: `Đã vô hiệu hóa tài khoản "${rows[0].username}"` });
  } catch (error) {
    console.error('deleteUser error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── GET /api/users/stats ──────────────────────────────────────────────────────
const getUserStats = async (req, res) => {
  try {
    const [stats] = await db.execute(`
      SELECT
        COUNT(*) AS total,
        SUM(role = 'admin')   AS admins,
        SUM(role = 'cashier') AS cashiers,
        SUM(is_active = TRUE)  AS active,
        SUM(is_active = FALSE) AS inactive
      FROM users
    `);
    res.json({ success: true, stats: stats[0] });
  } catch (error) {
    console.error('getUserStats error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

module.exports = { getUsers, getUser, createUser, updateUser, resetPassword, deleteUser, getUserStats };
