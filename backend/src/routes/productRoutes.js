// backend/src/routes/productRoutes.js
const express = require('express');
const router = express.Router();
const { getProducts, getProduct, createProduct, updateProduct, deleteProduct, getCategories } = require('../controllers/productController');
const { verifyToken, requireAdmin, requireAdminOrCashier } = require('../middleware/authMiddleware');

router.get('/categories', verifyToken, getCategories);
router.get('/', verifyToken, getProducts);
router.get('/:id', verifyToken, getProduct);
router.post('/', verifyToken, requireAdminOrCashier, createProduct);    // Admin + Cashier thêm SP
router.put('/:id', verifyToken, requireAdmin, updateProduct);  // chỉ Admin sửa SP
router.delete('/:id', verifyToken, requireAdmin, deleteProduct); // chỉ Admin xóa SP

module.exports = router;