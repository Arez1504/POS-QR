// frontend/src/pages/POSPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/authService';
import Icon from '../components/Icon';
import CustomerSearch from '../components/CustomerSearch';
import { type Customer, customerService, POINTS_CONFIG } from '../services/customerService';
import { BANK_CONFIG } from '../config/config';
import { useAuth } from '../hooks/useAuth';
import BarcodeScanner from '../components/BarcodeScanner';
import { shiftService, type Shift, type ShiftStats } from '../services/shiftService';
import { connectSocket, joinPosRoom, emitScanResult, getSocket } from '../services/socketService';
import QRCode from 'qrcode';

interface Product {
  id: number; name: string; sku: string; barcode: string;
  price: number; stock_quantity: number; unit: string;
  category_name: string; image: string;
}
interface CartItem extends Product { quantity: number; subtotal: number; }

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

export default function POSPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  // ── State sản phẩm & giỏ hàng ──
  const [products, setProducts]         = useState<Product[]>([]);
  const [cart, setCart]                 = useState<CartItem[]>([]);
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr_transfer'>('cash');
  const [paidAmount, setPaidAmount]     = useState('');
  const [discount, setDiscount]         = useState('');
  const [processing, setProcessing]     = useState(false);
  const [lastOrder, setLastOrder]       = useState<any>(null);
  const [showQRModal, setShowQRModal]   = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [copyStatus, setCopyStatus]     = useState<string | null>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const skipAutoAddRef = useRef(false);

  // ── State Thêm Nhanh Sản Phẩm Mới (quét mã vạch không có sẵn) ──
  const emptyQuickAddForm = {
    name: '', sku: '', barcode: '', description: '', price: '',
    cost_price: '', stock_quantity: '10', min_stock: '5',
    unit: 'cái', category_id: '', image: '', is_active: true
  };
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState(emptyQuickAddForm);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');

  // ── State Socket.IO (quét từ ĐT) ──
  const [scannerConnected, setScannerConnected] = useState(false);
  const [remoteToast, setRemoteToast] = useState<{ barcode: string; productName?: string; success: boolean } | null>(null);
  const [showScannerQR, setShowScannerQR] = useState(false);
  const [scannerQRUrl, setScannerQRUrl] = useState('');
  const [serverLanIp, setServerLanIp] = useState('localhost');

  // ── State ca làm việc ──
  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [shiftStats, setShiftStats] = useState<ShiftStats | null>(null);
  const [showOpenShiftModal, setShowOpenShiftModal] = useState(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState(false);
  const [openingCash, setOpeningCash] = useState('');
  const [closingCash, setClosingCash] = useState('');
  const [shiftNote, setShiftNote] = useState('');
  const [checkingShift, setCheckingShift] = useState(true);
  const [showPostCloseModal, setShowPostCloseModal] = useState(false);
  const [posSettings, setPosSettings] = useState<any>(null);

  const checkShift = async () => {
    if (user?.role === 'admin') {
      setActiveShift(null);
      setShiftStats(null);
      setCheckingShift(false);
      setShowOpenShiftModal(false);
      return;
    }
    try {
      const res = await shiftService.getActive();
      if (res.success && res.data) {
        setActiveShift(res.data);
        if (res.stats) {
          setShiftStats(res.stats);
        }
      } else {
        setActiveShift(null);
        setShiftStats(null);
        setShowOpenShiftModal(true);
      }
    } catch (e) {
      console.error('Error checking active shift:', e);
    } finally {
      setCheckingShift(false);
    }
  };

  useEffect(() => {
    checkShift();
    // Lấy IP LAN của server để tạo link QR chính xác
    api.get('/health')
      .then(res => {
        if (res.data.success && res.data.lanIp) {
          setServerLanIp(res.data.lanIp);
        }
      })
      .catch(err => console.error('Lỗi lấy IP LAN của server:', err));

    // Nạp cấu hình POS VietQR
    api.get('/settings')
      .then(res => {
        if (res.data.success) {
          setPosSettings(res.data.data);
        }
      })
      .catch(err => console.error('Lỗi lấy cấu hình POS settings:', err));

    // Nạp danh mục sản phẩm
    api.get('/products/categories')
      .then(res => {
        if (res.data.success) {
          setCategories(res.data.data || []);
        }
      })
      .catch(err => console.error('Lỗi lấy danh mục sản phẩm:', err));
  }, []);

  // ── Polling kiểm tra trạng thái thanh toán chuyển khoản QR ──
  useEffect(() => {
    let intervalId: any = null;

    if (showQRModal && lastOrder && lastOrder.id && lastOrder.payment_method === 'qr_transfer') {
      intervalId = setInterval(async () => {
        try {
          const res = await api.get(`/orders/${lastOrder.id}`);
          if (res.data.success && res.data.data.payment_status === 'paid') {
            // Phát tiếng báo thanh toán thành công (ting ting)
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc1 = audioCtx.createOscillator();
              const osc2 = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              osc1.connect(gainNode);
              osc2.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              
              osc1.type = 'sine';
              osc1.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
              osc1.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
              
              osc2.type = 'triangle';
              osc2.frequency.setValueAtTime(587.33, audioCtx.currentTime);
              osc2.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1);

              gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
              gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
              
              osc1.start(audioCtx.currentTime);
              osc2.start(audioCtx.currentTime);
              osc1.stop(audioCtx.currentTime + 0.4);
              osc2.stop(audioCtx.currentTime + 0.4);
            } catch (soundErr) {
              console.log('Không phát được âm thanh:', soundErr);
            }

            clearInterval(intervalId);
            setShowQRModal(false);
            setShowSuccessModal(true);
            checkShift(); // Cập nhật doanh thu ca làm việc sau khi thanh toán thành công
          }
        } catch (err) {
          console.error('Lỗi khi polling trạng thái thanh toán:', err);
        }
      }, 2500); // 2.5 giây polling 1 lần
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [showQRModal, lastOrder]);

  const handleOpenShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingCash || isNaN(Number(openingCash))) {
      alert('Vui lòng nhập số tiền hợp lệ');
      return;
    }
    setProcessing(true);
    try {
      const shift = await shiftService.open(Number(openingCash));
      setActiveShift(shift.data);
      setShowOpenShiftModal(false);
      setOpeningCash('');
      
      const res = await shiftService.getActive();
      if (res.success && res.stats) setShiftStats(res.stats);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể mở ca làm việc');
    } finally {
      setProcessing(false);
    }
  };

  const handleCloseShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingCash || isNaN(Number(closingCash))) {
      alert('Vui lòng nhập số tiền hợp lệ');
      return;
    }
    setProcessing(true);
    try {
      await shiftService.close(Number(closingCash), shiftNote);
      setActiveShift(null);
      setShiftStats(null);
      setShowCloseShiftModal(false);
      setShowPostCloseModal(true); // Hiển thị bảng hỏi đăng xuất/kiểm tra lại
    } catch (err: any) {
      alert(err.response?.data?.message || 'Không thể đóng ca làm việc');
    } finally {
      setProcessing(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (e) {
      console.error(e);
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      window.location.href = '/login';
    }
  };

  const getDurationStr = (start: string, end: string | null) => {
    const sTime = new Date(start).getTime();
    const eTime = end ? new Date(end).getTime() : Date.now();
    const diffMs = eTime - sTime;
    const diffMins = Math.floor(diffMs / 60000);
    const hrs = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    if (hrs > 0) return `${hrs}h ${mins}p`;
    return `${mins} phút`;
  };

  // ── State khách hàng & điểm ──
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [usePoints, setUsePoints]               = useState(false);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopyStatus(label);
    setTimeout(() => setCopyStatus(null), 2000);
  };

  // ── Tính toán giá ──
  const subtotal      = cart.reduce((s, i) => s + i.subtotal, 0);
  const discountAmt   = Number(discount) || 0;

  const maxPointsDiscount = selectedCustomer
    ? Math.min(
        customerService.calculatePointsValue(selectedCustomer.reward_points),
        Math.floor(subtotal * 0.5)
      )
    : 0;
  const pointsDiscount  = usePoints && selectedCustomer
    ? Math.floor(maxPointsDiscount / POINTS_CONFIG.VND_PER_POINT) * POINTS_CONFIG.VND_PER_POINT
    : 0;
  const pointsRedeemed  = pointsDiscount / POINTS_CONFIG.VND_PER_POINT;

  const totalDiscount   = discountAmt + pointsDiscount;
  const total           = Math.max(0, subtotal - totalDiscount);
  const paid            = Number(paidAmount) || 0;
  const change          = Math.max(0, paid - total);

  const willEarnPoints  = selectedCustomer
    ? customerService.calculateEarnedPoints(total)
    : 0;

  // ── Thêm vào giỏ ──
  const addToCart = (product: Product) => {
    if (product.stock_quantity <= 0) { alert('Sản phẩm đã hết hàng!'); return; }
    // Ép kiểu price về number — MySQL trả về string dạng "15000.00"
    const price = Number(product.price);
    setCart(prev => {
      const existing = prev.find(i => i.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock_quantity) { alert('Không đủ tồn kho!'); return prev; }
        return prev.map(i => i.id === product.id
          ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.price }
          : i
        );
      }
      return [...prev, { ...product, price, quantity: 1, subtotal: price }];
    });
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/products?limit=50${search ? `&search=${search}` : ''}`);
      const list = res.data.data || [];
      setProducts(list);
      if (search.trim() && list.length === 1) {
        const p = list[0];
        const term = search.trim();
        if (p.barcode === term || p.sku === term) {
          if (p.stock_quantity > 0) {
            if (!skipAutoAddRef.current) {
              addToCart(p);
            }
            setSearch('');
          }
        }
      }
    } catch { setProducts([]); }
    skipAutoAddRef.current = false;
    setLoading(false);
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim() !== '' && !loading) {
      const term = search.trim();
      const searchLower = term.toLowerCase();
      
      // 1. Thử khớp nhanh sản phẩm đầu tiên trong danh sách kết quả hiển thị
      if (products.length > 0) {
        const firstProduct = products[0];
        if (
          firstProduct.name.toLowerCase().includes(searchLower) ||
          (firstProduct.sku && firstProduct.sku.toLowerCase().includes(searchLower)) ||
          (firstProduct.barcode && firstProduct.barcode.toLowerCase().includes(searchLower))
        ) {
          if (firstProduct.stock_quantity > 0) {
            addToCart(firstProduct);
            setSearch('');
            return;
          } else {
            alert(`Sản phẩm "${firstProduct.name}" đã hết hàng!`);
            return;
          }
        }
      }

      // 2. Nếu không khớp hiển thị, thử tìm chính xác bằng API (mã vạch / SKU)
      try {
        const res = await api.get(`/products?search=${encodeURIComponent(term)}`);
        const list = res.data.data || [];
        const foundRemote = list.find((p: Product) => p.barcode === term || p.sku === term);
        if (foundRemote) {
          if (foundRemote.stock_quantity > 0) {
            addToCart(foundRemote);
            setSearch('');
          } else {
            alert(`Sản phẩm "${foundRemote.name}" đã hết hàng!`);
          }
        } else {
          // 3. Nếu vẫn không tìm thấy, và chuỗi giống mã vạch (>= 5 ký tự không khoảng trắng), kích hoạt thêm nhanh
          if (term.length >= 5 && !/\s/.test(term)) {
            handleUnknownBarcode(term);
          } else {
            alert(`Không tìm thấy sản phẩm có từ khóa: "${term}"`);
          }
        }
      } catch (err) {
        console.error("Lỗi khi tìm kiếm sản phẩm:", err);
      }
    }
  };

  useEffect(() => { fetchProducts(); }, [search]);

  // ── Tra cứu và Thêm nhanh sản phẩm ──
  const lookupProductByBarcode = async (barcodeVal: string) => {
    let result = { name: '', image: '', unit: 'cái' };
    try {
      // 1. Thử Open Food Facts
      const resOFF = await fetch(`https://fr.openfoodfacts.org/api/v0/product/${barcodeVal}.json`);
      if (resOFF.ok) {
        const dataOFF = await resOFF.json();
        if (dataOFF.status === 1 && dataOFF.product) {
          const prod = dataOFF.product;
          const name = prod.product_name_vi || prod.product_name || prod.product_name_en || '';
          const brand = prod.brands ? ` [${prod.brands}]` : '';
          const finalName = name ? `${name}${brand}` : '';
          const imageUrl = prod.image_url || prod.image_front_url || '';
          const unit = prod.quantity ? String(prod.quantity) : 'cái';
          return { name: finalName, image: imageUrl, unit };
        }
      }

      // 2. Thử UpcItemDb
      const resUPC = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcodeVal}`);
      if (resUPC.ok) {
        const dataUPC = await resUPC.json();
        if (dataUPC.items && dataUPC.items.length > 0) {
          const item = dataUPC.items[0];
          const name = item.title || '';
          const brand = item.brand ? ` [${item.brand}]` : '';
          const finalName = name ? `${name}${brand}` : '';
          const imageUrl = item.images && item.images.length > 0 ? item.images[0] : '';
          return { name: finalName, image: imageUrl, unit: 'cái' };
        }
      }
    } catch (err) {
      console.error("Lỗi tra cứu mã vạch kết hợp:", err);
    }
    return result;
  };

  const handleUnknownBarcode = useCallback(async (barcodeVal: string) => {
    setQuickAddForm({
      ...emptyQuickAddForm,
      barcode: barcodeVal,
      sku: barcodeVal,
    });
    setQuickAddError('');
    setShowQuickAddModal(true);
    setQuickAddLoading(true);

    try {
      const info = await lookupProductByBarcode(barcodeVal);
      setQuickAddForm(prev => ({
        ...prev,
        name: info.name || prev.name,
        image: info.image || prev.image,
        unit: info.unit || prev.unit
      }));
    } catch (err) {
      console.error("Lỗi tự động tra cứu mã vạch:", err);
    } finally {
      setQuickAddLoading(false);
    }
  }, [categories]);

  const handleSaveQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddForm.name.trim() || !quickAddForm.price) {
      setQuickAddError('Tên và giá sản phẩm là bắt buộc');
      return;
    }
    setQuickAddSaving(true);
    setQuickAddError('');
    try {
      const payload = {
        ...quickAddForm,
        price: Number(quickAddForm.price),
        cost_price: Number(quickAddForm.cost_price) || 0,
        stock_quantity: Number(quickAddForm.stock_quantity) || 0,
        min_stock: Number(quickAddForm.min_stock) || 5,
        category_id: quickAddForm.category_id ? Number(quickAddForm.category_id) : null,
      };
      const res = await api.post('/products', payload);
      const newProd = res.data.data;

      const catName = categories.find(c => c.id === Number(quickAddForm.category_id))?.name || '';
      const prodForCart: Product = {
        id: newProd.id,
        name: newProd.name,
        sku: newProd.sku || '',
        barcode: newProd.barcode || '',
        price: Number(newProd.price),
        stock_quantity: Number(newProd.stock_quantity),
        unit: newProd.unit || 'cái',
        category_name: catName,
        image: newProd.image || ''
      };

      addToCart(prodForCart);
      fetchProducts();

      if (user?.id && newProd.barcode) {
        emitScanResult(user.id, newProd.barcode, true, newProd.name);
      }

      setShowQuickAddModal(false);
      setSearch('');
    } catch (err: any) {
      setQuickAddError(err.response?.data?.message || 'Có lỗi xảy ra khi thêm sản phẩm');
    } finally {
      setQuickAddSaving(false);
    }
  };

  // ── Socket.IO: Nhận barcode từ ĐT Scanner ──
  const handleRemoteBarcode = useCallback(async (data: { barcode: string; scannedBy: string }) => {
    const term = data.barcode.trim();
    if (!term) return;

    // Bật cờ bỏ qua auto-add trong fetchProducts để tránh thêm trùng 2 lần
    skipAutoAddRef.current = true;
    setSearch(term);

    // Tìm SP
    let found: Product | undefined;
    found = products.find(p => p.barcode === term || p.sku === term);

    if (!found) {
      try {
        const res = await api.get(`/products?search=${encodeURIComponent(term)}`);
        const list = res.data.data || [];
        found = list.find((p: Product) => p.barcode === term || p.sku === term);
      } catch (err) {
        console.error('Lỗi tìm SP từ remote scan:', err);
      }
    }

    if (found) {
      if (found.stock_quantity > 0) {
        addToCart(found);
        setRemoteToast({ barcode: term, productName: found.name, success: true });
        // Phản hồi cho ĐT
        if (user?.id) {
          emitScanResult(user.id, term, true, found.name);
        }
      } else {
        setRemoteToast({ barcode: term, productName: found.name, success: false });
        if (user?.id) {
          emitScanResult(user.id, term, false, found.name, 'Hết hàng');
        }
      }
    } else {
      setRemoteToast({ barcode: term, success: false });
      if (user?.id) {
        emitScanResult(user.id, term, false, undefined, 'Không tìm thấy SP. Đang thêm...');
      }
      handleUnknownBarcode(term);
    }

    // Xóa search bar và toast sau 2s
    setTimeout(() => setSearch(''), 800);
    setTimeout(() => setRemoteToast(null), 3000);
  }, [products, user?.id, handleUnknownBarcode]);

  useEffect(() => {
    if (!user?.id) return;

    const socket = connectSocket();
    joinPosRoom(user.id);

    socket.on('scanner_connected', () => {
      setScannerConnected(true);
    });

    socket.on('scanner_disconnected', () => {
      setScannerConnected(false);
    });

    socket.on('new_barcode', handleRemoteBarcode);

    return () => {
      socket.off('scanner_connected');
      socket.off('scanner_disconnected');
      socket.off('new_barcode', handleRemoteBarcode);
    };
  }, [user?.id, handleRemoteBarcode]);

  const getScannerPageUrl = () => {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      const port = window.location.port ? `:${window.location.port}` : '';
      return `http://${serverLanIp}${port}/scanner`;
    }
    return `${window.location.origin}/scanner`;
  };

  useEffect(() => {
    if (showScannerQR) {
      QRCode.toDataURL(getScannerPageUrl(), { width: 256, margin: 2 })
        .then(url => setScannerQRUrl(url))
        .catch(err => console.error('Error generating scanner QR:', err));
    }
  }, [showScannerQR, serverLanIp]);

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) { removeItem(id); return; }
    const stockCheck = products.find(p => p.id === id);
    if (stockCheck && qty > Number(stockCheck.stock_quantity)) { alert('Không đủ tồn kho!'); return; }
    setCart(prev => prev.map(i => i.id === id
      ? { ...i, quantity: qty, subtotal: qty * Number(i.price) }
      : i
    ));
  };

  const removeItem = (id: number) => setCart(prev => prev.filter(i => i.id !== id));

  // ── Thanh toán ──
  const handleCheckout = async () => {
    if (!cart.length) return;
    if (!activeShift && user?.role !== 'admin') {
      alert('Bạn cần mở ca làm việc trước khi thực hiện thanh toán!');
      setShowOpenShiftModal(true);
      return;
    }
    if (paymentMethod === 'cash' && paid < total) { alert('Số tiền khách đưa chưa đủ!'); return; }
    setProcessing(true);
    try {
      const res = await api.post('/orders', {
        customer_id     : selectedCustomer?.id || null,
        items           : cart.map(i => ({ product_id: i.id, quantity: i.quantity })),
        payment_method  : paymentMethod,
        paid_amount     : paid || total,
        discount_amount : discountAmt,
        use_points      : usePoints && !!selectedCustomer,
        note            : null,
      });
      const ord = res.data.data;
      setLastOrder(ord);
      if (paymentMethod === 'qr_transfer') {
        setShowQRModal(true);
      } else {
        setShowSuccessModal(true);
      }
      setCart([]);
      setPaidAmount('');
      setDiscount('');
      setUsePoints(false);
      setSelectedCustomer(null);
      fetchProducts();
      checkShift();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi tạo đơn hàng');
    }
    setProcessing(false);
  };

  const handleManualConfirmPayment = async () => {
    if (!lastOrder) return;
    setProcessing(true);
    try {
      await api.post('/payments/simulate', {
        order_code: lastOrder.order_code,
        amount: lastOrder.total_amount
      });
      setShowQRModal(false);
      setShowSuccessModal(true);
      checkShift();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi xác nhận thanh toán');
    } finally {
      setProcessing(false);
    }
  };

  const handleCameraScanSuccess = async (scannedBarcode: string) => {
    setShowCameraScanner(false);
    if (!scannedBarcode) return;
    const term = scannedBarcode.trim();
    
    // Bật cờ bỏ qua auto-add trong fetchProducts để tránh thêm trùng 2 lần
    skipAutoAddRef.current = true;
    setSearch(term);
    
    // Tìm sản phẩm trong danh sách hiện tại
    const foundLocal = products.find(p => p.barcode === term || p.sku === term);
    if (foundLocal) {
      if (foundLocal.stock_quantity > 0) {
        addToCart(foundLocal);
        // Xóa thanh tìm kiếm sau khi thêm thành công
        setTimeout(() => setSearch(''), 800);
      } else {
        alert(`Sản phẩm "${foundLocal.name}" đã hết hàng!`);
      }
    } else {
      // Tìm trên server nếu không có trong danh sách local
      try {
        const res = await api.get(`/products?search=${encodeURIComponent(term)}`);
        const list = res.data.data || [];
        const foundRemote = list.find((p: Product) => p.barcode === term || p.sku === term);
        if (foundRemote) {
          if (foundRemote.stock_quantity > 0) {
            addToCart(foundRemote);
            // Xóa thanh tìm kiếm sau khi thêm thành công
            setTimeout(() => setSearch(''), 800);
          } else {
            alert(`Sản phẩm "${foundRemote.name}" đã hết hàng!`);
          }
        } else {
          handleUnknownBarcode(term);
        }
      } catch (err) {
        console.error("Lỗi khi tìm sản phẩm quét được:", err);
        alert(`Lỗi hệ thống khi tìm mã vạch: ${scannedBarcode}`);
      }
    }
    
    // Focus lại thanh tìm kiếm
    searchRef.current?.focus();
  };

  // Payment method buttons config
  const paymentMethods = [
    { key: 'cash',        label: 'Tiền mặt', icon: 'payments' },
    { key: 'qr_transfer', label: 'QR',       icon: 'qr_code_scanner' },
  ];

  if (checkingShift) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50/50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="flex h-full relative">
      {/* ── Modal: Mở ca làm việc ── */}
      {showOpenShiftModal && user?.role !== 'admin' && (
        <div className="fixed inset-0 bg-gray-950/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6">
            <div className="text-center mb-5">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-blue-100">
                <Icon name="assignment_ind" size={26} fill />
              </div>
              <h3 className="font-bold text-gray-800 text-base">Mở ca làm việc</h3>
              <p className="text-gray-400 text-xs mt-1">Vui lòng nhập số tiền mặt đầu ca trong két để bắt đầu bán hàng</p>
            </div>
            <form onSubmit={handleOpenShift} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Số tiền mặt đầu ca (VNĐ) *</label>
                <input
                  type="number"
                  required
                  placeholder="vd: 500000"
                  value={openingCash}
                  onChange={e => setOpeningCash(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  autoFocus
                />
                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[0, 200000, 500000, 1000000].map(a => (
                    <button
                      type="button"
                      key={a}
                      onClick={() => setOpeningCash(String(a))}
                      className="py-1 bg-gray-50 hover:bg-gray-100 border border-gray-100 text-[10px] text-gray-600 rounded-lg"
                    >
                      {a === 0 ? '0đ' : a >= 1000000 ? `${a / 1000000}tr` : `${a / 1000}k`}
                    </button>
                  ))}
                </div>
              </div>
              <button
                type="submit"
                disabled={processing}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-2"
              >
                {processing ? 'Đang mở ca...' : 'Mở ca bán hàng'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Đóng ca làm việc ── */}
      {showCloseShiftModal && activeShift && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6">
            <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2.5">
              <h3 className="font-bold text-gray-800 text-base">Đóng ca làm việc</h3>
              <button type="button" onClick={() => setShowCloseShiftModal(false)} className="text-gray-400 hover:text-gray-600 text-base">✕</button>
            </div>
            <div className="space-y-4">
              <div className="bg-gray-50 border border-gray-100 rounded-xl p-3.5 text-xs space-y-2">
                <div className="flex justify-between text-gray-500">
                  <span>Thời gian mở:</span>
                  <span className="font-semibold text-gray-700">{new Date(activeShift.start_time).toLocaleTimeString('vi-VN')}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Thời lượng:</span>
                  <span className="font-semibold text-gray-700">{getDurationStr(activeShift.start_time, null)}</span>
                </div>
                <div className="h-px bg-gray-200 my-1.5" />
                <div className="flex justify-between text-gray-500">
                  <span>Tiền mặt đầu ca:</span>
                  <span className="font-semibold text-gray-800">{fmt(Number(activeShift.opening_cash))}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Doanh thu tiền mặt (+):</span>
                  <span className="font-semibold text-emerald-600">{fmt(shiftStats?.cash_sales || 0)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Doanh thu khác (+):</span>
                  <span className="font-semibold text-gray-600">{fmt(shiftStats?.non_cash_sales || 0)}</span>
                </div>
                <div className="flex justify-between text-gray-500 pt-1.5 border-t border-dashed border-gray-200 font-medium">
                  <span className="text-gray-855 font-bold">Két tiền mặt dự kiến:</span>
                  <span className="font-bold text-blue-600">{fmt(Number(activeShift.opening_cash) + Number(shiftStats?.cash_sales || 0))}</span>
                </div>
              </div>

              <form onSubmit={handleCloseShift} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Số tiền mặt thực tế kiểm két *</label>
                  <input
                    type="number"
                    required
                    placeholder="Nhập số tiền mặt thực tế trong két"
                    value={closingCash}
                    onChange={e => setClosingCash(e.target.value)}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                  />
                  {closingCash && (() => {
                    const expected = Number(activeShift.opening_cash) + Number(shiftStats?.cash_sales || 0);
                    const diff = Number(closingCash) - expected;
                    return (
                      <div className="text-xs mt-1.5 font-medium flex items-center justify-between">
                        <span className="text-gray-500">Chênh lệch két tiền:</span>
                        {diff === 0 ? (
                          <span className="text-emerald-600">Khớp két (0đ)</span>
                        ) : diff > 0 ? (
                          <span className="text-teal-600">Dư két: +{fmt(diff)}</span>
                        ) : (
                          <span className="text-rose-600">Hụt két: {fmt(diff)}</span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Ghi chú kết ca</label>
                  <textarea
                    placeholder="Lý do chênh lệch hoặc ghi chú bàn giao..."
                    value={shiftNote}
                    onChange={e => setShiftNote(e.target.value)}
                    rows={2}
                    className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCloseShiftModal(false)}
                    className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={processing}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2.5 rounded-xl transition text-sm flex items-center justify-center gap-1.5 shadow-md shadow-rose-100"
                  >
                    Đóng ca
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Hỏi Đăng xuất / Kiểm tra lại ── */}
      {showPostCloseModal && (
        <div className="fixed inset-0 bg-gray-950/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-100 shadow-sm">
                <Icon name="check_circle" size={28} fill className="text-emerald-500 animate-pulse" />
              </div>
              <h3 className="font-bold text-gray-800 text-base">Đã đóng ca làm việc</h3>
              <p className="text-gray-400 text-xs mt-1">Ca làm việc của bạn đã được đóng và quyết toán thành công.</p>
            </div>
            
            <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3.5 text-xs text-blue-700 leading-relaxed mb-5">
              💡 Bạn muốn <strong>Đăng xuất</strong> khỏi tài khoản ngay bây giờ, hay ở lại để <strong>Kiểm tra lại</strong> dữ liệu đơn hàng/báo cáo vừa tạo?
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowPostCloseModal(false);
                }}
                className="flex-1 border border-gray-200 text-gray-700 py-2.5 rounded-xl text-sm font-semibold hover:bg-gray-50 transition active:scale-[0.98]"
              >
                Kiểm tra lại
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl text-sm font-semibold transition shadow-md shadow-blue-200 flex items-center justify-center gap-1 active:scale-[0.98]"
              >
                <Icon name="logout" size={16} />
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          LEFT — Danh sách sản phẩm
          ═══════════════════════════════════════ */}
      <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
        {/* Ca làm việc status bar */}
        {activeShift ? (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100 px-4 py-3 flex items-center justify-between text-sm shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
                <Icon name="assignment_ind" size={18} fill />
              </div>
              <div>
                <div className="font-semibold text-gray-800 flex items-center gap-1.5">
                  Ca #{activeShift.id} - Đang hoạt động
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Mở lúc {new Date(activeShift.start_time).toLocaleTimeString('vi-VN')} ({new Date(activeShift.start_time).toLocaleDateString('vi-VN')}) • Đầu ca: {fmt(Number(activeShift.opening_cash))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="font-bold text-blue-700">Doanh thu ca: {fmt(shiftStats?.total_sales || 0)}</div>
                <div className="text-xs text-gray-500 mt-0.5">Két tiền dự kiến: {fmt(Number(activeShift.opening_cash) + Number(shiftStats?.cash_sales || 0))} ({shiftStats?.total_orders || 0} đơn)</div>
              </div>
              <button
                onClick={() => {
                  setClosingCash(String(Number(activeShift.opening_cash) + Number(shiftStats?.cash_sales || 0)));
                  setShiftNote('');
                  setShowCloseShiftModal(true);
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg text-xs font-semibold transition border border-rose-200 active:scale-95 shrink-0"
              >
                Đóng ca làm
              </button>
            </div>
          </div>
        ) : user?.role !== 'admin' ? (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between text-xs text-amber-700 font-semibold shrink-0">
            <span className="flex items-center gap-1.5">
              <Icon name="warning" size={16} fill className="text-amber-500" />
              Ca làm việc đang đóng. Hãy mở ca làm việc mới để bắt đầu sử dụng chức năng bán hàng.
            </span>
            <button
              onClick={() => setShowOpenShiftModal(true)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg transition active:scale-95 font-semibold text-[10px] uppercase tracking-wide shadow-sm"
            >
              Mở ca bán hàng
            </button>
          </div>
        ) : (
          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center justify-between text-xs text-blue-700 font-semibold shrink-0">
            <span className="flex items-center gap-1.5">
              <Icon name="admin_panel_settings" size={16} fill className="text-blue-500" />
              Chế độ quản trị viên: Không cần mở ca. Bạn có thể bán hàng trực tiếp.
            </span>
          </div>
        )}

        {/* Search sản phẩm */}
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="flex gap-2 items-center">
            <div className="relative flex-1">
              <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Tìm sản phẩm theo tên, SKU, mã vạch..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                className="w-full pl-9 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <Icon name="close" size={16} />
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowCameraScanner(true)}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl flex items-center gap-1.5 transition text-sm font-medium shadow-md shadow-blue-100 active:scale-95 flex-shrink-0"
              title="Quét mã vạch bằng camera"
            >
              <Icon name="photo_camera" size={18} />
              <span className="hidden sm:inline">Quét camera</span>
            </button>
            {/* Nút mở Scanner trên ĐT */}
            <button
              type="button"
              onClick={() => setShowScannerQR(true)}
              className={`px-3 py-2.5 rounded-xl flex items-center gap-1.5 transition text-sm font-medium active:scale-95 flex-shrink-0 border ${
                scannerConnected
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
              title="Mở Scanner trên điện thoại"
            >
              <Icon name="smartphone" size={18} />
              {scannerConnected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />}
              <span className="hidden sm:inline">{scannerConnected ? 'ĐT đã kết nối' : 'Quét bằng ĐT'}</span>
            </button>
          </div>
        </div>

        {/* Products grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.map(p => (
                <button key={p.id} onClick={() => addToCart(p)}
                  disabled={p.stock_quantity <= 0}
                  className={`bg-white rounded-xl border p-3 text-left transition hover:shadow-md hover:border-blue-300 active:scale-95
                    ${p.stock_quantity <= 0 ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                  <div className="w-full h-20 bg-gray-100 rounded-lg flex items-center justify-center mb-2">
                    {p.image
                      ? <img src={p.image} className="w-full h-full object-cover rounded-lg" alt={p.name} />
                      : <Icon name="inventory_2" size={32} className="text-gray-300" />
                    }
                  </div>
                  <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                  <p className="text-xs text-gray-400 mb-1">{p.category_name}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-blue-600">{fmt(p.price)}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${p.stock_quantity <= 5 ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                      {p.stock_quantity <= 0 ? 'Hết' : `Còn ${p.stock_quantity}`}
                    </span>
                  </div>
                </button>
              ))}
              {!loading && products.length === 0 && (
                <div className="col-span-4 text-center py-12 text-gray-400">
                  <Icon name="search_off" size={40} className="text-gray-300 mb-2 mx-auto" />
                  <p>Không tìm thấy sản phẩm</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ═══════════════════════════════════════
          RIGHT — Giỏ hàng & Thanh toán
          ═══════════════════════════════════════ */}
      <div className="w-80 bg-white border-l border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-900 flex items-center gap-1.5">
              <Icon name="shopping_cart" size={18} fill className="text-blue-500" />
              Đơn hàng
            </h2>
            {cart.length > 0 && (
              <button onClick={() => setCart([])} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
                <Icon name="delete_sweep" size={14} />
                Xóa tất cả
              </button>
            )}
          </div>

          {/* ── Tìm kiếm khách hàng ── */}
          <CustomerSearch
            selectedCustomer={selectedCustomer}
            usePoints={usePoints}
            pointsDiscount={pointsDiscount}
            onCustomerSelect={setSelectedCustomer}
            onUsePointsChange={setUsePoints}
          />
        </div>

        {/* Thông báo thành công */}
        {lastOrder && (
          <div className="mx-3 mt-3 bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-green-700 text-sm font-medium flex items-center gap-1.5">
              <Icon name="check_circle" size={16} fill className="text-green-500" />
              Đơn {lastOrder.order_code} thành công!
            </p>
            {lastOrder.loyalty_summary && (
              <div className="mt-1 text-xs text-green-600 space-y-0.5">
                {lastOrder.loyalty_summary.points_earned > 0 && (
                  <p className="flex items-center gap-1">
                    <Icon name="card_giftcard" size={12} />
                    Cộng {lastOrder.loyalty_summary.points_earned} điểm
                  </p>
                )}
                {lastOrder.loyalty_summary.points_redeemed > 0 && (
                  <p className="flex items-center gap-1">
                    <Icon name="redeem" size={12} />
                    Đã dùng {lastOrder.loyalty_summary.points_redeemed} điểm (
                    -{fmt(lastOrder.loyalty_summary.points_discount)})
                  </p>
                )}
              </div>
            )}
            <button onClick={() => setLastOrder(null)} className="text-xs text-green-600 mt-1">Đóng</button>
          </div>
        )}

        {/* Cart items */}
        <div className="flex-1 overflow-y-auto">
          {cart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-300">
              <Icon name="shopping_cart" size={48} className="text-gray-200 mb-3" />
              <p className="text-sm">Chưa có sản phẩm</p>
              <p className="text-xs">Click vào sản phẩm để thêm</p>
            </div>
          ) : (
            <div className="p-3 space-y-2">
              {cart.map(item => (
                <div key={item.id} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-medium text-gray-900 flex-1 pr-2">{item.name}</p>
                    <button onClick={() => removeItem(item.id)}
                      className="text-gray-300 hover:text-red-500 transition">
                      <Icon name="close" size={16} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, item.quantity - 1)}
                        className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition">
                        <Icon name="remove" size={16} />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                      <button onClick={() => updateQty(item.id, item.quantity + 1)}
                        className="w-7 h-7 rounded-lg bg-gray-200 hover:bg-gray-300 flex items-center justify-center transition">
                        <Icon name="add" size={16} />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-blue-600">{fmt(item.subtotal)}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{fmt(item.price)} × {item.quantity}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Summary & Checkout */}
        {cart.length > 0 && (
          <div className="border-t border-gray-100 p-4 space-y-3">
            {/* Giảm giá trực tiếp */}
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600 w-24 flex-shrink-0">Giảm giá:</label>
              <input type="number" value={discount} onChange={e => setDiscount(e.target.value)}
                placeholder="0"
                className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-xs text-gray-400">đ</span>
            </div>

            {/* Bảng tổng tiền */}
            <div className="space-y-1 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Tạm tính:</span><span>{fmt(subtotal)}</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Giảm giá:</span><span>-{fmt(discountAmt)}</span>
                </div>
              )}
              {pointsDiscount > 0 && (
                <div className="flex justify-between text-amber-600">
                  <span>Trừ điểm ({pointsRedeemed} điểm):</span>
                  <span>-{fmt(pointsDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base pt-1 border-t border-gray-100">
                <span>Tổng cộng:</span>
                <span className="text-blue-600">{fmt(total)}</span>
              </div>
              {selectedCustomer && willEarnPoints > 0 && (
                <div className="flex justify-between text-xs text-amber-500">
                  <span>Sẽ nhận:</span>
                  <span className="flex items-center gap-1">
                    +{willEarnPoints} điểm
                    <Icon name="card_giftcard" size={12} className="text-amber-400" />
                  </span>
                </div>
              )}
            </div>

            {/* Phương thức thanh toán */}
            <div className="grid grid-cols-3 gap-1">
              {paymentMethods.map(m => (
                <button key={m.key} onClick={() => setPaymentMethod(m.key as any)}
                  className={`py-2 rounded-lg text-xs font-medium transition flex flex-col items-center gap-0.5
                    ${paymentMethod === m.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  <Icon name={m.icon} size={16} fill={paymentMethod === m.key} />
                  {m.label}
                </button>
              ))}
            </div>

            {/* Tiền mặt */}
            {paymentMethod === 'cash' && (
              <div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-600 w-24 flex-shrink-0">Khách đưa:</label>
                  <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)}
                    placeholder={String(total)}
                    className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                {paid > 0 && (
                  <div className="flex justify-between text-sm mt-1 text-green-600 font-medium">
                    <span>Tiền thừa:</span><span>{fmt(change)}</span>
                  </div>
                )}
                {/* Quick amounts */}
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {[50000, 100000, 200000, 500000, 1000000].filter(a => a >= total).slice(0, 3).map(a => (
                    <button key={a} onClick={() => setPaidAmount(String(a))}
                      className="py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs text-gray-600">
                      {a >= 1000000 ? `${a / 1000000}tr` : `${a / 1000}k`}
                    </button>
                  ))}
                  <button onClick={() => setPaidAmount(String(total))}
                    className="py-1.5 bg-blue-50 hover:bg-blue-100 rounded-lg text-xs text-blue-600 font-medium">
                    Đủ tiền
                  </button>
                </div>
              </div>
            )}

            {/* Checkout button */}
            <button onClick={handleCheckout} disabled={processing}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold py-3 rounded-xl transition text-sm flex items-center justify-center gap-2">
              {processing
                ? <><div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" /> Đang xử lý...</>
                : <><Icon name="check_circle" size={18} fill /> Thanh toán {fmt(total)}</>
              }
            </button>
          </div>
        )}
      </div>

      {/* VietQR Payment Modal */}
      {showQRModal && lastOrder && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden animate-scale-in flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-blue-50">
              <div className="flex items-center gap-2">
                <Icon name="qr_code_scanner" size={24} className="text-blue-600 animate-pulse" />
                <div>
                  <h3 className="font-bold text-gray-800">Thanh toán chuyển khoản QR</h3>
                  <p className="text-xs text-blue-600 font-medium font-mono">{lastOrder.order_code}</p>
                </div>
              </div>
              <button onClick={() => setShowQRModal(false)} className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm transition">
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Modal Body (Horizontal Split Layout) */}
            {(() => {
              const bankId = posSettings?.vietqr_bank_id || BANK_CONFIG.BANK_ID;
              const accountNo = posSettings?.vietqr_account_no || BANK_CONFIG.ACCOUNT_NO;
              const accountName = posSettings?.vietqr_account_name || BANK_CONFIG.ACCOUNT_NAME;
              const template = posSettings?.vietqr_template || BANK_CONFIG.TEMPLATE;
              return (
                <div className="p-6 grid grid-cols-1 md:grid-cols-12 gap-6 overflow-y-auto max-h-[calc(100vh-140px)]">
                  {/* Left Column (QR Image & guide) */}
                  <div className="md:col-span-5 flex flex-col items-center justify-center space-y-3">
                    {/* QR Image Container with loading indicator */}
                    <div className="relative w-56 h-56 bg-gray-50 rounded-2xl border border-gray-100 p-2 flex items-center justify-center shadow-inner">
                      <img
                        src={`https://img.vietqr.io/image/${bankId}-${accountNo}-${template}.png?amount=${lastOrder.total_amount}&addInfo=${encodeURIComponent(lastOrder.order_code)}&accountName=${encodeURIComponent(accountName)}`}
                        alt="VietQR Payment Code"
                        className="w-full h-full object-contain rounded-xl animate-fade-in"
                        loading="lazy"
                      />
                    </div>
                    {/* Toast copy notification */}
                    {copyStatus && (
                      <div className="bg-emerald-500 text-white text-xs px-3 py-1 rounded-full shadow-md flex items-center gap-1 animate-bounce">
                        <Icon name="check" size={10} />
                        <span>Đã sao chép {copyStatus}!</span>
                      </div>
                    )}
                    <p className="text-[11px] text-gray-400 text-center flex items-start justify-center gap-1">
                      <Icon name="info" size={12} className="shrink-0 mt-0.5" />
                      <span>Mở ứng dụng ngân hàng quét mã QR để chuyển khoản nhanh 24/7</span>
                    </p>
                  </div>

                  {/* Right Column (Payment Details & Action Buttons) */}
                  <div className="md:col-span-7 flex flex-col justify-between space-y-4">
                    {/* Payment Details */}
                    <div className="space-y-2 bg-gray-50 rounded-2xl p-4 border border-gray-100 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-gray-200/50">
                        <span className="text-gray-500">Ngân hàng</span>
                        <span className="font-bold text-gray-800">{bankId}</span>
                      </div>
                      
                      <div className="flex justify-between items-center py-1 border-b border-gray-200/50">
                        <span className="text-gray-500">Số tài khoản</span>
                        <button 
                          onClick={() => handleCopy(accountNo, 'Số tài khoản')}
                          className="flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 active:scale-95 transition"
                          title="Click để sao chép"
                        >
                          {accountNo}
                          <Icon name="content_copy" size={12} />
                        </button>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-gray-200/50">
                        <span className="text-gray-500">Chủ tài khoản</span>
                        <span className="font-semibold text-gray-800 uppercase truncate max-w-[170px]">{accountName}</span>
                      </div>

                      <div className="flex justify-between items-center py-1 border-b border-gray-200/50">
                        <span className="text-gray-500">Số tiền</span>
                        <button
                          onClick={() => handleCopy(String(lastOrder.total_amount), 'Số tiền')}
                          className="flex items-center gap-1 font-bold text-emerald-600 hover:text-emerald-800 active:scale-95 transition"
                          title="Click để sao chép"
                        >
                          {fmt(lastOrder.total_amount)}
                          <Icon name="content_copy" size={12} />
                        </button>
                      </div>

                      <div className="flex justify-between items-center py-1">
                        <span className="text-gray-500">Nội dung CK</span>
                        <button
                          onClick={() => handleCopy(lastOrder.order_code, 'Nội dung chuyển khoản')}
                          className="flex items-center gap-1 font-mono font-semibold text-blue-600 hover:text-blue-800 active:scale-95 transition"
                          title="Click để sao chép"
                        >
                          {lastOrder.order_code}
                          <Icon name="content_copy" size={12} />
                        </button>
                      </div>
                    </div>



                    {/* Action buttons (Merged from footer) */}
                    <div className="flex gap-3 pt-1 bg-white">
                      <button
                        onClick={() => {
                          setShowQRModal(false);
                        }}
                        className="flex-1 px-4 py-2 text-xs font-medium border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-100 active:scale-[0.98] transition text-center"
                      >
                        Đóng
                      </button>
                      <button
                        onClick={handleManualConfirmPayment}
                        disabled={processing}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-2 px-3 rounded-xl active:scale-[0.98] transition text-xs flex items-center justify-center gap-1.5 shadow-md shadow-blue-200"
                      >
                        <Icon name="check_circle" size={14} fill />
                        Xác nhận đã thu tiền
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Success Modal with Print Bill option */}
      {showSuccessModal && lastOrder && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in p-6 space-y-6 flex flex-col items-center">
            
            {/* Animated Success Checkmark */}
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-500 shadow-md">
              <Icon name="check_circle" size={36} fill className="animate-bounce" />
            </div>

            {/* Title */}
            <div className="text-center">
              <h3 className="text-xl font-bold text-gray-900">Thanh toán thành công!</h3>
              <p className="text-sm text-gray-400 mt-1">Đơn hàng đã được lưu vào hệ thống</p>
            </div>

            {/* Order Summary Info Box */}
            <div className="w-full bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Mã đơn hàng:</span>
                <span className="font-mono font-bold text-gray-800">{lastOrder.order_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Tổng thanh toán:</span>
                <span className="font-bold text-blue-600">{fmt(Number(lastOrder.total_amount))}</span>
              </div>
              
              {lastOrder.payment_method === 'cash' && (
                <>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Khách đưa:</span>
                    <span className="font-semibold text-gray-700">{fmt(Number(lastOrder.paid_amount || lastOrder.total_amount))}</span>
                  </div>
                  <div className="flex justify-between text-green-600 font-medium">
                    <span>Tiền thừa trả khách:</span>
                    <span className="font-bold">{fmt(Number(lastOrder.change_amount || 0))}</span>
                  </div>
                </>
              )}

              <div className="flex justify-between">
                <span className="text-gray-500">Phương thức:</span>
                <span className="font-medium text-gray-700">
                  {lastOrder.payment_method === 'cash' ? 'Tiền mặt' : 
                   lastOrder.payment_method === 'card' ? 'Thẻ' : 'Chuyển khoản QR'}
                </span>
              </div>

              {lastOrder.loyalty_summary && lastOrder.loyalty_summary.points_earned > 0 && (
                <div className="flex justify-between text-amber-600 text-xs pt-1.5 border-t border-gray-200/50">
                  <span className="flex items-center gap-1">
                    <Icon name="card_giftcard" size={13} className="text-amber-500" />
                    Điểm tích lũy nhận được:
                  </span>
                  <span className="font-bold">+{lastOrder.loyalty_summary.points_earned} điểm</span>
                </div>
              )}
            </div>

            <div className="text-center text-sm text-gray-600">
              Bạn có muốn in hóa đơn (bill) cho khách hàng không?
            </div>

            {/* Actions */}
            <div className="w-full flex gap-3">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setLastOrder(null);
                }}
                className="flex-1 py-3 px-4 text-sm font-medium border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-700 active:scale-[0.98] rounded-xl transition text-center"
              >
                Không cần (Đóng)
              </button>
              <button
                onClick={() => {
                  setTimeout(() => {
                    window.print();
                    setShowSuccessModal(false);
                    setLastOrder(null);
                  }, 100);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl active:scale-[0.98] transition text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-blue-200"
              >
                <Icon name="print" size={16} />
                Có, In hóa đơn
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Printable Receipt Layout */}
      {lastOrder && (
        <div id="pos-receipt">
          <div style={{ textAlign: 'center', marginBottom: '15px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 'bold', margin: '0 0 5px 0' }}>CỬA HÀNG POS QR-CODE</h2>
            <p style={{ margin: '0 0 3px 0', fontSize: '11px' }}>Địa chỉ: 123 Đường Cầu Giấy, Hà Nội</p>
            <p style={{ margin: '0 0 10px 0', fontSize: '11px' }}>SĐT: 0987.654.321</p>
            <h3 style={{ fontSize: '14px', fontWeight: 'bold', margin: '10px 0', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '5px 0' }}>
              HÓA ĐƠN BÁN HÀNG
            </h3>
          </div>

          <div style={{ marginBottom: '12px', fontSize: '11px' }}>
            <p style={{ margin: '0 0 4px 0' }}><strong>Mã HĐ:</strong> {lastOrder.order_code}</p>
            <p style={{ margin: '0 0 4px 0' }}><strong>Ngày:</strong> {new Date(lastOrder.created_at || Date.now()).toLocaleString('vi-VN')}</p>
            <p style={{ margin: '0 0 4px 0' }}><strong>Thu ngân:</strong> {user?.full_name || 'Nhân viên'}</p>
            {lastOrder.customer_name && (
              <p style={{ margin: '0 0 4px 0' }}><strong>Khách hàng:</strong> {lastOrder.customer_name} ({lastOrder.customer_phone})</p>
            )}
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', marginBottom: '12px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #000' }}>
                <th style={{ textAlign: 'left', paddingBottom: '5px' }}>Sản phẩm</th>
                <th style={{ textAlign: 'right', paddingBottom: '5px', width: '30px' }}>SL</th>
                <th style={{ textAlign: 'right', paddingBottom: '5px', width: '70px' }}>Đơn giá</th>
                <th style={{ textAlign: 'right', paddingBottom: '5px', width: '85px' }}>T.Tiền</th>
              </tr>
            </thead>
            <tbody>
              {lastOrder.items?.map((it: any) => (
                <tr key={it.id} style={{ borderBottom: '1px dashed #eee' }}>
                  <td style={{ paddingTop: '5px', paddingBottom: '5px' }}>{it.product_name}</td>
                  <td style={{ paddingTop: '5px', paddingBottom: '5px', textAlign: 'right' }}>{it.quantity}</td>
                  <td style={{ paddingTop: '5px', paddingBottom: '5px', textAlign: 'right' }}>{fmt(Number(it.unit_price))}</td>
                  <td style={{ paddingTop: '5px', paddingBottom: '5px', textAlign: 'right' }}>{fmt(Number(it.subtotal))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ borderTop: '1px dashed #000', paddingTop: '8px', fontSize: '11px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span>Tạm tính:</span>
              <span>{fmt(Number(lastOrder.subtotal))}</span>
            </div>
            {Number(lastOrder.discount_amount) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Giảm giá:</span>
                <span>-{fmt(Number(lastOrder.discount_amount))}</span>
              </div>
            )}
            {lastOrder.loyalty_summary && lastOrder.loyalty_summary.points_discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>Trừ điểm ({lastOrder.loyalty_summary.points_redeemed} điểm):</span>
                <span>-{fmt(Number(lastOrder.loyalty_summary.points_discount))}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '13px', marginTop: '6px', borderTop: '1px solid #000', paddingTop: '6px' }}>
              <span>Tổng cộng:</span>
              <span>{fmt(Number(lastOrder.total_amount))}</span>
            </div>
            {lastOrder.payment_method === 'cash' && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span>Khách đưa:</span>
                  <span>{fmt(Number(lastOrder.paid_amount || lastOrder.total_amount))}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                  <span>Tiền thừa:</span>
                  <span>{fmt(Number(lastOrder.change_amount || 0))}</span>
                </div>
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span>Hình thức:</span>
              <span>
                {lastOrder.payment_method === 'cash' ? 'Tiền mặt' : 
                 lastOrder.payment_method === 'card' ? 'Thẻ' : 'Chuyển khoản QR'}
              </span>
            </div>
            {lastOrder.loyalty_summary && lastOrder.loyalty_summary.points_earned > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', color: '#555', fontStyle: 'italic' }}>
                <span>Điểm tích lũy mới:</span>
                <span>+{lastOrder.loyalty_summary.points_earned} điểm</span>
              </div>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: '25px', borderTop: '1px dashed #000', paddingTop: '15px' }}>
            <p style={{ margin: '0 0 5px 0', fontWeight: 'bold' }}>CẢM ƠN QUÝ KHÁCH!</p>
            <p style={{ margin: '0', fontSize: '10px' }}>Hẹn gặp lại quý khách lần sau</p>
          </div>
        </div>
      )}

      {/* Modal Camera Quét */}
      {showCameraScanner && (
        <BarcodeScanner 
          onScanSuccess={handleCameraScanSuccess} 
          onClose={() => setShowCameraScanner(false)} 
        />
      )}

      {/* ── Modal: Thêm nhanh sản phẩm mới ── */}
      {showQuickAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-blue-50">
              <div className="flex items-center gap-2">
                <Icon name="library_add" size={22} className="text-blue-600 animate-pulse" />
                <div>
                  <h3 className="font-bold text-gray-800 text-base">Thêm nhanh sản phẩm vào kho</h3>
                  <p className="text-xs text-blue-600 font-medium">Mã vạch: <span className="font-mono font-bold bg-blue-100 px-1.5 py-0.5 rounded">{quickAddForm.barcode}</span></p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowQuickAddModal(false)} 
                className="w-8 h-8 rounded-full bg-white hover:bg-gray-100 flex items-center justify-center text-gray-500 shadow-sm transition active:scale-95"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveQuickAdd} className="flex-1 overflow-y-auto p-6 space-y-4">
              {quickAddLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                  <p className="text-sm text-gray-500 font-medium">Đang tự động tìm kiếm thông tin sản phẩm...</p>
                  <p className="text-[11px] text-gray-400">Đang tra cứu trên Open Food Facts & UPCitemdb</p>
                </div>
              ) : (
                <>
                  {quickAddError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-center gap-1.5 animate-pulse">
                      <Icon name="error" size={16} />
                      <span>{quickAddError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    {/* Tên sản phẩm */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Tên sản phẩm *</label>
                      <input
                        type="text"
                        required
                        placeholder="Nhập tên sản phẩm"
                        value={quickAddForm.name}
                        onChange={e => setQuickAddForm(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                        autoFocus
                      />
                    </div>

                    {/* Danh mục */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Nhóm sản phẩm *</label>
                      <select
                        required
                        value={quickAddForm.category_id}
                        onChange={e => setQuickAddForm(prev => ({ ...prev, category_id: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                      >
                        <option value="">Chọn danh mục</option>
                        {categories.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Đơn vị tính */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Đơn vị tính</label>
                      <input
                        type="text"
                        placeholder="vd: cái, lon, chai"
                        value={quickAddForm.unit}
                        onChange={e => setQuickAddForm(prev => ({ ...prev, unit: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    {/* Giá bán */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Giá bán (VNĐ) *</label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="0"
                        value={quickAddForm.price}
                        onChange={e => setQuickAddForm(prev => ({ ...prev, price: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-bold text-blue-600"
                      />
                    </div>

                    {/* Số lượng nhập kho ban đầu */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Tồn kho ban đầu</label>
                      <input
                        type="number"
                        min="0"
                        value={quickAddForm.stock_quantity}
                        onChange={e => setQuickAddForm(prev => ({ ...prev, stock_quantity: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                      />
                    </div>

                    {/* Cảnh báo tồn tối thiểu */}
                    <div>
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Cảnh báo tồn tối thiểu</label>
                      <input
                        type="number"
                        min="0"
                        value={quickAddForm.min_stock}
                        onChange={e => setQuickAddForm(prev => ({ ...prev, min_stock: e.target.value }))}
                        className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500"
                      />
                    </div>

                    {/* Link ảnh sản phẩm */}
                    <div className="col-span-2">
                      <label className="block text-xs font-semibold text-gray-600 mb-1">Link ảnh sản phẩm (URL)</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="Nhập URL ảnh hoặc để trống"
                          value={quickAddForm.image}
                          onChange={e => setQuickAddForm(prev => ({ ...prev, image: e.target.value }))}
                          className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-500 font-mono"
                        />
                        {quickAddForm.image && (
                          <div className="w-10 h-10 border rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                            <img src={quickAddForm.image} className="w-full h-full object-cover" alt="Preview" onError={(e) => { (e.target as HTMLImageElement).src = '' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}

              {/* Actions */}
              {!quickAddLoading && (
                <div className="pt-4 border-t flex gap-3 justify-end bg-white">
                  <button
                    type="button"
                    onClick={() => setShowQuickAddModal(false)}
                    className="px-5 py-2.5 text-sm font-semibold border border-gray-200 text-gray-600 rounded-xl hover:bg-gray-50 transition active:scale-95"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="submit"
                    disabled={quickAddSaving}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition text-sm flex items-center gap-1.5 shadow-md shadow-blue-100 active:scale-95"
                  >
                    {quickAddSaving ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <Icon name="library_add" size={18} />
                        Thêm & Bán ngay
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Toast thông báo quét từ ĐT */}
      {remoteToast && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-[100] animate-bounce">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-2xl shadow-xl border ${
            remoteToast.success 
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}>
            <Icon 
              name={remoteToast.success ? 'check_circle' : 'error'} 
              className={remoteToast.success ? 'text-emerald-500' : 'text-rose-500'} 
              size={20} 
            />
            <div className="text-xs">
              <p className="font-bold">Đã quét từ điện thoại</p>
              <p className="font-mono mt-0.5">
                Mã: {remoteToast.barcode} 
                {remoteToast.productName && ` - ${remoteToast.productName}`}
              </p>
              {!remoteToast.success && <p className="text-[10px] text-rose-500 mt-0.5">Không tìm thấy hoặc hết hàng</p>}
            </div>
          </div>
        </div>
      )}

      {/* Modal Quét bằng điện thoại */}
      {showScannerQR && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in p-6 space-y-4 flex flex-col items-center">
            <div className="flex items-center justify-between w-full border-b pb-3">
              <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                <Icon name="smartphone" size={24} className="text-blue-600" />
                Kết nối máy quét điện thoại
              </h3>
              <button onClick={() => setShowScannerQR(false)} className="text-gray-400 hover:text-gray-600">
                <Icon name="close" size={20} />
              </button>
            </div>
            
            <p className="text-xs text-gray-500 text-center leading-relaxed">
              Mở ứng dụng Camera hoặc trình quét mã QR trên điện thoại của bạn, quét mã dưới đây để mở giao diện quét mã vạch chuyên dụng và đồng bộ trực tiếp với màn hình bán hàng này.
            </p>

            <div className="bg-gray-50 p-4 border border-dashed rounded-xl flex flex-col items-center w-full">
              <div className="bg-white p-3 rounded-lg shadow-sm border border-gray-100 mb-3">
                {scannerQRUrl ? (
                  <img src={scannerQRUrl} alt="Scanner QR Link" className="w-48 h-48" />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-gray-400 text-xs">Đang tạo mã QR...</div>
                )}
              </div>
              <div className="w-full text-center space-y-1.5">
                <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Đường dẫn trực tiếp:</span>
                <p className="text-xs font-mono font-bold text-blue-600 break-all select-all bg-blue-50/50 py-1.5 px-3 rounded-lg border border-blue-100">
                  {getScannerPageUrl()}
                </p>
                <p className="text-[10px] text-gray-400">
                  Lưu ý: Điện thoại và laptop phải kết nối cùng mạng WiFi (mạng cục bộ) để liên thông.
                </p>
              </div>
            </div>

            <div className="w-full flex justify-end pt-2">
              <button
                onClick={() => setShowScannerQR(false)}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-blue-100 transition active:scale-[0.98]"
              >
                Đã hiểu (Đóng)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Styles for print receipt */}
      <style>{`
        @media screen {
          #pos-receipt {
            display: none !important;
          }
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #pos-receipt, #pos-receipt * {
            visibility: visible !important;
          }
          #pos-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            margin: 0 !important;
            padding: 4mm !important;
            font-family: 'Courier New', Courier, monospace !important;
            font-size: 12px !important;
            color: #000 !important;
            background: #fff !important;
            line-height: 1.4 !important;
          }
        }
      `}</style>
    </div>
  );
}