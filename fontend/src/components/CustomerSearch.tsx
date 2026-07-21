// frontend/src/components/CustomerSearch.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from './Icon';
import { customerService, type Customer } from '../services/customerService';

const fmt = (n: number) => new Intl.NumberFormat('vi-VN').format(n) + 'đ';

interface Props {
  selectedCustomer: Customer | null;
  usePoints: boolean;
  onCustomerSelect: (customer: Customer | null) => void;
  onUsePointsChange: (use: boolean) => void;
  pointsDiscount: number;
}

export default function CustomerSearch({
  selectedCustomer,
  usePoints,
  onCustomerSelect,
  onUsePointsChange,
  pointsDiscount,
}: Props) {
  const [phoneInput, setPhoneInput] = useState('');
  const [searching, setSearching] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: '', phone: phoneInput });
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [suggestions, setSuggestions] = useState<Customer[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Debounced search for phone number suggestions
  useEffect(() => {
    const term = phoneInput.trim();
    if (term.length >= 3) {
      const delayDebounceFn = setTimeout(async () => {
        try {
          const res = await customerService.getList({ search: term, limit: 10 });
          if (res && res.success) {
            setSuggestions(res.data || []);
          } else {
            setSuggestions([]);
          }
        } catch {
          setSuggestions([]);
        }
      }, 250); // 250ms debounce
      return () => clearTimeout(delayDebounceFn);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [phoneInput]);

  // Click outside listener to close suggestions dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = useCallback(async () => {
    const phone = phoneInput.trim();
    if (phone.length < 8) return;
    setSearching(true);
    setNotFound(false);
    try {
      const customer = await customerService.searchByPhone(phone);
      if (customer) {
        onCustomerSelect(customer);
        onUsePointsChange(false);
        setPhoneInput('');
      } else {
        setNotFound(true);
        setCreateForm(f => ({ ...f, phone }));
      }
    } catch {
      setNotFound(true);
    }
    setSearching(false);
  }, [phoneInput, onCustomerSelect, onUsePointsChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleClear = () => {
    onCustomerSelect(null);
    onUsePointsChange(false);
    setPhoneInput('');
    setNotFound(false);
    setShowCreate(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleCreateAndSelect = async () => {
    if (!createForm.name.trim() || !createForm.phone.trim()) return;

    const trimmedPhone = createForm.phone.trim();
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(trimmedPhone)) {
      alert('Số điện thoại phải đúng 10 chữ số');
      return;
    }

    setCreating(true);
    try {
      const newCustomer = await customerService.create({
        name: createForm.name,
        phone: trimmedPhone,
      });
      onCustomerSelect(newCustomer);
      setPhoneInput('');
      setNotFound(false);
      setShowCreate(false);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Lỗi tạo khách hàng');
    }
    setCreating(false);
  };

  // ── Khi đã chọn khách, hiển thị card tóm tắt ──
  if (selectedCustomer) {
    const maxPointsValue = customerService.calculatePointsValue(selectedCustomer.reward_points);
    const hasPoints = selectedCustomer.reward_points > 0;

    return (
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
        {/* Header khách hàng */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-bold">
              {selectedCustomer.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">{selectedCustomer.name}</p>
              <p className="text-xs text-gray-500">{selectedCustomer.phone}</p>
            </div>
          </div>
          <button
            onClick={handleClear}
            className="text-gray-400 hover:text-red-500 transition"
            title="Bỏ chọn khách"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Điểm hiện có */}
        <div className="flex items-center justify-between bg-white rounded-lg px-3 py-2">
          <div className="flex items-center gap-1.5">
            <Icon name="card_giftcard" size={18} fill className="text-amber-500" />
            <div>
              <p className="text-xs text-gray-500">Điểm tích lũy</p>
              <p className="text-sm font-bold text-amber-600">
                {selectedCustomer.reward_points.toLocaleString('vi-VN')} điểm
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400">≈ {fmt(maxPointsValue)}</p>
        </div>

        {/* Checkbox dùng điểm */}
        {hasPoints && (
          <label className="flex items-center gap-2 cursor-pointer select-none bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <input
              type="checkbox"
              id="use-points-checkbox"
              checked={usePoints}
              onChange={e => onUsePointsChange(e.target.checked)}
              className="w-4 h-4 accent-amber-500 cursor-pointer"
            />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">Sử dụng điểm tích lũy</p>
              {usePoints && pointsDiscount > 0 && (
                <p className="text-xs text-amber-600 font-semibold">
                  Giảm: -{fmt(pointsDiscount)}
                </p>
              )}
            </div>
            {!usePoints && (
              <span className="text-xs text-amber-600">
                Có thể dùng {fmt(maxPointsValue)}
              </span>
            )}
          </label>
        )}
      </div>
    );
  }

  // ── Form tìm kiếm ──
  return (
    <div className="space-y-2">
      <div className="flex gap-1.5">
        <div ref={containerRef} className="relative flex-1">
          <Icon name="phone" size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            ref={inputRef}
            id="customer-phone-search"
            type="tel"
            value={phoneInput}
            onChange={e => {
              setPhoneInput(e.target.value);
              setNotFound(false);
              if (e.target.value.trim().length >= 3) {
                setShowSuggestions(true);
              }
            }}
            onFocus={() => {
              if (phoneInput.trim().length >= 3) {
                setShowSuggestions(true);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="SĐT khách hàng..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
          />

          {/* Suggestions Dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto divide-y divide-gray-100">
              {suggestions.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onCustomerSelect(c);
                    onUsePointsChange(false);
                    setPhoneInput('');
                    setShowSuggestions(false);
                  }}
                  className="w-full px-4 py-2.5 text-left hover:bg-blue-50 transition flex items-center justify-between"
                >
                  <div className="flex flex-col text-left">
                    <span className="text-sm font-semibold text-gray-800">{c.name}</span>
                    <span className="text-xs text-gray-400 font-mono">{c.phone}</span>
                  </div>
                  {c.reward_points > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 border border-amber-100 flex items-center gap-0.5 font-medium">
                      <Icon name="card_giftcard" size={10} fill />
                      {c.reward_points}đ
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || phoneInput.trim().length < 8}
          className="px-3 py-2 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-200 text-white rounded-xl transition flex items-center justify-center"
          title="Tìm khách hàng"
        >
          {searching
            ? <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            : <Icon name="search" size={18} />
          }
        </button>
      </div>

      {/* Không tìm thấy */}
      {notFound && !showCreate && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-2.5">
          <p className="text-xs text-orange-700 mb-1.5 flex items-center gap-1">
            <Icon name="person_off" size={13} />
            Không tìm thấy khách hàng
          </p>
          <button
            onClick={() => { setShowCreate(true); setCreateForm(f => ({ ...f, phone: phoneInput.trim() })); }}
            className="text-xs text-blue-600 hover:underline font-medium flex items-center gap-1"
          >
            <Icon name="person_add" size={13} />
            Tạo khách hàng mới
          </button>
        </div>
      )}

      {/* Form tạo nhanh */}
      {showCreate && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 space-y-2">
          <p className="text-xs font-semibold text-green-700 flex items-center gap-1">
            <Icon name="person_add" size={14} />
            Tạo khách hàng mới
          </p>
          <input
            type="text"
            placeholder="Họ và tên *"
            value={createForm.name}
            onChange={e => setCreateForm(f => ({ ...f, name: e.target.value }))}
            className="w-full px-2.5 py-1.5 text-sm border border-green-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-400"
          />
          <input
            type="tel"
            placeholder="Số điện thoại *"
            value={createForm.phone}
            onChange={e => setCreateForm(f => ({ ...f, phone: e.target.value }))}
            className="w-full px-2.5 py-1.5 text-sm border border-green-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-green-400"
          />
          <div className="flex gap-1.5">
            <button
              onClick={handleCreateAndSelect}
              disabled={creating || !createForm.name.trim()}
              className="flex-1 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white text-xs rounded-lg transition flex items-center justify-center gap-1"
            >
              {creating
                ? <><div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" /> Đang tạo...</>
                : <><Icon name="check" size={14} /> Tạo &amp; chọn</>
              }
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 text-gray-600 text-xs rounded-lg transition"
            >
              Hủy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
