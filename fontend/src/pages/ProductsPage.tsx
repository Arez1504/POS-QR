// frontend/src/pages/ProductsPage.tsx
import { useState, useEffect, useRef } from 'react';
import api from '../services/authService';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import Icon from '../components/Icon';
import { useAuth } from '../hooks/useAuth';
import BarcodeScanner from '../components/BarcodeScanner';

interface Product {
  id: number;
  name: string;
  sku: string;
  barcode: string;
  price: number;
  cost_price: number;
  stock_quantity: number;
  min_stock: number;
  unit: string;
  category_id: number;
  category_name: string;
  image: string;
  is_active: boolean;
}

interface Category { id: number; name: string; }

const emptyForm = {
  name: '', sku: '', barcode: '', description: '', price: '',
  cost_price: '', stock_quantity: '', min_stock: '5',
  unit: 'cái', category_id: '', image: '', is_active: true
};

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

export default function ProductsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterCat, setFilterCat] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Barcode / QR State
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [showCameraScanner, setShowCameraScanner] = useState(false);

  const handleCameraScanSuccess = (scannedBarcode: string) => {
    setShowCameraScanner(false);
    if (!scannedBarcode) return;
    const code = scannedBarcode.trim();
    setForm(prev => ({ ...prev, barcode: code }));
    lookupProductByBarcode(code);
  };

  const lookupProductByBarcode = async (barcodeVal: string) => {
    if (!barcodeVal) return;
    setSaving(true);
    setError('');
    try {
      // 1. Thử gọi Open Food Facts API trước (Phù hợp cho thực phẩm, tiêu dùng nhanh)
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

          setForm(prev => ({
            ...prev,
            name: prev.name || finalName,
            image: prev.image || imageUrl,
            unit: prev.unit === 'cái' ? unit : prev.unit,
          }));
          return; // Nếu thấy thì dừng lại
        }
      }

      // 2. Dự phòng: Thử gọi UpcItemDb API (Phù hợp cho Văn phòng phẩm Deli, Casio, thiết bị, sách...)
      const resUPC = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${barcodeVal}`);
      if (resUPC.ok) {
        const dataUPC = await resUPC.json();
        if (dataUPC.items && dataUPC.items.length > 0) {
          const item = dataUPC.items[0];
          const name = item.title || '';
          const brand = item.brand ? ` [${item.brand}]` : '';
          const finalName = name ? `${name}${brand}` : '';
          const imageUrl = item.images && item.images.length > 0 ? item.images[0] : '';

          setForm(prev => ({
            ...prev,
            name: prev.name || finalName,
            image: prev.image || imageUrl,
          }));
          return; // Tìm thấy
        }
      }

      console.log("Không tìm thấy sản phẩm trên cả hai cơ sở dữ liệu.");
    } catch (err) {
      console.error("Lỗi tra cứu mã vạch kết hợp:", err);
    } finally {
      setSaving(false);
    }
  };
  const barcodeRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (barcodeProduct) {
      const barcodeValue = barcodeProduct.barcode || barcodeProduct.sku || `PROD${barcodeProduct.id}`;
      QRCode.toDataURL(barcodeValue, { width: 200, margin: 2 })
        .then(url => setQrDataUrl(url))
        .catch(err => console.error('QR code generation error:', err));
    } else {
      setQrDataUrl('');
    }
  }, [barcodeProduct]);

  useEffect(() => {
    if (barcodeProduct && barcodeRef.current) {
      const barcodeValue = barcodeProduct.barcode || barcodeProduct.sku || `PROD${barcodeProduct.id}`;
      try {
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: "CODE128",
          lineColor: "#000",
          width: 2,
          height: 60,
          displayValue: true,
          fontSize: 14,
          margin: 10
        });
      } catch (err) {
        console.error("Barcode generation error:", err);
      }
    }
  }, [barcodeProduct]);

  const generateRandomBarcode = () => {
    const randomNum = Math.floor(10000000 + Math.random() * 90000000);
    setForm(prev => ({ ...prev, barcode: `SP${randomNum}` }));
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (filterCat) params.append('category_id', filterCat);
      const res = await api.get(`/products?${params}`);
      setProducts(res.data.data);
    } catch { setProducts([]); }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const res = await api.get('/products/categories');
      setCategories(res.data.data);
    } catch {}
  };

  useEffect(() => { fetchCategories(); }, []);
  useEffect(() => { fetchProducts(); }, [search, filterCat]);

  const openAdd = () => {
    setEditProduct(null);
    setForm(emptyForm);
    setError('');
    setShowModal(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      name: p.name, sku: p.sku || '', barcode: p.barcode || '',
      description: '', price: String(p.price), cost_price: String(p.cost_price),
      stock_quantity: String(p.stock_quantity), min_stock: String(p.min_stock),
      unit: p.unit, category_id: String(p.category_id || ''),
      image: p.image || '', is_active: p.is_active
    });
    setError('');
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.price) { setError('Tên và giá là bắt buộc'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        cost_price: Number(form.cost_price) || 0,
        stock_quantity: Number(form.stock_quantity) || 0,
        min_stock: Number(form.min_stock) || 5,
        category_id: form.category_id ? Number(form.category_id) : null,
      };
      if (editProduct) {
        await api.put(`/products/${editProduct.id}`, payload);
      } else {
        await api.post('/products', payload);
      }
      setShowModal(false);
      fetchProducts();
    } catch (err: any) {
      setError(err.response?.data?.message || 'Có lỗi xảy ra');
    }
    setSaving(false);
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Xóa sản phẩm "${p.name}"?`)) return;
    try {
      await api.delete(`/products/${p.id}`);
      fetchProducts();
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi xóa sản phẩm');
    }
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Quản lý sản phẩm</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {products.length} sản phẩm
            {!isAdmin && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                <Icon name="visibility" size={12} /> Chỉ xem
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <button onClick={openAdd}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2">
            <Icon name="add" size={18} /> Thêm sản phẩm
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text" placeholder="Tìm tên, SKU, mã vạch..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">Tất cả danh mục</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <Icon name="inventory_2" size={48} className="text-gray-200 mb-2 mx-auto" />
            <p>Không có sản phẩm nào</p>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Sản phẩm', 'SKU', 'Danh mục', 'Giá bán', 'Tồn kho', 'Trạng thái', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        {p.image ? <img src={p.image} className="w-9 h-9 rounded-lg object-cover" /> : <Icon name="inventory_2" size={20} className="text-gray-300" />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{p.name}</p>
                        <p className="text-xs text-gray-400">{p.unit}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.sku || '-'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.category_name || '-'}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-gray-900">{fmt(p.price)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${p.stock_quantity <= p.min_stock ? 'text-red-600' : 'text-gray-900'}`}>
                      {p.stock_quantity}
                      {p.stock_quantity <= p.min_stock && <Icon name="warning" size={14} fill className="ml-1 text-amber-500" />}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${p.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {p.is_active ? 'Đang bán' : 'Ngừng bán'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Mã vạch / QR - ai cũng xem được */}
                      <button onClick={() => setBarcodeProduct(p)}
                        title="Xem Mã vạch & QR"
                        className="text-emerald-600 hover:text-emerald-800 text-sm px-2.5 py-1 rounded-lg hover:bg-emerald-50 flex items-center gap-1">
                        <Icon name="qr_code_2" size={16} />
                        Mã vạch/QR
                      </button>
                      {/* Sửa / Xóa — chỉ Admin */}
                      {isAdmin && (
                        <>
                          <button onClick={() => openEdit(p)}
                            className="text-blue-600 hover:text-blue-800 text-sm px-2.5 py-1 rounded-lg hover:bg-blue-50 flex items-center gap-1">
                            <Icon name="edit" size={14} />
                            Sửa
                          </button>
                          <button onClick={() => handleDelete(p)}
                            className="text-red-500 hover:text-red-700 text-sm px-2.5 py-1 rounded-lg hover:bg-red-50 flex items-center gap-1">
                            <Icon name="delete" size={14} />
                            Xóa
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal thêm/sửa */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-lg font-bold">{editProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm mới'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600"><Icon name="close" size={20} /></button>
            </div>

            <div className="p-6 space-y-4">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded-lg text-sm">{error}</div>}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tên sản phẩm *</label>
                <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input type="text" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 flex justify-between items-center">
                    <span>Mã vạch</span>
                    <div className="flex gap-2">
                      <button 
                        type="button" 
                        onClick={() => lookupProductByBarcode(form.barcode)}
                        disabled={!form.barcode}
                        className="text-xs text-emerald-600 hover:text-emerald-800 font-medium disabled:opacity-40">
                        Tra cứu mạng
                      </button>
                      <button 
                        type="button" 
                        onClick={generateRandomBarcode}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                        Tạo tự động
                      </button>
                    </div>
                  </label>
                  <div className="flex gap-2">
                    <input type="text" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})}
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                    <button
                      type="button"
                      onClick={() => setShowCameraScanner(true)}
                      className="px-3 bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg flex items-center justify-center transition active:scale-95 shrink-0"
                      title="Quét mã vạch bằng camera"
                    >
                      <Icon name="photo_camera" size={18} />
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Giá bán (đ) *</label>
                <input type="number" value={form.price} onChange={e => setForm({...form, price: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tồn kho</label>
                  <input type="number" value={form.stock_quantity} onChange={e => setForm({...form, stock_quantity: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tồn tối thiểu</label>
                  <input type="number" value={form.min_stock} onChange={e => setForm({...form, min_stock: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Đơn vị</label>
                  <input type="text" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Danh mục</label>
                <select value={form.category_id} onChange={e => setForm({...form, category_id: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Chọn danh mục --</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Link ảnh (URL)</label>
                <input type="text" value={form.image} onChange={e => setForm({...form, image: e.target.value})}
                  placeholder="https://example.com/image.jpg hoặc Google Drive, Imgur..."
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                {/* Preview ảnh trực tiếp */}
                {form.image && (
                  <div className="mt-2 relative">
                    <img
                      src={form.image}
                      alt="Preview"
                      className="w-full h-32 object-contain rounded-lg border border-gray-100 bg-gray-50"
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                      }}
                      onLoad={e => {
                        (e.target as HTMLImageElement).style.display = '';
                        (e.target as HTMLImageElement).nextElementSibling?.classList.add('hidden');
                      }}
                    />
                    <div className="hidden w-full h-32 flex items-center justify-center rounded-lg border border-red-100 bg-red-50 text-red-400 text-xs gap-1">
                      <Icon name="broken_image" size={18} />
                      Link ảnh không hợp lệ hoặc không load được
                    </div>
                  </div>
                )}
              </div>

              {editProduct && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.is_active}
                    onChange={e => setForm({...form, is_active: e.target.checked})}
                    className="w-4 h-4 rounded text-blue-600" />
                  <span className="text-sm text-gray-700">Đang bán</span>
                </label>
              )}
            </div>

            <div className="flex gap-3 p-6 border-t">
              <button onClick={() => setShowModal(false)}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-700 hover:bg-gray-50">
                Hủy
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl text-sm font-medium">
                {saving ? 'Đang lưu...' : (editProduct ? 'Cập nhật' : 'Thêm sản phẩm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal hiển thị mã vạch & QR */}
      {barcodeProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl">
            <style>{`
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #print-area, #print-area * {
                  visibility: visible !important;
                }
                #print-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  margin: 0 !important;
                  padding: 20px !important;
                  border: none !important;
                  box-shadow: none !important;
                  display: flex !important;
                  flex-direction: column !important;
                  align-items: center !important;
                  justify-content: center !important;
                }
              }
            `}</style>
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Icon name="qr_code_2" size={22} className="text-emerald-600" />
                Mã vạch & QR Code
              </h3>
              <button 
                onClick={() => setBarcodeProduct(null)} 
                className="text-gray-400 hover:text-gray-600 text-xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="p-6">
              {/* Khu vực in tem nhãn */}
              <div id="print-area" className="bg-white p-6 border border-dashed border-gray-200 rounded-xl flex flex-col items-center text-center">
                <div className="w-full mb-3">
                  <h4 className="text-base font-bold text-gray-900 truncate max-w-full">{barcodeProduct.name}</h4>
                  <p className="text-sm font-semibold text-blue-600 mt-0.5">{fmt(barcodeProduct.price)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">SKU: {barcodeProduct.sku || '-'}</p>
                </div>
                
                {/* QR Code Container */}
                <div className="bg-white p-2 border border-gray-100 rounded-lg shadow-sm mb-4">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} className="w-40 h-40 object-contain mx-auto" alt="QR Code" />
                  ) : (
                    <div className="w-40 h-40 flex items-center justify-center text-gray-300 text-sm">Đang tạo...</div>
                  )}
                </div>

                {/* Barcode Container */}
                <div className="w-full flex justify-center bg-white p-2 border border-gray-100 rounded-lg shadow-sm">
                  <svg ref={barcodeRef} className="max-w-full"></svg>
                </div>
                
                <p className="text-xs font-mono text-gray-500 mt-2">
                  {barcodeProduct.barcode || barcodeProduct.sku || `PROD${barcodeProduct.id}`}
                </p>
              </div>

              {/* Hướng dẫn */}
              <p className="text-xs text-gray-500 mt-4 text-center leading-relaxed">
                Nhãn in bao gồm mã QR và mã vạch tương ứng. Sử dụng máy quét mã vạch hoặc camera POS để quét trực tiếp sản phẩm này.
              </p>
            </div>

            <div className="flex gap-3 p-5 border-t border-gray-100 bg-gray-50">
              <button 
                onClick={() => setBarcodeProduct(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 bg-white hover:bg-gray-50 rounded-xl text-sm font-medium text-gray-700 transition"
              >
                Đóng
              </button>
              <button 
                onClick={() => window.print()}
                className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-medium flex items-center justify-center gap-2 shadow-sm transition"
              >
                <Icon name="print" size={18} />
                In nhãn tem
              </button>
            </div>
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
    </div>
  );
}