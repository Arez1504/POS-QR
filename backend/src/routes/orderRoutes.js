// backend/src/routes/orderRoutes.js
const express = require('express');
const router = express.Router();
const { getOrders, getOrder, createOrder, cancelOrder } = require('../controllers/orderController');
const { verifyToken } = require('../middleware/authMiddleware');

router.get('/', verifyToken, getOrders);
router.get('/:id', verifyToken, getOrder);
router.post('/', verifyToken, createOrder);
router.put('/:id/cancel', verifyToken, cancelOrder);           // Admin + Nhân viên (đổi trả)

module.exports = router;