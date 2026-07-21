// backend/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const PORT = process.env.PORT || 5000;

// Tạo HTTP server từ Express app để Socket.IO có thể attach vào
const server = http.createServer(app);

// ── Socket.IO Server ──────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    credentials: true
  }
});

// Lưu mapping: userId → Set<socketId> (một user có thể mở nhiều tab)
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log(`🔌 Socket connected: ${socket.id}`);

  // Laptop POS join room theo userId
  socket.on('join_pos_room', ({ userId }) => {
    if (!userId) return;
    const room = `pos_${userId}`;
    socket.join(room);
    socket.userId = userId;
    socket.deviceType = 'pos';

    // Track socket
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socket.id);

    console.log(`💻 POS joined room: ${room} (socket: ${socket.id})`);
    socket.emit('room_joined', { room, message: 'Đã kết nối POS room' });
  });

  // ĐT Scanner join room theo userId
  socket.on('join_scanner_room', ({ userId }) => {
    if (!userId) return;
    const room = `pos_${userId}`;
    socket.join(room);
    socket.userId = userId;
    socket.deviceType = 'scanner';

    console.log(`📱 Scanner joined room: ${room} (socket: ${socket.id})`);
    
    // Thông báo cho POS biết có scanner kết nối
    socket.to(room).emit('scanner_connected', { socketId: socket.id });
    socket.emit('room_joined', { room, message: 'Đã kết nối Scanner room' });
  });

  // ĐT quét mã vạch → broadcast tới POS trong cùng room
  socket.on('barcode_scanned', ({ userId, barcode }) => {
    if (!userId || !barcode) return;
    const room = `pos_${userId}`;
    console.log(`📷 Barcode scanned: ${barcode} → broadcast to room ${room}`);
    
    // Gửi cho tất cả trong room (trừ người gửi)
    socket.to(room).emit('new_barcode', {
      barcode,
      scannedBy: socket.id,
      timestamp: Date.now()
    });
  });

  // POS phản hồi kết quả cho ĐT scanner
  socket.on('scan_result', ({ userId, barcode, success, productName, message }) => {
    if (!userId) return;
    const room = `pos_${userId}`;
    
    // Gửi cho tất cả trong room (scanner sẽ nhận được)
    socket.to(room).emit('scan_result_feedback', {
      barcode,
      success,
      productName,
      message,
      timestamp: Date.now()
    });
  });

  socket.on('disconnect', () => {
    const userId = socket.userId;
    if (userId) {
      const room = `pos_${userId}`;
      
      // Cleanup tracking
      if (userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        if (userSockets.get(userId).size === 0) userSockets.delete(userId);
      }

      // Thông báo cho room biết thiết bị đã ngắt
      if (socket.deviceType === 'scanner') {
        socket.to(room).emit('scanner_disconnected', { socketId: socket.id });
      }
    }
    console.log(`❌ Socket disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Cho phép bất cứ origin nào để thuận tiện chạy thử nghiệm trên điện thoại
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth',          require('./src/routes/authRoutes'));
app.use('/api/users',         require('./src/routes/userRoutes'));
app.use('/api/products',      require('./src/routes/productRoutes'));
app.use('/api/orders',        require('./src/routes/orderRoutes'));
app.use('/api/customers',     require('./src/routes/customerRoutes'));
app.use('/api/inventory',     require('./src/routes/inventoryRoutes'));
app.use('/api/reports',       require('./src/routes/reportsRoutes'));
app.use('/api/dashboard',     require('./src/routes/dashboardRoutes'));
app.use('/api/activity-logs', require('./src/routes/activityRoutes'));
app.use('/api/shifts',        require('./src/routes/shiftRoutes'));
app.use('/api/payments',      require('./src/routes/paymentRoutes'));
app.use('/api/settings',      require('./src/routes/settingRoutes'));
app.use('/api/ai',             require('./src/routes/aiRoutes'));
// app.use('/api/qr', require('./src/routes/qrRoutes')); // Chưa làm

// Health check
app.get('/api/health', (req, res) => {
  const os = require('os');
  const interfaces = os.networkInterfaces();
  let lanIp = 'localhost';
  
  const candidateIps = [];
  for (const devName in interfaces) {
    // Bỏ qua card mạng ảo (Radmin VPN, Hamachi, VirtualBox, v.v.)
    const lowerName = devName.toLowerCase();
    if (
      lowerName.includes('virtual') || 
      lowerName.includes('radmin') || 
      lowerName.includes('hamachi') || 
      lowerName.includes('vpn') || 
      lowerName.includes('vbox') || 
      lowerName.includes('vmware') || 
      lowerName.includes('loopback')
    ) {
      continue;
    }
    
    const iface = interfaces[devName];
    for (let i = 0; i < iface.length; i++) {
      const alias = iface[i];
      if (alias.family === 'IPv4' && alias.address !== '127.0.0.1' && !alias.internal) {
        candidateIps.push(alias.address);
      }
    }
  }

  // Ưu tiên dải IP LAN thực tế (192.168.x.x hoặc 10.x.x.x hoặc 172.16-31.x.x)
  const lanPattern = /^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.)/;
  const bestIp = candidateIps.find(ip => lanPattern.test(ip));
  
  if (bestIp) {
    lanIp = bestIp;
  } else if (candidateIps.length > 0) {
    lanIp = candidateIps[0];
  }
  
  res.json({ success: true, message: 'POS API đang chạy', lanIp, time: new Date() });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Không tìm thấy API endpoint' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
});

// Dùng server.listen thay vì app.listen để Socket.IO hoạt động
server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
  console.log(`🔌 Socket.IO đã sẵn sàng`);
});