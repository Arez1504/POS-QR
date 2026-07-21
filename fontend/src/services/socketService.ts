// frontend/src/services/socketService.ts
import { io, Socket } from 'socket.io-client';

// Socket.IO server URL — cùng host với API nhưng không có /api prefix
const getSocketUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) {
    try {
      return new URL(envUrl).origin;
    } catch {
      return envUrl;
    }
  }
  return window.location.origin;
};

const SOCKET_URL = getSocketUrl();

let socket: Socket | null = null;

/**
 * Kết nối Socket.IO (singleton — chỉ tạo 1 connection)
 */
export const connectSocket = (): Socket => {
  if (socket && socket.connected) return socket;

  socket = io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('🔌 Socket.IO connected:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('❌ Socket.IO disconnected:', reason);
  });

  socket.on('connect_error', (err) => {
    console.warn('⚠️ Socket.IO connection error:', err.message);
  });

  return socket;
};

/**
 * Lấy socket instance hiện tại (hoặc tạo mới nếu chưa có)
 */
export const getSocket = (): Socket => {
  if (!socket) return connectSocket();
  return socket;
};

/**
 * Ngắt kết nối Socket.IO
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Kiểm tra trạng thái kết nối
 */
export const isSocketConnected = (): boolean => {
  return socket?.connected ?? false;
};

// ── POS-specific helpers ──────────────────────────────────────────────────────

/**
 * POS laptop join room theo userId
 */
export const joinPosRoom = (userId: number): void => {
  const s = getSocket();
  s.emit('join_pos_room', { userId });
};

/**
 * Scanner (ĐT) join room theo userId
 */
export const joinScannerRoom = (userId: number): void => {
  const s = getSocket();
  s.emit('join_scanner_room', { userId });
};

/**
 * Scanner gửi barcode đã quét
 */
export const emitBarcode = (userId: number, barcode: string): void => {
  const s = getSocket();
  s.emit('barcode_scanned', { userId, barcode });
};

/**
 * POS gửi phản hồi kết quả quét cho scanner
 */
export const emitScanResult = (
  userId: number,
  barcode: string,
  success: boolean,
  productName?: string,
  message?: string
): void => {
  const s = getSocket();
  s.emit('scan_result', { userId, barcode, success, productName, message });
};
