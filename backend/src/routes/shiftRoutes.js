// backend/src/routes/shiftRoutes.js
const express = require('express');
const router  = express.Router();
const {
  getActiveShift,
  openShift,
  closeShift,
  getShiftsHistory,
  getShiftAssignments,
  createShiftAssignment,
  updateShiftAssignment,
  deleteShiftAssignment
} = require('../controllers/shiftController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// Tất cả các route đều yêu cầu đăng nhập
router.use(verifyToken);

router.get('/active',  getActiveShift);
router.post('/open',   openShift);
router.post('/close',  closeShift);
router.get('/history', getShiftsHistory);

// Phân công ca làm việc
router.get('/assignments', getShiftAssignments);
router.post('/assignments', requireAdmin, createShiftAssignment);
router.put('/assignments/:id', requireAdmin, updateShiftAssignment);
router.delete('/assignments/:id', requireAdmin, deleteShiftAssignment);

module.exports = router;
