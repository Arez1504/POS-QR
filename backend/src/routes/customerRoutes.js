// backend/src/routes/customerRoutes.js
const express = require('express');
const router  = express.Router();
const {
  getCustomers,
  searchByPhone,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  getPointHistory,
} = require('../controllers/customerController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// Tất cả route yêu cầu đăng nhập
router.use(verifyToken);

// GET /api/customers/search?phone=... — tra cứu tại POS (cashier được dùng)
router.get('/search', searchByPhone);

// CRUD khách hàng
router.get('/',    getCustomers);
router.get('/:id', getCustomer);
router.post('/',   createCustomer);          // cashier có thể tạo KH mới tại quầy
router.put('/:id', updateCustomer);          // cashier có thể sửa thông tin
router.delete('/:id', requireAdmin, deleteCustomer); // chỉ Admin xóa

// Lịch sử điểm
router.get('/:id/points', getPointHistory);

module.exports = router;
