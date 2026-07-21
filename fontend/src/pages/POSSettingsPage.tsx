// frontend/src/pages/POSSettingsPage.tsx
import { useState, useEffect } from 'react';
import api from '../services/authService';
import Icon from '../components/Icon';

const POPULAR_BANKS = [
  { id: 'MSB', name: 'MSB (Hàng Hải)' },
  { id: 'VCB', name: 'Vietcombank (Ngoại Thương)' },
  { id: 'MB', name: 'MB (Quân Đội)' },
  { id: 'BIDV', name: 'BIDV (Đầu Tư & Phát Triển)' },
  { id: 'TCB', name: 'Techcombank (Kỹ Thương)' },
  { id: 'CTG', name: 'Vietinbank (Công Thương)' },
  { id: 'VARB', name: 'Agribank (Nông Nghiệp)' },
  { id: 'ACB', name: 'ACB (Á Châu)' },
  { id: 'VPB', name: 'VPBank (Thịnh Vượng)' },
  { id: 'STB', name: 'Sacombank (Sài Gòn Thương Tín)' },
  { id: 'TPB', name: 'TPBank (Tiên Phong)' },
];

export default function POSSettingsPage() {
  const [settings, setSettings] = useState({
    store_name: '',
    store_address: '',
    store_phone: '',
    store_logo: '',
    vietqr_bank_id: 'MSB',
    vietqr_account_no: '',
    vietqr_account_name: '',
    vietqr_template: 'compact2'
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Fetch settings
  const fetchSettings = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/settings');
      if (res.data.success) {
        setSettings(prev => ({
          ...prev,
          ...res.data.data
        }));
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể tải cấu hình POS');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setSettings(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await api.put('/settings', settings);
      if (res.data.success) {
        setMessage('Cấu hình POS đã được cập nhật thành công!');
        // Scroll to top to see message
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể cập nhật cấu hình POS');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500" />
        <span className="text-xs text-gray-400 font-bold">Đang tải cấu hình POS...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6 max-w-4xl mx-auto">
      {/* Title & Status */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white border border-gray-100 p-5 rounded-2xl gap-3 shadow-sm">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center gap-2">
            <Icon name="settings" size={24} className="text-blue-500" /> Quản lý POS
          </h1>
          <p className="text-gray-400 text-xs mt-0.5">Cấu hình thông tin biên lai cửa hàng và cổng thanh toán ngân hàng</p>
        </div>
        <button 
          onClick={fetchSettings}
          className="flex items-center gap-2 border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition px-4 py-2 rounded-xl text-xs font-bold shadow-sm"
        >
          <Icon name="refresh" size={14} /> Tải lại
        </button>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-sm animate-fadeIn">
          <Icon name="check_circle" size={16} className="text-emerald-600" /> {message}
        </div>
      )}
      
      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-2xl text-xs font-semibold flex items-center gap-2 shadow-sm">
          <Icon name="error" size={16} className="text-rose-600" /> {error}
        </div>
      )}

      {/* Configuration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Section 1: Store Configuration */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-extrabold text-gray-800 text-sm tracking-tight border-b border-gray-100 pb-3 flex items-center gap-2">
            <Icon name="store" size={18} className="text-blue-500" /> 1. Thông tin cửa hàng (In trên biên lai)
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Tên cửa hàng <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                name="store_name" 
                value={settings.store_name} 
                onChange={handleChange}
                required
                placeholder="Ví dụ: Cửa hàng Tiện Lợi POS-QR"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Số điện thoại liên hệ <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                name="store_phone" 
                value={settings.store_phone} 
                onChange={handleChange}
                required
                placeholder="Ví dụ: 0901234567"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">Địa chỉ cửa hàng <span className="text-rose-500">*</span></label>
            <input 
              type="text" 
              name="store_address" 
              value={settings.store_address} 
              onChange={handleChange}
              required
              placeholder="Ví dụ: 123 Đường ABC, Phường Bến Nghé, Quận 1, TP. HCM"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-500">Đường dẫn ảnh Logo cửa hàng (Không bắt buộc)</label>
            <input 
              type="text" 
              name="store_logo" 
              value={settings.store_logo} 
              onChange={handleChange}
              placeholder="Ví dụ: https://my-store.com/logo.png"
              className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
        </div>

        {/* Section 2: Bank VietQR Configuration */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h3 className="font-extrabold text-gray-800 text-sm tracking-tight border-b border-gray-100 pb-3 flex items-center gap-2">
            <Icon name="payments" size={18} className="text-emerald-500" /> 2. Cổng thanh toán chuyển khoản VietQR
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Ngân hàng thụ hưởng <span className="text-rose-500">*</span></label>
              <select
                name="vietqr_bank_id"
                value={settings.vietqr_bank_id}
                onChange={handleChange}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                {POPULAR_BANKS.map(bank => (
                  <option key={bank.id} value={bank.id}>{bank.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Số tài khoản nhận tiền <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                name="vietqr_account_no" 
                value={settings.vietqr_account_no} 
                onChange={handleChange}
                required
                placeholder="Ví dụ: 0371000123456"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Tên chủ tài khoản (Viết hoa không dấu) <span className="text-rose-500">*</span></label>
              <input 
                type="text" 
                name="vietqr_account_name" 
                value={settings.vietqr_account_name} 
                onChange={handleChange}
                required
                placeholder="Ví dụ: NGUYEN VAN AN"
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm uppercase focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-gray-500">Mẫu hiển thị VietQR <span className="text-rose-500">*</span></label>
              <select
                name="vietqr_template"
                value={settings.vietqr_template}
                onChange={handleChange}
                required
                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              >
                <option value="compact2">Compact 2 (Đầy đủ thông tin chủ tài khoản/bank - Khuyên dùng)</option>
                <option value="compact">Compact (Tối giản thông tin)</option>
                <option value="qr_only">QR Only (Chỉ hiển thị mã QR)</option>
                <option value="print">Print (Mẫu in hóa đơn đen trắng)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl text-sm transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Đang lưu cấu hình...
              </>
            ) : (
              <>
                <Icon name="save" size={16} /> Lưu thiết lập
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
