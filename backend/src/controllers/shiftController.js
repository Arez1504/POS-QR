// backend/src/controllers/shiftController.js
const db = require('../config/db');
const { logActivity } = require('../utils/logger');

// GET /api/shifts/active - Lấy ca hiện tại của user đang đăng nhập
const getActiveShift = async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Tìm ca đang mở của user
    const [shifts] = await db.execute(
      'SELECT * FROM shifts WHERE user_id = ? AND status = "open" LIMIT 1',
      [userId]
    );

    if (shifts.length === 0) {
      return res.json({ success: true, data: null });
    }

    const activeShift = shifts[0];

    // Tính toán doanh số tạm tính của ca này từ lúc start_time tới hiện tại
    const [stats] = await db.execute(
      `SELECT 
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COUNT(id) AS total_orders,
        COALESCE(SUM(CASE WHEN payment_method = "cash" THEN total_amount ELSE 0 END), 0) AS cash_sales,
        COALESCE(SUM(CASE WHEN payment_method != "cash" THEN total_amount ELSE 0 END), 0) AS non_cash_sales
       FROM orders 
       WHERE cashier_id = ? AND order_status != "cancelled" AND created_at >= ?`,
      [userId, activeShift.start_time]
    );

    res.json({
      success: true,
      data: activeShift,
      stats: {
        total_sales: Number(stats[0].total_sales),
        total_orders: Number(stats[0].total_orders),
        cash_sales: Number(stats[0].cash_sales),
        non_cash_sales: Number(stats[0].non_cash_sales),
      }
    });
  } catch (error) {
    console.error('getActiveShift error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// POST /api/shifts/open - Mở ca làm việc mới
const openShift = async (req, res) => {
  try {
    const userId = req.user.id;
    const { opening_cash } = req.body;

    if (opening_cash === undefined || opening_cash === null || isNaN(Number(opening_cash))) {
      return res.status(400).json({ success: false, message: 'Số tiền đầu ca không hợp lệ' });
    }

    // Kiểm tra xem đã có ca nào đang mở chưa
    const [existing] = await db.execute(
      'SELECT id FROM shifts WHERE user_id = ? AND status = "open" LIMIT 1',
      [userId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ success: false, message: 'Bạn đang có một ca làm việc đang mở. Vui lòng đóng ca trước.' });
    }

    const openingCashNum = Number(opening_cash);

    // Mở ca mới
    const [result] = await db.execute(
      'INSERT INTO shifts (user_id, opening_cash, status) VALUES (?, ?, "open")',
      [userId, openingCashNum]
    );

    const [newShift] = await db.execute('SELECT * FROM shifts WHERE id = ?', [result.insertId]);

    // Ghi log hoạt động
    await logActivity(
      req, 
      'Mở ca', 
      `Nhân viên ${req.user.username} đã mở ca làm việc #${result.insertId} với số tiền mặt đầu ca: ${openingCashNum.toLocaleString('vi-VN')}đ`
    );

    res.status(201).json({
      success: true,
      message: 'Mở ca làm việc thành công',
      data: newShift[0]
    });
  } catch (error) {
    console.error('openShift error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// POST /api/shifts/close - Đóng ca làm việc hiện tại
const closeShift = async (req, res) => {
  try {
    const userId = req.user.id;
    const { closing_cash, note } = req.body;

    if (closing_cash === undefined || closing_cash === null || isNaN(Number(closing_cash))) {
      return res.status(400).json({ success: false, message: 'Số tiền kết ca không hợp lệ' });
    }

    // Tìm ca đang mở của user
    const [shifts] = await db.execute(
      'SELECT * FROM shifts WHERE user_id = ? AND status = "open" LIMIT 1',
      [userId]
    );

    if (shifts.length === 0) {
      return res.status(400).json({ success: false, message: 'Không tìm thấy ca làm việc đang mở' });
    }

    const activeShift = shifts[0];
    const closingCashNum = Number(closing_cash);

    // Tính toán doanh số thực tế của ca từ lúc start_time tới lúc đóng ca
    const [stats] = await db.execute(
      `SELECT 
        COALESCE(SUM(total_amount), 0) AS total_sales,
        COUNT(id) AS total_orders,
        COALESCE(SUM(CASE WHEN payment_method = "cash" THEN total_amount ELSE 0 END), 0) AS cash_sales
       FROM orders 
       WHERE cashier_id = ? AND order_status != "cancelled" AND created_at >= ?`,
      [userId, activeShift.start_time]
    );

    const totalSales = Number(stats[0].total_sales);
    const totalOrders = Number(stats[0].total_orders);
    const cashSales = Number(stats[0].cash_sales);

    // Tiền mặt dự kiến trong két = tiền mặt đầu ca + doanh thu tiền mặt
    const expectedCash = Number(activeShift.opening_cash) + cashSales;
    const difference = closingCashNum - expectedCash;

    // Cập nhật ca làm việc thành đã đóng
    await db.execute(
      `UPDATE shifts 
       SET end_time = CURRENT_TIMESTAMP, 
           closing_cash = ?, 
           total_sales = ?, 
           total_orders = ?, 
           status = "closed", 
           note = ?
       WHERE id = ?`,
      [closingCashNum, totalSales, totalOrders, note || null, activeShift.id]
    );

    const [updatedShift] = await db.execute('SELECT * FROM shifts WHERE id = ?', [activeShift.id]);

    // Ghi log hoạt động
    let detailMsg = `Nhân viên ${req.user.username} đã đóng ca làm việc #${activeShift.id}. `;
    detailMsg += `Doanh thu ca: ${totalSales.toLocaleString('vi-VN')}đ (${totalOrders} đơn). `;
    detailMsg += `Tiền mặt bàn giao: ${closingCashNum.toLocaleString('vi-VN')}đ (Dự kiến: ${expectedCash.toLocaleString('vi-VN')}đ). `;
    if (difference !== 0) {
      detailMsg += `Chênh lệch két tiền: ${difference > 0 ? '+' : ''}${difference.toLocaleString('vi-VN')}đ. `;
    } else {
      detailMsg += `Két tiền khớp hoàn toàn. `;
    }
    if (note) detailMsg += `Ghi chú: ${note}`;

    await logActivity(req, 'Đóng ca', detailMsg);

    res.json({
      success: true,
      message: 'Đóng ca làm việc thành công',
      data: updatedShift[0]
    });
  } catch (error) {
    console.error('closeShift error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// GET /api/shifts/history - Lấy danh sách lịch sử ca làm việc (Admin xem hết, Cashier xem của mình)
const getShiftsHistory = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const { user_id, status, start_date, end_date } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    // Nếu không phải admin thì chỉ được xem ca của chính mình
    if (req.user.role !== 'admin') {
      where += ' AND s.user_id = ?';
      params.push(req.user.id);
    } else if (user_id) {
      where += ' AND s.user_id = ?';
      params.push(parseInt(user_id));
    }

    if (status) {
      where += ' AND s.status = ?';
      params.push(status);
    }

    if (start_date) {
      where += ' AND DATE(s.start_time) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      where += ' AND DATE(s.start_time) <= ?';
      params.push(end_date);
    }

    const sql = `
      SELECT s.*, u.full_name as cashier_name, u.username as cashier_username
      FROM shifts s
      LEFT JOIN users u ON s.user_id = u.id
      ${where}
      ORDER BY s.start_time DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [shifts] = await db.query(sql, params);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM shifts s ${where}`,
      params
    );

    res.json({
      success: true,
      data: shifts,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('getShiftsHistory error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// GET /api/shifts/assignments - Lấy danh sách phân công ca làm
const getShiftAssignments = async (req, res) => {
  try {
    const { start_date, end_date, user_id } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    // Nếu không phải admin thì chỉ được xem lịch phân công của chính mình
    if (req.user.role !== 'admin') {
      where += ' AND sa.user_id = ?';
      params.push(req.user.id);
    } else if (user_id) {
      where += ' AND sa.user_id = ?';
      params.push(parseInt(user_id));
    }

    if (start_date) {
      where += ' AND sa.shift_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      where += ' AND sa.shift_date <= ?';
      params.push(end_date);
    }

    const sql = `
      SELECT sa.*, u.full_name as employee_name, u.username as employee_username
      FROM shift_assignments sa
      LEFT JOIN users u ON sa.user_id = u.id
      ${where}
      ORDER BY sa.shift_date DESC, sa.start_time ASC
    `;

    const [rows] = await db.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getShiftAssignments error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// POST /api/shifts/assignments - Tạo phân công ca làm (Admin only)
const createShiftAssignment = async (req, res) => {
  try {
    const { user_id, shift_date, shift_name, start_time, end_time, notes } = req.body;
    if (!user_id || !shift_date || !shift_name || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin phân công ca làm việc' });
    }

    const [result] = await db.execute(
      `INSERT INTO shift_assignments (user_id, shift_date, shift_name, start_time, end_time, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user_id, shift_date, shift_name, start_time, end_time, notes || null]
    );

    const [newAssign] = await db.query(
      `SELECT sa.*, u.full_name as employee_name, u.username as employee_username
       FROM shift_assignments sa
       LEFT JOIN users u ON sa.user_id = u.id
       WHERE sa.id = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: 'Phân công ca làm việc thành công',
      data: newAssign[0]
    });
  } catch (error) {
    console.error('createShiftAssignment error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// PUT /api/shifts/assignments/:id - Cập nhật phân công ca làm (Admin only)
const updateShiftAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { shift_date, shift_name, start_time, end_time, notes } = req.body;

    if (!shift_date || !shift_name || !start_time || !end_time) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin cập nhật ca làm việc' });
    }

    await db.execute(
      `UPDATE shift_assignments
       SET shift_date = ?, shift_name = ?, start_time = ?, end_time = ?, notes = ?
       WHERE id = ?`,
      [shift_date, shift_name, start_time, end_time, notes || null, id]
    );

    const [updated] = await db.query(
      `SELECT sa.*, u.full_name as employee_name, u.username as employee_username
       FROM shift_assignments sa
       LEFT JOIN users u ON sa.user_id = u.id
       WHERE sa.id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Cập nhật lịch phân công ca thành công',
      data: updated[0]
    });
  } catch (error) {
    console.error('updateShiftAssignment error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

// DELETE /api/shifts/assignments/:id - Xóa phân công ca làm (Admin only)
const deleteShiftAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    await db.execute('DELETE FROM shift_assignments WHERE id = ?', [id]);
    res.json({ success: true, message: 'Xóa phân công ca làm việc thành công' });
  } catch (error) {
    console.error('deleteShiftAssignment error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

module.exports = {
  getActiveShift,
  openShift,
  closeShift,
  getShiftsHistory,
  getShiftAssignments,
  createShiftAssignment,
  updateShiftAssignment,
  deleteShiftAssignment
};
