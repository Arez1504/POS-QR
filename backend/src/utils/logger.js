// backend/src/utils/logger.js
const db = require('../config/db');

/**
 * Log a user action to the database
 * @param {Object} req Express request object (used to extract user details and IP address)
 * @param {string} action Category / name of action (e.g. 'Đăng nhập', 'Thêm sản phẩm')
 * @param {string} details Description of the action (e.g. 'Tài khoản admin đã đăng nhập vào hệ thống')
 * @param {Object} [userOverride] Override req.user details (e.g. during login before token exists)
 */
const logActivity = async (req, action, details, userOverride = null) => {
  try {
    const userId = userOverride ? userOverride.id : (req && req.user ? req.user.id : null);
    const username = userOverride ? userOverride.username : (req && req.user ? req.user.username : null);
    const ipAddress = req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null;

    await db.execute(
      `INSERT INTO activity_logs (user_id, username, action, details, ip_address)
       VALUES (?, ?, ?, ?, ?)`,
      [userId, username, action, details || null, ipAddress]
    );
  } catch (error) {
    console.error('❌ Error logging activity:', error.message);
  }
};

module.exports = { logActivity };
