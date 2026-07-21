// backend/src/controllers/activityController.js
const db = require('../config/db');

// GET /api/activity-logs - Lấy danh sách lịch sử hoạt động (Chỉ Admin)
const getActivityLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, parseInt(req.query.limit) || 20);
    const offset = (page - 1) * limit;
    const { action, search, start_date, end_date } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    if (action) {
      where += ' AND action = ?';
      params.push(action);
    }

    if (search) {
      where += ' AND (username LIKE ? OR details LIKE ? OR ip_address LIKE ?)';
      const likeStr = `%${search}%`;
      params.push(likeStr, likeStr, likeStr);
    }

    if (start_date) {
      where += ' AND DATE(created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      where += ' AND DATE(created_at) <= ?';
      params.push(end_date);
    }

    const sql = `
      SELECT * 
      FROM activity_logs
      ${where}
      ORDER BY created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const [logs] = await db.query(sql, params);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) as total FROM activity_logs ${where}`,
      params
    );

    // Lấy danh sách các loại action duy nhất để phục vụ bộ lọc trên UI
    const [actionsList] = await db.query(
      'SELECT DISTINCT action FROM activity_logs ORDER BY action ASC'
    );

    res.json({
      success: true,
      data: logs,
      actions: actionsList.map(item => item.action),
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('getActivityLogs error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server: ' + error.message });
  }
};

module.exports = {
  getActivityLogs
};
