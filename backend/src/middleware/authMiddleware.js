// backend/src/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'pos_secret_key_2024';

// ── Xác thực token ────────────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ success: false, message: 'Không có token xác thực' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ success: false, message: 'Token không hợp lệ hoặc đã hết hạn' });
  }
};

// ── Chỉ Admin ─────────────────────────────────────────────────────────────────
// Dùng cho: quản lý users, báo cáo tổng hợp, cấu hình hệ thống
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện thao tác này' });
  }
  next();
};

// ── Admin hoặc Nhân viên bán hàng ─────────────────────────────────────────────
// Dùng cho: kho hàng (cần xem tồn kho khi bán), sản phẩm, khách hàng
const requireAdminOrCashier = (req, res, next) => {
  if (!['admin', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: 'Bạn không có quyền truy cập' });
  }
  next();
};

/**
 * Factory middleware - dùng linh hoạt:
 *   router.delete('/:id', verifyToken, checkRole(['admin']), handler)
 *   router.put('/:id',    verifyToken, checkRole(['admin', 'cashier']), handler)
 */
const checkRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Bạn không có quyền thực hiện thao tác này (yêu cầu: ${roles.join(', ')})`
    });
  }
  next();
};

module.exports = { verifyToken, requireAdmin, requireAdminOrCashier, checkRole };