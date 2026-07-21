// backend/src/routes/userRoutes.js
const express = require('express');
const router  = express.Router();
const {
  getUsers, getUser, createUser, updateUser,
  resetPassword, deleteUser, getUserStats
} = require('../controllers/userController');
const { verifyToken, requireAdmin } = require('../middleware/authMiddleware');

// Tất cả routes đều cần: đăng nhập + là admin
router.use(verifyToken, requireAdmin);

router.get('/stats',        getUserStats);   // GET  /api/users/stats
router.get('/',             getUsers);        // GET  /api/users
router.get('/:id',          getUser);         // GET  /api/users/:id
router.post('/',            createUser);      // POST /api/users
router.put('/:id',          updateUser);      // PUT  /api/users/:id
router.put('/:id/reset-password', resetPassword); // PUT /api/users/:id/reset-password
router.delete('/:id',       deleteUser);      // DELETE /api/users/:id

module.exports = router;
