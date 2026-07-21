// frontend/src/components/BarcodeScanner.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import Icon from './Icon';

interface BarcodeScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onClose: () => void;
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
    // Bỏ qua nếu không phát được âm thanh
  }
};

export default function BarcodeScanner({ onScanSuccess, onClose }: BarcodeScannerProps) {
  const [initError, setInitError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [scannedCode, setScannedCode] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerId = "html5-qrcode-scanner-view";
  
  // Sử dụng ref để tránh re-init camera khi parent re-render
  const onScanSuccessRef = useRef(onScanSuccess);
  onScanSuccessRef.current = onScanSuccess;
  
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  
  // Flag ngăn gọi callback nhiều lần
  const hasScannedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;
    
    // Clear DOM container to avoid duplicate video elements
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = '';
    }

    const html5Qrcode = new Html5Qrcode(containerId);
    scannerRef.current = html5Qrcode;

    let isScanningActive = false;

    const startScanner = async () => {
      try {
        setLoading(true);
        setInitError(null);
        
        const scanConfig = {
          fps: 10,
          qrbox: (width: number, height: number) => {
            // Khung quét hình vuông 180x180 để khớp với chiều cao video
            const size = Math.min(width * 0.6, height * 0.6, 180);
            const finalSize = Math.floor(size);
            return { width: finalSize, height: finalSize };
          },
          aspectRatio: 1.0 // 1:1
        };

        const successCallback = (decodedText: string) => {
          // Chỉ xử lý 1 lần duy nhất
          if (!isMounted || hasScannedRef.current) return;
          hasScannedRef.current = true;
          
          // 1. Ngay lập tức pause scanning loop để thư viện KHÔNG xử lý frame tiếp
          //    pause(true) dừng cả video stream, tránh lỗi getImageNode
          try {
            html5Qrcode.pause(/* pauseVideo */ true);
          } catch (pauseErr) {
            // Bỏ qua nếu pause thất bại
          }
          
          // 2. Hiển thị mã vạch trên overlay
          setScannedCode(decodedText);
          
          // 3. Phát tiếng beep
          playBeep();
          
          // 4. Dừng hoàn toàn camera sau khi scanning loop đã pause
          setTimeout(async () => {
            try {
              if (html5Qrcode.isScanning) {
                await html5Qrcode.stop();
              }
            } catch (stopErr) {
              // Bỏ qua — camera đã pause rồi
            }
            
            // 5. Gọi callback sau delay nhỏ để user thấy kết quả
            setTimeout(() => {
              if (isMounted) {
                onScanSuccessRef.current(decodedText);
              }
            }, 400);
          }, 100);
        };

        const errorCallback = () => {
          // Lỗi đọc khung hình (im lặng để tránh spam log)
        };

        try {
          // 1. Thử camera sau trước (environment) - Tốt nhất cho điện thoại
          await html5Qrcode.start(
            { facingMode: "environment" },
            scanConfig,
            successCallback,
            errorCallback
          );
        } catch (phoneCamErr) {
          console.warn("Không mở được camera sau, thử camera mặc định (laptop):", phoneCamErr);
          if (!isMounted) return;
          // 2. Dự phòng: Thử camera trước/mặc định (user) - Cho máy tính/laptop
          await html5Qrcode.start(
            { facingMode: "user" },
            scanConfig,
            successCallback,
            errorCallback
          );
        }
        
        isScanningActive = true;
        if (isMounted) {
          setLoading(false);
        } else {
          // Nếu component đã bị unmount trong lúc camera đang khởi động
          html5Qrcode.stop().catch(err => console.error("Error stopping camera on late unmount:", err));
        }
      } catch (err: any) {
        console.error("Lỗi khi mở camera:", err);
        if (isMounted) {
          setLoading(false);
          setInitError(
            err?.message || 
            "Không thể truy cập camera. Vui lòng kiểm tra quyền truy cập và đảm bảo bạn đang dùng kết nối HTTPS."
          );
        }
      }
    };

    // Khởi động quét sau khi render
    startScanner();

    return () => {
      isMounted = false;
      // Dừng camera an toàn — có thể đang ở trạng thái paused hoặc scanning
      const safeStop = async () => {
        try {
          const state = html5Qrcode.getState();
          // Nếu đang paused, resume trước rồi stop (tránh lỗi internal state)
          if (state === 3 /* PAUSED */) {
            html5Qrcode.resume();
          }
          if (html5Qrcode.isScanning) {
            await html5Qrcode.stop();
          }
        } catch (err) {
          // Bỏ qua lỗi cleanup
        }
        // Clear container when unmounting
        const container = document.getElementById(containerId);
        if (container) {
          container.innerHTML = '';
        }
      };
      if (html5Qrcode.isScanning || isScanningActive) {
        safeStop();
      }
    };
  }, []); // Không phụ thuộc onScanSuccess — dùng ref thay thế

  const handleClose = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      try {
        const state = scanner.getState();
        if (state === 3 /* PAUSED */) {
          scanner.resume();
        }
        if (scanner.isScanning) {
          await scanner.stop();
        }
      } catch (err) {
        // Bỏ qua lỗi khi đóng
      }
    }
    onCloseRef.current();
  }, []);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in flex flex-col">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-blue-50">
          <div className="flex items-center gap-2">
            <Icon name="qr_code_scanner" size={22} className="text-blue-600 animate-pulse" />
            <h3 className="font-bold text-gray-800">Quét mã bằng Camera</h3>
          </div>
          <button 
            onClick={handleClose} 
            className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm transition active:scale-95"
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {/* Scanner View Area */}
        <div className="p-5 flex flex-col items-center">
          <div className="relative w-full aspect-video bg-black rounded-xl overflow-hidden flex items-center justify-center border border-gray-200 shadow-inner">
            
            {/* Div gắn camera */}
            <div id={containerId} className="w-full h-full object-cover"></div>

            {/* Trạng thái Loading */}
            {loading && (
              <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center gap-3 text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                <p className="text-sm font-medium">Đang khởi chạy camera...</p>
              </div>
            )}

            {/* Trạng thái Lỗi */}
            {initError && (
              <div className="absolute inset-0 bg-gray-900/95 flex flex-col items-center justify-center p-6 text-center text-white space-y-3">
                <Icon name="videocam_off" size={40} className="text-red-400" />
                <p className="text-sm font-semibold text-red-200">Không mở được Camera</p>
                <p className="text-xs text-gray-300 max-w-[280px] leading-relaxed">{initError}</p>
                <div className="text-[10px] text-gray-400 mt-2 bg-black/40 px-2 py-1.5 rounded border border-white/5 max-w-full">
                  Lưu ý: Camera yêu cầu quyền bảo mật HTTPS hoặc chạy trên localhost.
                </div>
              </div>
            )}

            {/* Khung quét giả lập (overlay) khi đang quét */}
            {!loading && !initError && !scannedCode && (
              <div className="absolute inset-0 pointer-events-none border-2 border-transparent">
                <div className="absolute inset-0 bg-black/30"></div>
                
                {/* Lấy khung sáng giữa */}
                <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] h-[180px] border-2 border-blue-500 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                  {/* Góc viền phát sáng */}
                  <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-4 border-l-4 border-blue-400 rounded-tl"></div>
                  <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-4 border-r-4 border-blue-400 rounded-tr"></div>
                  <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-4 border-l-4 border-blue-400 rounded-bl"></div>
                  <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-4 border-r-4 border-blue-400 rounded-br"></div>
                  
                  {/* Đường laser quét chạy lên xuống */}
                  <div className="absolute left-0 w-full h-0.5 bg-red-500 shadow-[0_0_8px_2px_rgba(239,68,68,0.8)] animate-pulse" style={{
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}></div>
                </div>
              </div>
            )}

            {/* Overlay hiển thị mã vạch đã quét thành công */}
            {scannedCode && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-3 pointer-events-none">
                <div className="w-14 h-14 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/40 animate-bounce">
                  <Icon name="check" size={28} className="text-white" />
                </div>
                <div className="bg-white/95 backdrop-blur-sm px-5 py-3 rounded-xl shadow-lg border border-emerald-200 text-center">
                  <p className="text-[10px] text-emerald-600 font-semibold uppercase tracking-wider mb-1">Quét thành công</p>
                  <p className="text-lg font-bold text-gray-900 font-mono tracking-widest">{scannedCode}</p>
                </div>
                <p className="text-xs text-white/60 mt-1">Đang xử lý...</p>
              </div>
            )}
          </div>

          <div className="mt-4 text-center space-y-1">
            {scannedCode ? (
              <p className="text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1.5">
                <Icon name="check_circle" size={14} />
                Mã vạch: <span className="font-mono font-bold text-emerald-700">{scannedCode}</span>
              </p>
            ) : (
              <>
                <p className="text-xs font-medium text-gray-500">
                  Căn chỉnh mã vạch (EAN-13, Code-128) hoặc mã QR vào giữa khung quét
                </p>
                <p className="text-[10px] text-gray-400">
                  Đảm bảo ánh sáng tốt và không bị lóa để máy nhận diện nhanh hơn
                </p>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex justify-end">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 active:scale-95 transition"
          >
            {scannedCode ? 'Đóng' : 'Hủy bỏ'}
          </button>
        </div>

      </div>
    </div>
  );
}
