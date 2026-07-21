// frontend/src/pages/ScannerPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useAuth } from '../hooks/useAuth';
import Icon from '../components/Icon';
import {
  connectSocket,
  joinScannerRoom,
  emitBarcode,
  getSocket,
  disconnectSocket,
} from '../services/socketService';

interface ScanHistoryItem {
  barcode: string;
  success?: boolean;
  productName?: string;
  message?: string;
  timestamp: number;
}

// Phát tiếng beep khi quét thành công
const playBeep = () => {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.type = 'square';
    osc.frequency.setValueAtTime(1800, audioCtx.currentTime);
    osc.frequency.setValueAtTime(1400, audioCtx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.2);
  } catch (e) {
    // Bỏ qua
  }
};

export default function ScannerPage() {
  const { user, isLoggedIn } = useAuth();
  const navigate = useNavigate();
  
  const [socketConnected, setSocketConnected] = useState(false);
  const [scanHistory, setScanHistory] = useState<ScanHistoryItem[]>([]);
  const [lastScanned, setLastScanned] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const hasScannedRef = useRef(false);
  const isMountedRef = useRef(true);
  const containerId = 'mobile-scanner-view';

  // ── Track mounted state ──
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Redirect nếu chưa đăng nhập ──
  useEffect(() => {
    if (!isLoggedIn) {
      navigate('/login');
    }
  }, [isLoggedIn, navigate]);

  // ── Kết nối Socket.IO ──
  useEffect(() => {
    if (!user?.id) return;

    const socket = connectSocket();
    
    socket.on('connect', () => {
      setSocketConnected(true);
      joinScannerRoom(user.id);
    });

    socket.on('disconnect', () => {
      setSocketConnected(false);
    });

    socket.on('room_joined', () => {
      setSocketConnected(true);
    });

    // Nhận phản hồi kết quả từ POS laptop
    socket.on('scan_result_feedback', (data: {
      barcode: string;
      success: boolean;
      productName?: string;
      message?: string;
    }) => {
      setScanHistory(prev => prev.map(item =>
        item.barcode === data.barcode && item.success === undefined
          ? { ...item, success: data.success, productName: data.productName, message: data.message }
          : item
      ));
    });

    // Nếu đã connected thì join ngay
    if (socket.connected) {
      setSocketConnected(true);
      joinScannerRoom(user.id);
    }

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room_joined');
      socket.off('scan_result_feedback');
    };
  }, [user?.id]);

  // ── Camera Scanner ──
  const startScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 /* SCANNING */ || state === 3 /* PAUSED */) {
          if (state === 3) scannerRef.current.resume();
          await scannerRef.current.stop();
        }
      } catch (e) {
        // Bỏ qua
      }
      scannerRef.current = null;
    }

    // Clear DOM container to avoid duplicated video elements
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }

    hasScannedRef.current = false;
    if (isMountedRef.current) {
      setLastScanned(null);
      setLoading(true);
      setInitError(null);
      setScanning(true);
    }

    const html5Qrcode = new Html5Qrcode(containerId);
    scannerRef.current = html5Qrcode;

    const scanConfig = {
      fps: 10,
      qrbox: (width: number, height: number) => {
        // Khung quét hình vuông 240x240
        const size = Math.min(width * 0.75, height * 0.75, 240);
        const finalSize = Math.floor(size);
        return { width: finalSize, height: finalSize };
      },
      aspectRatio: 1.0
    };

    const successCallback = (decodedText: string) => {
      if (!isMountedRef.current || hasScannedRef.current) return;
      hasScannedRef.current = true;

      // Pause ngay để tránh lỗi getImageNode
      try {
        html5Qrcode.pause(true);
      } catch (e) {
        // Bỏ qua
      }

      const barcode = decodedText.trim();
      if (isMountedRef.current) {
        setLastScanned(barcode);
      }
      playBeep();

      // Thêm vào lịch sử quét
      if (isMountedRef.current) {
        setScanHistory(prev => [{
          barcode,
          timestamp: Date.now(),
        }, ...prev].slice(0, 20)); // Giữ tối đa 20 mục
      }

      // Gửi barcode tới POS laptop qua Socket.IO
      if (user?.id) {
        emitBarcode(user.id, barcode);
      }

      // Sau 1.5s, tự động quét tiếp
      setTimeout(() => {
        if (!isMountedRef.current) return;
        hasScannedRef.current = false;
        if (isMountedRef.current) {
          setLastScanned(null);
        }
        try {
          if (html5Qrcode.getState() === 3 /* PAUSED */) {
            html5Qrcode.resume();
          }
        } catch (e) {
          // Nếu resume lỗi, khởi động lại scanner
          startScanner();
        }
      }, 1500);
    };

    const errorCallback = () => {};

    try {
      try {
        await html5Qrcode.start(
          { facingMode: 'environment' },
          scanConfig,
          successCallback,
          errorCallback
        );
      } catch {
        if (!isMountedRef.current) return;
        await html5Qrcode.start(
          { facingMode: 'user' },
          scanConfig,
          successCallback,
          errorCallback
        );
      }
      if (isMountedRef.current) {
        setLoading(false);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        setLoading(false);
        setScanning(false);
        setInitError(
          err?.message ||
          'Không thể truy cập camera. Kiểm tra quyền truy cập và kết nối HTTPS.'
        );
      }
    }
  }, [user?.id]);

  // Khởi động scanner khi mount
  useEffect(() => {
    startScanner();

    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        const safeStop = async () => {
          try {
            const state = scanner.getState();
            if (state === 3) scanner.resume();
            if (scanner.isScanning) await scanner.stop();
          } catch (e) {
            // Bỏ qua
          }
          // Clear container when unmounting
          const container = document.getElementById(containerId);
          if (container) {
            container.innerHTML = '';
          }
        };
        safeStop();
      }
    };
  }, [startScanner]);

  const getTimeAgo = (ts: number) => {
    const secs = Math.floor((Date.now() - ts) / 1000);
    if (secs < 5) return 'Vừa xong';
    if (secs < 60) return `${secs}s trước`;
    return `${Math.floor(secs / 60)}p trước`;
  };

  if (!isLoggedIn) return null;

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header — compact */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shrink-0 safe-area-top">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => navigate('/pos')}
            className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center transition active:scale-95"
          >
            <Icon name="arrow_back" size={18} className="text-gray-400" />
          </button>
          <div>
            <h1 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Icon name="qr_code_scanner" size={16} className="text-blue-400" />
              Scanner
            </h1>
            <p className="text-[10px] text-gray-500">{user?.full_name}</p>
          </div>
        </div>
        
        {/* Trạng thái kết nối */}
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
          socketConnected
            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
            : 'bg-red-500/15 text-red-400 border border-red-500/30'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400'}`} />
          {socketConnected ? 'Đã kết nối POS' : 'Mất kết nối'}
        </div>
      </header>

      {/* Camera Scanner — chiếm phần lớn màn hình */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {/* Camera container */}
        <div id={containerId} className="w-full h-full"></div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 bg-gray-950/90 flex flex-col items-center justify-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-400"></div>
            <p className="text-sm text-gray-400 font-medium">Đang mở camera...</p>
          </div>
        )}

        {/* Error overlay */}
        {initError && (
          <div className="absolute inset-0 bg-gray-950/95 flex flex-col items-center justify-center p-6 text-center gap-4">
            <Icon name="videocam_off" size={48} className="text-red-400" />
            <div>
              <p className="text-sm font-semibold text-red-300 mb-1">Không mở được Camera</p>
              <p className="text-xs text-gray-400 max-w-[280px]">{initError}</p>
            </div>
            <button
              onClick={startScanner}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-xl text-sm font-medium transition active:scale-95"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Scanning overlay — khung quét */}
        {scanning && !loading && !initError && !lastScanned && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-black/40"></div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[240px] h-[240px] border-2 border-blue-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
              <div className="absolute -top-1.5 -left-1.5 w-5 h-5 border-t-4 border-l-4 border-blue-400 rounded-tl"></div>
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 border-t-4 border-r-4 border-blue-400 rounded-tr"></div>
              <div className="absolute -bottom-1.5 -left-1.5 w-5 h-5 border-b-4 border-l-4 border-blue-400 rounded-bl"></div>
              <div className="absolute -bottom-1.5 -right-1.5 w-5 h-5 border-b-4 border-r-4 border-blue-400 rounded-br"></div>
              <div className="absolute left-0 w-full h-0.5 bg-red-500 shadow-[0_0_10px_3px_rgba(239,68,68,0.7)] animate-pulse" style={{
                top: '50%', transform: 'translateY(-50%)'
              }}></div>
            </div>
            {/* Hướng dẫn */}
            <div className="absolute bottom-6 left-0 right-0 text-center">
              <p className="text-xs text-white/70 font-medium">Đưa mã vạch vào khung quét</p>
            </div>
          </div>
        )}

        {/* Scanned overlay — hiển thị mã vạch vừa quét */}
        {lastScanned && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-bounce">
              <Icon name="check" size={32} className="text-white" />
            </div>
            <div className="bg-white/95 backdrop-blur-sm px-6 py-3 rounded-xl shadow-lg text-center">
              <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Đã gửi tới POS</p>
              <p className="text-xl font-bold text-gray-900 font-mono tracking-widest">{lastScanned}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom panel — lịch sử quét */}
      <div className="bg-gray-900 border-t border-gray-800 shrink-0 safe-area-bottom">
        {/* Không kết nối warning */}
        {!socketConnected && (
          <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/20 flex items-center gap-2 text-xs text-red-400">
            <Icon name="wifi_off" size={14} />
            <span>Chưa kết nối với POS laptop. Mã vạch sẽ không được gửi.</span>
          </div>
        )}

        {/* Lịch sử quét gần đây */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Đã quét gần đây</p>
            {scanHistory.length > 0 && (
              <button
                onClick={() => setScanHistory([])}
                className="text-[10px] text-gray-500 hover:text-gray-300 transition"
              >
                Xóa
              </button>
            )}
          </div>

          {scanHistory.length === 0 ? (
            <div className="text-center py-4 text-gray-600 text-xs">
              <Icon name="history" size={20} className="text-gray-700 mx-auto mb-1" />
              Chưa quét mã vạch nào
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {scanHistory.slice(0, 5).map((item, idx) => (
                <div
                  key={`${item.barcode}-${item.timestamp}`}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs ${
                    idx === 0 && lastScanned ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-gray-800/50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {item.success === true ? (
                      <Icon name="check_circle" size={14} className="text-emerald-400 shrink-0" />
                    ) : item.success === false ? (
                      <Icon name="error" size={14} className="text-red-400 shrink-0" />
                    ) : (
                      <div className="w-3.5 h-3.5 rounded-full border-2 border-gray-600 border-t-blue-400 animate-spin shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-mono font-medium text-white truncate">{item.barcode}</p>
                      {item.productName && (
                        <p className="text-[10px] text-emerald-400 truncate">{item.productName}</p>
                      )}
                      {item.success === false && item.message && (
                        <p className="text-[10px] text-red-400 truncate">{item.message}</p>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] text-gray-500 shrink-0 ml-2">{getTimeAgo(item.timestamp)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <style>{`
        #mobile-scanner-view {
          width: 100% !important;
          height: 100% !important;
        }
        #mobile-scanner-view video {
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
        }
      `}</style>
    </div>
  );
}
