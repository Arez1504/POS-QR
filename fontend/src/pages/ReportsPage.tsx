// frontend/src/pages/ReportsPage.tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Icon from '../components/Icon';
import api from '../services/authService';
import { useAuth } from '../hooks/useAuth';
import { aiService } from '../services/aiService';
import { FEATURES } from '../config/config';

const fmtVND  = (n: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(n || 0);
const fmtNum  = (n: number) => new Intl.NumberFormat('vi-VN').format(n || 0);

interface Overview {
  period: { from: string; to: string; days: number };
  current: {
    total_orders: number;
    total_revenue: number;
    avg_order_value: number;
    cancelled_orders: number;
    total_customers: number;
    cash_revenue: number;
  };
  prev: {
    total_orders: number;
    total_revenue: number;
    avg_order_value: number;
    cancelled_orders: number;
    total_customers: number;
  };
  growth: {
    revenue: string | null;
    orders: string | null;
    customers: string | null;
    aov: string | null;
    cancelled: string | null;
  };
  stock_warning: { out_of_stock: number; low_stock: number };
  active_cashiers: number;
}

interface RevenueRow { label: string; orders: number; revenue: number; avg: number }
interface ShiftRow   { id: number; cashier_name: string; label: string; revenue: number; orders: number; start_time: string }
interface TopProduct  { product_id: number; product_name: string; total_qty: number; total_revenue: number; order_count: number }
interface CashierRow  { id: number; full_name: string; username: string; total_orders: number; total_revenue: number }
interface PaymentRow  { method: string; count: number; revenue: number }
interface CategoryRow { category: string; revenue: number; quantity: number }

const PAY_LABEL: Record<string, string> = { 
  cash: 'Tiền mặt', 
  card: 'Thẻ ngân hàng', 
  qr_transfer: 'QR / Chuyển khoản', 
  mixed: 'Thanh toán hỗn hợp' 
};
const PAY_COLOR: Record<string, string> = { 
  cash: '#10b981', 
  card: '#3b82f6', 
  qr_transfer: '#8b5cf6', 
  mixed: '#f59e0b' 
};

// Growth Badge component
function GrowthBadge({ value, invert = false }: { value: string | null, invert?: boolean }) {
  if (value === null || value === undefined) return <span className="text-xs text-gray-400">—</span>;
  const v = parseFloat(value);
  if (v === 0) return <span className="text-xs text-gray-400">0% so với kỳ trước</span>;
  
  const up = v >= 0;
  // For cancelled orders, "down" is good (green), "up" is bad (red)
  const isGreen = invert ? !up : up;
  const colorClass = isGreen ? 'text-emerald-600' : 'text-rose-600';
  const arrow = up ? '↑' : '↓';
  
  return (
    <span className={`text-xs font-semibold ${colorClass}`}>
      {arrow} {Math.abs(v)}% <span className="text-gray-400 font-normal">so với kỳ trước</span>
    </span>
  );
}

export default function ReportsPage() {
  const { user, logout } = useAuth();

  // Date range presets
  const today    = new Date().toISOString().slice(0, 10);
  const firstDay = new Date(new Date().setDate(1)).toISOString().slice(0, 10);
  
  const [from, setFrom] = useState(firstDay);
  const [to, setTo]     = useState(today);
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [activePreset, setActivePreset] = useState<'7days' | '30days' | '12months' | 'custom'>('custom');

  // Real-time Clock
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatClock = () => {
    const weekdays = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];
    const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = now.toLocaleTimeString('vi-VN', { hour12: false });
    const dayOfWeek = weekdays[now.getDay()];
    return { dateStr, timeStr, dayOfWeek };
  };
  const clock = formatClock();

  // Data states
  const [overview,    setOverview]    = useState<Overview | null>(null);
  const [revenue,     setRevenue]     = useState<RevenueRow[]>([]);
  const [shifts,      setShifts]      = useState<ShiftRow[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [cashiers,    setCashiers]    = useState<CashierRow[]>([]);
  const [categories,  setCategories]  = useState<CategoryRow[]>([]);
  const [payments,    setPayments]    = useState<PaymentRow[]>([]);
  
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');

  // AI Inventory Analysis states
  const [aiAnalysis, setAiAnalysis]       = useState<string | null>(() => {
    return sessionStorage.getItem('cached_ai_analysis');
  });
  const [aiProducts, setAiProducts]       = useState<any[]>(() => {
    const cached = sessionStorage.getItem('cached_ai_products');
    return cached ? JSON.parse(cached) : [];
  });
  const [aiLoading, setAiLoading]         = useState(false);
  const [aiError, setAiError]             = useState<string | null>(null);
  const [aiTopN, setAiTopN]               = useState(5);

  const fetchAiAnalysis = useCallback(async (limit: number) => {
    setAiLoading(true);
    setAiError(null);
    setAiAnalysis(null);
    try {
      const res = await aiService.analyzeInventory(limit);
      if (res.success) {
        setAiAnalysis(res.analysis);
        setAiProducts(res.data || []);
        // Lưu kết quả vào Cache trình duyệt để không bị load lại khi chuyển trang
        sessionStorage.setItem('cached_ai_analysis', res.analysis);
        sessionStorage.setItem('cached_ai_products', JSON.stringify(res.data || []));
      } else {
        setAiError(res.message || 'Lỗi phân tích');
      }
    } catch (err: any) {
      setAiError(err.response?.data?.message || err.message || 'Không thể kết nối AI');
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Tooltip interaction states for charts
  const [lineTooltip, setLineTooltip] = useState<{ idx: number; x: number; y: number } | null>(null);
  const [barTooltip, setBarTooltip]   = useState<{ idx: number; x: number; y: number } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = `from=${from}&to=${to}`;
      const [ov, rv, sf, tp, cs, cg, pm] = await Promise.all([
        api.get(`/reports/overview?${params}`),
        api.get(`/reports/revenue?${params}&group_by=${groupBy}`),
        api.get(`/reports/revenue-by-shift?${params}`),
        api.get(`/reports/top-products?${params}&limit=5`),
        api.get(`/reports/by-cashier?${params}`),
        api.get(`/reports/category-revenue?${params}`),
        api.get(`/reports/payment-methods?${params}`),
      ]);
      setOverview(ov.data.data);
      setRevenue(rv.data.data);
      setShifts(sf.data.data);
      setTopProducts(tp.data.data);
      setCashiers(cs.data.data);
      setCategories(cg.data.data);
      setPayments(pm.data.data);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Không thể tải báo cáo');
    } finally { setLoading(false); }
  }, [from, to, groupBy]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  useEffect(() => {
    const cached = sessionStorage.getItem('cached_ai_analysis');
    if (!cached) {
      fetchAiAnalysis(5); // Chỉ tự động chạy phân tích tồn kho AI lần đầu tiên nếu chưa có cache
    }
  }, [fetchAiAnalysis]);

  // Preset quick filters
  const applyPreset = (preset: '7days' | '30days' | '12months') => {
    const todayStr = new Date().toISOString().slice(0, 10);
    setActivePreset(preset);
    if (preset === '7days') {
      const d7 = new Date();
      d7.setDate(d7.getDate() - 6);
      setFrom(d7.toISOString().slice(0, 10));
      setTo(todayStr);
      setGroupBy('day');
    } else if (preset === '30days') {
      const d30 = new Date();
      d30.setDate(d30.getDate() - 29);
      setFrom(d30.toISOString().slice(0, 10));
      setTo(todayStr);
      setGroupBy('day');
    } else if (preset === '12months') {
      const d12 = new Date();
      d12.setMonth(d12.getMonth() - 11);
      d12.setDate(1);
      setFrom(d12.toISOString().slice(0, 10));
      setTo(todayStr);
      setGroupBy('month');
    }
  };

  // CSV Exporter (Excel export)
  const handleExportCSV = () => {
    if (!overview) return;
    let csv = '\uFEFF'; // BOM UTF-8 for Excel compatibility
    csv += 'BÁO CÁO THỐNG KÊ DOANH THU VÀ BÁN HÀNG\n';
    csv += `Thời gian báo cáo:;Từ ${from};Đến ${to}\n\n`;

    csv += 'KẾT QUẢ KINH DOANH CHỦ CHỐT\n';
    csv += `Tổng doanh thu;${fmtVND(overview.current.total_revenue).replace(/[^0-9,đ₫\s]/g, '')};Tăng trưởng;${overview.growth.revenue || 0}%\n`;
    csv += `Tổng đơn hàng;${overview.current.total_orders} đơn;Tăng trưởng;${overview.growth.orders || 0}%\n`;
    csv += `Số khách hàng;${overview.current.total_customers} khách;Tăng trưởng;${overview.growth.customers || 0}%\n`;
    csv += `Giá trị TB/đơn hàng;${fmtVND(overview.current.avg_order_value).replace(/[^0-9,đ₫\s]/g, '')};Tăng trưởng;${overview.growth.aov || 0}%\n`;
    csv += `Đơn hủy;${overview.current.cancelled_orders} đơn;Tăng trưởng;${overview.growth.cancelled || 0}%\n`;
    csv += `Doanh thu tiền mặt;${fmtVND(overview.current.cash_revenue).replace(/[^0-9,đ₫\s]/g, '')};Tỷ lệ;${((overview.current.cash_revenue / (overview.current.total_revenue || 1)) * 100).toFixed(1)}%\n\n`;

    csv += 'DANH MỤC DOANH THU\n';
    csv += 'Tên danh mục;Doanh thu;Tỷ lệ\n';
    categories.forEach(c => {
      const pct = overview.current.total_revenue > 0 ? (c.revenue / overview.current.total_revenue * 100).toFixed(1) : '0';
      csv += `${c.category};${c.revenue};${pct}%\n`;
    });
    csv += '\n';

    csv += 'TOP SẢN PHẨM BÁN CHẠY\n';
    csv += 'Tên sản phẩm;Số lượng bán;Doanh thu\n';
    topProducts.forEach(p => {
      csv += `${p.product_name};${p.total_qty};${p.total_revenue}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `bao_cao_pos_${from}_to_${to}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper date formatter for X-axis
  const formatLabel = (lbl: string) => {
    if (lbl && lbl.includes('-')) {
      const parts = lbl.split('-');
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      if (parts.length === 2) return `${parts[1]}/${parts[0].slice(2)}`; // Month: 06/26
    }
    return lbl;
  };

  // ----------------------------------------------------
  // RENDER CUSTOM SVG LINE CHART (Doanh thu theo thời gian)
  // ----------------------------------------------------
  const renderLineChart = () => {
    if (revenue.length === 0) {
      return <div className="flex items-center justify-center h-64 text-gray-400">Không có dữ liệu doanh thu</div>;
    }

    const width = 600;
    const height = 240;
    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const maxRev = Math.max(...revenue.map(r => r.revenue), 10000);
    const yMaxVal = maxRev * 1.15; // 15% head room

    // Map points to SVG coordinates
    const points = revenue.map((r, i) => {
      const x = paddingLeft + (i / (revenue.length - 1 || 1)) * (width - paddingLeft - paddingRight);
      const y = height - paddingBottom - (r.revenue / yMaxVal) * (height - paddingTop - paddingBottom);
      return { x, y, raw: r };
    });

    // Generate smooth bezier curve path
    let linePath = '';
    let areaPath = '';
    
    if (points.length > 0) {
      linePath = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];
        // Control points
        const cp1x = prev.x + (curr.x - prev.x) * 0.4;
        const cp1y = prev.y;
        const cp2x = curr.x - (curr.x - prev.x) * 0.4;
        const cp2y = curr.y;
        linePath += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${curr.x} ${curr.y}`;
      }
      areaPath = `${linePath} L ${points[points.length - 1].x} ${height - paddingBottom} L ${points[0].x} ${height - paddingBottom} Z`;
    }

    // Gridlines and Y-axis labels
    const gridCount = 4;
    const yGridlines = Array.from({ length: gridCount + 1 }, (_, i) => {
      const ratio = i / gridCount;
      const y = height - paddingBottom - ratio * (height - paddingTop - paddingBottom);
      const val = ratio * yMaxVal;
      return { y, val };
    });

    // Helper format labels: e.g. 2.4M, 600K
    const formatYVal = (val: number) => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace('.0', '')}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
      return val.toFixed(0);
    };

    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" className="overflow-visible select-none">
          <defs>
            <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff7a00" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#ff7a00" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Gridlines */}
          {yGridlines.map((gl, i) => (
            <g key={i}>
              <line 
                x1={paddingLeft} 
                y1={gl.y} 
                x2={width - paddingRight} 
                y2={gl.y} 
                stroke="#e2e8f0" 
                strokeWidth={1}
                strokeDasharray={i === 0 ? undefined : "3 3"} 
              />
              <text 
                x={paddingLeft - 10} 
                y={gl.y + 4} 
                textAnchor="end" 
                className="text-[9px] fill-gray-400 font-semibold"
              >
                {formatYVal(gl.val)}
              </text>
            </g>
          ))}

          {/* X Axis labels */}
          {points.map((p, i) => {
            const step = Math.ceil(revenue.length / 8);
            if (i % step !== 0 && i !== revenue.length - 1) return null;
            return (
              <text
                key={i}
                x={p.x}
                y={height - 10}
                textAnchor="middle"
                className="text-[9px] fill-gray-400 font-semibold"
              >
                {formatLabel(p.raw.label)}
              </text>
            );
          })}

          {/* Highlight Line on Hover */}
          {lineTooltip && (
            <line 
              x1={points[lineTooltip.idx].x} 
              y1={paddingTop} 
              x2={points[lineTooltip.idx].x} 
              y2={height - paddingBottom} 
              className="stroke-gray-300 stroke-1 stroke-dasharray-[3]" 
              strokeDasharray="4 4"
            />
          )}

          {/* Gradient Area Fill */}
          {areaPath && <path d={areaPath} fill="url(#lineGrad)" />}

          {/* Line Path */}
          {linePath && (
            <path 
              d={linePath} 
              fill="none" 
              stroke="#ff7a00" 
              strokeWidth={2.5} 
              strokeLinecap="round" 
              strokeLinejoin="round" 
            />
          )}

          {/* Interactive Circle Dots */}
          {points.map((p, i) => (
            <g 
              key={i} 
              onMouseEnter={() => setLineTooltip({ idx: i, x: p.x, y: p.y })}
              onMouseLeave={() => setLineTooltip(null)}
              className="cursor-pointer"
            >
              <circle cx={p.x} cy={p.y} r={12} fill="transparent" />
              <circle 
                cx={p.x} 
                cy={p.y} 
                r={lineTooltip?.idx === i ? 6 : 4} 
                fill="#ffffff" 
                stroke="#ff7a00" 
                strokeWidth={2.5} 
                className="transition-all duration-150"
              />
              <circle 
                cx={p.x} 
                cy={p.y} 
                r={lineTooltip?.idx === i ? 2 : 1.5} 
                fill="#ff7a00" 
              />
            </g>
          ))}
        </svg>

        {/* Floating Tooltip HTML Card */}
        {lineTooltip && (
          <div 
            className="absolute z-10 bg-gray-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl pointer-events-none transition-all duration-150"
            style={{ 
              left: `${(lineTooltip.x / width) * 100}%`, 
              top: `${(lineTooltip.y / height) * 100 - 18}%`,
              transform: 'translate(-50%, -100%)' 
            }}
          >
            <p className="font-semibold text-[10px] text-gray-400">{formatLabel(revenue[lineTooltip.idx].label)}</p>
            <p className="font-bold text-[#ff9f43] mt-0.5">{fmtVND(revenue[lineTooltip.idx].revenue)}</p>
            <p className="text-[10px] text-emerald-400">{revenue[lineTooltip.idx].orders} đơn hàng</p>
          </div>
        )}
      </div>
    );
  };

  // ----------------------------------------------------
  // RENDER CUSTOM SVG BAR CHART (Doanh thu theo ca)
  // ----------------------------------------------------
  const renderBarChart = () => {
    if (shifts.length === 0) {
      return <div className="flex items-center justify-center h-64 text-gray-400">Không có dữ liệu ca làm việc</div>;
    }

    const width = 600;
    const height = 240;
    const paddingLeft = 55;
    const paddingRight = 20;
    const paddingTop = 20;
    const paddingBottom = 30;

    const maxRev = Math.max(...shifts.map(s => s.revenue), 10000);
    const yMaxVal = maxRev * 1.15;

    const chartW = width - paddingLeft - paddingRight;
    const chartH = height - paddingTop - paddingBottom;

    // Gridlines
    const gridCount = 4;
    const yGridlines = Array.from({ length: gridCount + 1 }, (_, i) => {
      const ratio = i / gridCount;
      const y = height - paddingBottom - ratio * chartH;
      const val = ratio * yMaxVal;
      return { y, val };
    });

    const formatYVal = (val: number) => {
      if (val >= 1000000) return `${(val / 1000000).toFixed(1).replace('.0', '')}M`;
      if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
      return val.toFixed(0);
    };

    // Calculate bar dimensions
    const barSpacing = 0.4;
    const totalBars = shifts.length;
    const barWidth = chartW / (totalBars + (totalBars - 1) * barSpacing);
    const spaceWidth = barWidth * barSpacing;

    const bars = shifts.map((s, i) => {
      const x = paddingLeft + i * (barWidth + spaceWidth);
      const barH = (s.revenue / yMaxVal) * chartH;
      const y = height - paddingBottom - barH;
      return { x, y, w: barWidth, h: Math.max(barH, 2), raw: s };
    });

    return (
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} width="100%" height="100%" className="overflow-visible select-none">
          {/* Y Axis Gridlines */}
          {yGridlines.map((gl, i) => (
            <g key={i}>
              <line x1={paddingLeft} y1={gl.y} x2={width - paddingRight} y2={gl.y} stroke="#e2e8f0" strokeWidth={1} />
              <text x={paddingLeft - 10} y={gl.y + 4} textAnchor="end" className="text-[9px] fill-gray-400 font-semibold">
                {formatYVal(gl.val)}
              </text>
            </g>
          ))}

          {/* Bar shapes */}
          {bars.map((bar, i) => (
            <g 
              key={i}
              onMouseEnter={() => setBarTooltip({ idx: i, x: bar.x + bar.w / 2, y: bar.y })}
              onMouseLeave={() => setBarTooltip(null)}
              className="cursor-pointer"
            >
              <rect
                x={bar.x}
                y={paddingTop}
                width={bar.w}
                height={chartH}
                fill="#f1f5f9"
                opacity={0.3}
                rx={Math.min(bar.w / 2, 4)}
              />
              <rect
                x={bar.x}
                y={bar.y}
                width={bar.w}
                height={bar.h}
                fill={barTooltip?.idx === i ? '#1d4ed8' : '#3b82f6'}
                rx={Math.min(bar.w / 2, 4)}
                className="transition-all duration-150"
              />
            </g>
          ))}

          {/* X Axis Labels */}
          {bars.map((bar, i) => {
            const step = Math.ceil(shifts.length / 8);
            if (i % step !== 0 && i !== shifts.length - 1) return null;
            return (
              <text
                key={i}
                x={bar.x + bar.w / 2}
                y={height - 10}
                textAnchor="middle"
                className="text-[9px] fill-gray-400 font-semibold"
              >
                {bar.raw.label}
              </text>
            );
          })}
        </svg>

        {/* Floating Tooltip HTML Card */}
        {barTooltip && (
          <div 
            className="absolute z-10 bg-gray-900 text-white px-3 py-2 rounded-xl text-xs shadow-xl pointer-events-none transition-all duration-150"
            style={{ 
              left: `${(barTooltip.x / width) * 100}%`, 
              top: `${(barTooltip.y / height) * 100 - 10}%`,
              transform: 'translate(-50%, -100%)' 
            }}
          >
            <p className="font-bold text-[10px] text-gray-305">Ca làm việc #{shifts[barTooltip.idx].id}</p>
            <p className="text-[10px] text-gray-400">NV: {shifts[barTooltip.idx].cashier_name}</p>
            <p className="font-bold text-blue-400 mt-0.5">{fmtVND(shifts[barTooltip.idx].revenue)}</p>
            <p className="text-[10px] text-emerald-400">{shifts[barTooltip.idx].orders} đơn hàng</p>
          </div>
        )}
      </div>
    );
  };

  // ----------------------------------------------------
  // RENDER DONUT CHART (Phương thức thanh toán)
  // ----------------------------------------------------
  const renderDonutChart = () => {
    if (payments.length === 0) {
      return <div className="flex items-center justify-center h-48 text-gray-400 text-sm">Không có dữ liệu thanh toán</div>;
    }

    const radius = 55;
    const strokeWidth = 15;
    const circumference = 2 * Math.PI * radius; // ~345.57

    const totalOrders = payments.reduce((sum, p) => sum + p.count, 0);

    // Prepare chart segments
    const segments = payments.map(p => {
      const pct = totalOrders > 0 ? (p.count / totalOrders) * 100 : 0;
      return {
        method: p.method,
        label: PAY_LABEL[p.method] || p.method,
        count: p.count,
        revenue: p.revenue,
        pct: pct,
        color: PAY_COLOR[p.method] || '#6b7280'
      };
    }).sort((a, b) => b.count - a.count);

    let accumulatedPct = 0;

    return (
      <div className="flex flex-col items-center justify-center gap-4 w-full">
        {/* SVG Donut */}
        <div className="relative w-44 h-44 flex-shrink-0 mx-auto">
          <svg viewBox="0 0 150 150" width="100%" height="100%">
            <circle 
              cx="75" 
              cy="75" 
              r={radius} 
              fill="transparent" 
              stroke="#f1f5f9" 
              strokeWidth={strokeWidth} 
            />
            {segments.map((s, idx) => {
              const dashArray = `${(s.pct / 100) * circumference} ${circumference}`;
              const dashOffset = circumference - (accumulatedPct / 100) * circumference;
              accumulatedPct += s.pct;
              return (
                <circle
                  key={s.method}
                  cx="75"
                  cy="75"
                  r={radius}
                  fill="transparent"
                  stroke={s.color}
                  strokeWidth={strokeWidth}
                  strokeDasharray={dashArray}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 75 75)"
                  className="transition-all duration-300 hover:opacity-90 cursor-pointer"
                  strokeLinecap="round"
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-gray-900">{totalOrders}</span>
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Tổng đơn</span>
          </div>
        </div>

        {/* Legend stacked below */}
        <div className="space-y-2 w-full px-2">
          {segments.map(s => (
            <div key={s.method} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
                <span className="text-gray-500 font-semibold truncate">{s.label}</span>
              </div>
              <div className="text-right font-bold text-gray-700 ml-2 whitespace-nowrap">
                {s.count} đơn ({s.pct.toFixed(0)}%)
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 bg-slate-50 min-h-screen space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between bg-white border border-gray-100 p-5 rounded-2xl gap-4 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Báo cáo</h1>
          <p className="text-gray-400 text-xs mt-0.5">Thống kê và phân tích dữ liệu bán hàng</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4 ml-auto">
          {/* Export Excel (CSV) */}
          <button 
            onClick={handleExportCSV}
            className="flex items-center gap-2 border border-emerald-255 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm"
          >
            <Icon name="download" size={14} className="text-emerald-700" /> Xuất Excel
          </button>

          {/* Refresh */}
          <button 
            onClick={fetchAll}
            className="flex items-center gap-2 border border-gray-200 text-gray-700 bg-white hover:bg-gray-50 transition px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm"
          >
            <Icon name="refresh" size={14} /> Làm mới
          </button>

          {/* Real-time Clock */}
          <div className="text-right border-l border-gray-100 pl-4 hidden md:block">
            <p className="text-xs font-bold text-gray-800 leading-tight">{clock.dateStr}</p>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">{clock.dayOfWeek} · {clock.timeStr}</p>
          </div>

          {/* Cashier/Admin Badge Profile */}
          <div className="flex items-center gap-2.5 border-l border-gray-100 pl-4">
            <div className="text-right">
              <p className="text-xs font-bold text-gray-800 leading-none">{user?.full_name || 'Quản trị viên'}</p>
              <span className="inline-block text-[9px] font-bold text-orange-700 bg-orange-50 px-2 py-0.5 rounded-full mt-1 uppercase tracking-wide">
                {user?.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'}
              </span>
            </div>
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white text-xs font-black shadow-inner">
              {user?.full_name?.charAt(0) || 'A'}
            </div>
          </div>

          {/* Logout */}
          <button 
            onClick={logout}
            className="flex items-center gap-1 border border-gray-200 text-gray-500 hover:text-rose-600 hover:bg-rose-50 transition p-2.5 rounded-xl shadow-sm"
            title="Đăng xuất"
          >
            <Icon name="logout" size={14} />
          </button>
        </div>
      </div>

      {/* Date filter & Selector */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Line chart preset switch */}
        <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-xl border border-gray-100 w-fit">
          <button 
            onClick={() => applyPreset('7days')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${activePreset === '7days' ? 'bg-white shadow-sm text-gray-900 border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
          >
            7 ngày
          </button>
          <button 
            onClick={() => applyPreset('30days')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${activePreset === '30days' ? 'bg-white shadow-sm text-gray-900 border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
          >
            30 ngày
          </button>
          <button 
            onClick={() => applyPreset('12months')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${activePreset === '12months' ? 'bg-white shadow-sm text-gray-900 border border-gray-100' : 'text-gray-400 hover:text-gray-600'}`}
          >
            12 tháng
          </button>
        </div>

        {/* Custom Date Range Picker */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-500">Tùy chọn:</span>
          <input 
            type="date" 
            value={from} 
            onChange={e => { setFrom(e.target.value); setActivePreset('custom'); }}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
          <span className="text-gray-300 text-xs font-medium">—</span>
          <input 
            type="date" 
            value={to} 
            onChange={e => { setTo(e.target.value); setActivePreset('custom'); }}
            className="border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500" 
          />
        </div>
      </div>

      {error && <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-2xl text-xs font-semibold">{error}</div>}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-96 space-y-4">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500" />
          <span className="text-xs text-gray-400 font-bold">Đang tổng hợp báo cáo...</span>
        </div>
      ) : (
        <>
          {/* KPI Cards Grid */}
          {overview && (
            <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
              {/* Card 1: Tổng doanh thu */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 font-bold">Tổng doanh thu</span>
                  <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center text-orange-500">
                    <Icon name="wallet" size={16} fill />
                  </div>
                </div>
                <div>
                  <h3 className="text-[22px] font-extrabold text-gray-900 tracking-tight mb-1 leading-none">{fmtVND(overview.current.total_revenue)}</h3>
                  <div className="mt-1">
                    <GrowthBadge value={overview.growth.revenue} />
                  </div>
                </div>
              </div>

              {/* Card 2: Tổng đơn hàng */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 font-bold">Tổng đơn hàng</span>
                  <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-blue-500">
                    <Icon name="shopping_cart" size={16} fill />
                  </div>
                </div>
                <div>
                  <h3 className="text-[22px] font-extrabold text-gray-900 tracking-tight mb-1 leading-none">{overview.current.total_orders} đơn</h3>
                  <div className="mt-1">
                    <GrowthBadge value={overview.growth.orders} />
                  </div>
                </div>
              </div>

              {/* Card 3: Số khách hàng */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 font-bold">Số khách hàng</span>
                  <div className="w-8 h-8 rounded-xl bg-purple-50 flex items-center justify-center text-purple-500">
                    <Icon name="people" size={16} fill />
                  </div>
                </div>
                <div>
                  <h3 className="text-[22px] font-extrabold text-gray-900 tracking-tight mb-1 leading-none">{overview.current.total_customers} khách</h3>
                  <div className="mt-1">
                    <GrowthBadge value={overview.growth.customers} />
                  </div>
                </div>
              </div>

              {/* Card 4: Giá trị TB/đơn hàng (AOV) */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 font-bold">Giá trị TB/đơn (AOV)</span>
                  <div className="w-8 h-8 rounded-xl bg-sky-50 flex items-center justify-center text-sky-500">
                    <Icon name="analytics" size={16} fill />
                  </div>
                </div>
                <div>
                  <h3 className="text-[22px] font-extrabold text-gray-900 tracking-tight mb-1 leading-none">{fmtVND(overview.current.avg_order_value)}</h3>
                  <div className="mt-1">
                    <GrowthBadge value={overview.growth.aov} />
                  </div>
                </div>
              </div>

              {/* Card 5: Đơn hủy */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 font-bold">Đơn hủy</span>
                  <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-500">
                    <Icon name="warning" size={16} fill />
                  </div>
                </div>
                <div>
                  <h3 className="text-[22px] font-extrabold text-gray-900 tracking-tight mb-1 leading-none">{overview.current.cancelled_orders} đơn</h3>
                  <div className="mt-1">
                    <GrowthBadge value={overview.growth.cancelled} invert={true} />
                  </div>
                </div>
              </div>

              {/* Card 6: Doanh thu tiền mặt */}
              <div className="bg-white border border-gray-100 rounded-2xl p-5 flex flex-col justify-between shadow-sm relative overflow-hidden group">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-gray-500 font-bold">Doanh thu tiền mặt</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-500">
                    <Icon name="payments" size={16} fill />
                  </div>
                </div>
                <div>
                  <h3 className="text-[22px] font-extrabold text-gray-900 tracking-tight mb-1 leading-none">{fmtVND(overview.current.cash_revenue)}</h3>
                  <div className="mt-1 leading-none">
                    <span className="text-xs text-gray-400 font-semibold">
                      — {((overview.current.cash_revenue / (overview.current.total_revenue || 1)) * 100).toFixed(1)}% tổng doanh thu
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Line chart: Doanh thu theo thời gian */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div>
                <h3 className="font-extrabold text-gray-800 text-sm tracking-tight">Doanh thu theo thời gian</h3>
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Biểu đồ biểu diễn doanh số bán hàng hàng ngày</p>
              </div>
              {renderLineChart()}
            </div>

            {/* Bar chart: Doanh thu theo ca */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <div>
                <h3 className="font-extrabold text-gray-800 text-sm tracking-tight">Doanh thu theo ca</h3>
                <p className="text-[10px] text-gray-400 mt-0.5 font-medium">Biểu đồ doanh số thu được của từng ca làm việc</p>
              </div>
              {renderBarChart()}
            </div>
          </div>

          {/* Tables and Payments Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Top nhân viên bán hàng */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="font-extrabold text-gray-800 text-sm tracking-tight">Top nhân viên bán hàng</h3>
              {cashiers.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-xs">Chưa có dữ liệu nhân viên</div>
              ) : (
                <div className="space-y-4">
                  {cashiers.slice(0, 5).map((c, i) => {
                    const maxCashierRev = Math.max(...cashiers.map(x => x.total_revenue), 1);
                    const pct = (c.total_revenue / maxCashierRev) * 100;
                    return (
                      <div key={c.id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-400 w-3">{i + 1}</span>
                            <span className="font-bold text-gray-700 truncate max-w-[150px]">{c.full_name}</span>
                          </div>
                          <span className="font-bold text-gray-900">{fmtVND(c.total_revenue)}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <span>{c.total_orders} đơn</span>
                        </div>
                        <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100">
                          <div 
                            className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Top sản phẩm bán chạy */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="font-extrabold text-gray-800 text-sm tracking-tight">Top sản phẩm bán chạy</h3>
              {topProducts.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-xs">Chưa có dữ liệu sản phẩm</div>
              ) : (
                <div className="space-y-4">
                  {topProducts.slice(0, 5).map((p, i) => {
                    const maxProdQty = Math.max(...topProducts.map(x => x.total_qty), 1);
                    const pct = (p.total_qty / maxProdQty) * 100;
                    return (
                      <div key={p.product_id} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-gray-400 w-3">{i + 1}</span>
                            <span className="font-bold text-gray-700 truncate max-w-[150px]">{p.product_name}</span>
                          </div>
                          <span className="font-bold text-gray-950">{p.total_qty} món</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-400">
                          <span>{fmtVND(p.total_revenue)}</span>
                        </div>
                        <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100">
                          <div 
                            className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Doanh thu theo danh mục */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="font-extrabold text-gray-800 text-sm tracking-tight">Doanh thu theo danh mục</h3>
              {categories.length === 0 ? (
                <div className="flex items-center justify-center h-48 text-gray-400 text-xs">Chưa có dữ liệu danh mục</div>
              ) : (
                <div className="space-y-4">
                  {categories.slice(0, 5).map((c) => {
                    const maxCatRev = Math.max(...categories.map(x => x.revenue), 1);
                    const pct = (c.revenue / maxCatRev) * 100;
                    const totalSales = overview?.current.total_revenue || 1;
                    const sharePct = (c.revenue / totalSales) * 100;
                    return (
                      <div key={c.category} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-gray-700 truncate max-w-[150px]">{c.category}</span>
                          <span className="font-bold text-gray-950">{fmtVND(c.revenue)} ({sharePct.toFixed(1)}%)</span>
                        </div>
                        <div className="w-full bg-slate-50 h-2 rounded-full overflow-hidden border border-slate-100">
                          <div 
                            className="bg-orange-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${pct}%` }} 
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Phương thức thanh toán */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
              <h3 className="font-extrabold text-gray-800 text-sm tracking-tight">Phương thức thanh toán</h3>
              <div className="h-full flex items-center justify-center">
                {renderDonutChart()}
              </div>
            </div>
          </div>

          {/* ═══════════════ AI PHÂN TÍCH TỒN KHO ═══════════════ */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 px-6 py-5">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <Icon name="smart_toy" size={22} className="text-white" />
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">AI Phân Tích Tồn Kho & Dự Đoán Nhập Hàng</h3>
                    <p className="text-white/70 text-xs mt-0.5">Phân tích dựa trên dữ liệu bán hàng 30 ngày + tồn kho thực tế</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="p-6">
              {/* Chưa phân tích */}
              {!aiAnalysis && !aiLoading && !aiError && (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                    <Icon name="analytics" size={28} className="text-indigo-500" />
                  </div>
                  <p className="text-gray-800 font-bold text-base mb-1">Phân tích tồn kho thông minh</p>
                  <p className="text-gray-400 text-sm max-w-md mx-auto leading-relaxed">
                    AI sẽ phân tích tốc độ bán hàng, dự đoán thời gian hết hàng và gợi ý số lượng nhập cho từng sản phẩm.
                  </p>
                  <p className="text-gray-300 text-xs mt-3">Nhấn "Phân tích ngay" để bắt đầu</p>
                </div>
              )}

              {/* Loading */}
              {aiLoading && (
                <div className="text-center py-16">
                  <div className="relative w-16 h-16 mx-auto mb-4">
                    <div className="absolute inset-0 rounded-full border-4 border-indigo-100" />
                    <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-indigo-600 animate-spin" />
                    <div className="absolute inset-2 rounded-full bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
                      <Icon name="smart_toy" size={20} className="text-indigo-500" />
                    </div>
                  </div>
                  <p className="text-gray-800 font-bold text-sm">AI đang phân tích dữ liệu...</p>
                  <p className="text-gray-400 text-xs mt-1">Truy vấn dữ liệu bán hàng 30 ngày + tồn kho hiện tại</p>
                </div>
              )}

              {/* Error */}
              {aiError && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-100">
                  <Icon name="error_outline" size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-red-700 font-bold text-sm">Lỗi phân tích</p>
                    <p className="text-red-500 text-xs mt-0.5">{aiError}</p>
                  </div>
                </div>
              )}

              {/* Kết quả AI */}
              {aiAnalysis && (
                <div className="space-y-6">
                  {/* Bảng tóm tắt data thô */}
                  {aiProducts.length > 0 && (
                    <div className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <h4 className="font-bold text-xs text-gray-600 uppercase tracking-wider">Dữ liệu tồn kho gốc</h4>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-gray-200">
                              <th className="text-left py-2 px-2 font-bold text-gray-500">#</th>
                              <th className="text-left py-2 px-2 font-bold text-gray-500">Sản phẩm</th>
                              <th className="text-right py-2 px-2 font-bold text-gray-500">Tồn kho</th>
                              <th className="text-right py-2 px-2 font-bold text-gray-500">Bán 30 ngày</th>
                              <th className="text-right py-2 px-2 font-bold text-gray-500">Bán 7 ngày</th>
                              <th className="text-right py-2 px-2 font-bold text-gray-500">TB/ngày</th>
                              <th className="text-right py-2 px-2 font-bold text-gray-500">Còn ~ngày</th>
                            </tr>
                          </thead>
                          <tbody>
                            {aiProducts.map((p, i) => (
                              <tr key={i} className="border-b border-gray-50 hover:bg-white transition">
                                <td className="py-2 px-2 text-gray-400 font-bold">{i + 1}</td>
                                <td className="py-2 px-2 font-semibold text-gray-800 max-w-[180px] truncate">{p.name}</td>
                                <td className={`py-2 px-2 text-right font-bold ${
                                  p.current_stock === 0 ? 'text-red-600' :
                                  p.current_stock <= p.min_stock ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {p.current_stock === 0 ? '🔴 0' :
                                   p.current_stock <= p.min_stock ? `🟡 ${p.current_stock}` :
                                   `🟢 ${p.current_stock}`}
                                </td>
                                <td className="py-2 px-2 text-right text-gray-700 font-semibold">{p.sold_last_30_days}</td>
                                <td className="py-2 px-2 text-right text-gray-700 font-semibold">{p.sold_last_7_days}</td>
                                <td className="py-2 px-2 text-right text-gray-500">{p.daily_avg_30d}/ngày</td>
                                <td className={`py-2 px-2 text-right font-bold ${
                                  p.days_until_stockout === null ? 'text-gray-300' :
                                  p.days_until_stockout <= 7 ? 'text-red-600' :
                                  p.days_until_stockout <= 14 ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  {p.days_until_stockout === null ? '—' : `${p.days_until_stockout} ngày`}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Phân tích từ AI (markdown) */}
                  <div className="bg-white rounded-xl border border-indigo-100 p-5">
                    <div className="flex items-center gap-2 mb-4 pb-3 border-b border-indigo-50">
                      <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
                        <Icon name="smart_toy" size={15} className="text-white" />
                      </div>
                      <h4 className="font-bold text-sm text-gray-800">Phân tích & Gợi ý từ AI</h4>
                    </div>
                    <div className="ai-report-markdown prose prose-sm max-w-none text-gray-700 leading-relaxed">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiAnalysis}</ReactMarkdown>
                    </div>
                  </div>

                  {/* Nút phân tích lại */}
                  <div className="text-center">
                    <button
                      onClick={() => fetchAiAnalysis(aiTopN)}
                      disabled={aiLoading}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold
                        text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100
                        transition disabled:opacity-50"
                    >
                      <Icon name="refresh" size={14} />
                      Phân tích lại
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* CSS cho AI markdown trong báo cáo */}
          <style>{`
            .ai-report-markdown h1, .ai-report-markdown h2, .ai-report-markdown h3 {
              font-size: 14px; font-weight: 800; color: #1e293b;
              margin: 16px 0 8px; padding-bottom: 6px;
              border-bottom: 1px solid #f1f5f9;
            }
            .ai-report-markdown h1 { font-size: 16px; }
            .ai-report-markdown p { margin: 6px 0; font-size: 13px; line-height: 1.7; }
            .ai-report-markdown ul, .ai-report-markdown ol { margin: 6px 0; padding-left: 20px; }
            .ai-report-markdown li { margin: 3px 0; font-size: 13px; }
            .ai-report-markdown strong { color: #0f172a; font-weight: 700; }
            .ai-report-markdown table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; }
            .ai-report-markdown th, .ai-report-markdown td {
              padding: 8px 10px; text-align: left;
              border: 1px solid #e2e8f0;
            }
            .ai-report-markdown th {
              font-weight: 700; background: #f8fafc; color: #475569;
            }
            .ai-report-markdown tr:nth-child(even) { background: #fafbfc; }
            .ai-report-markdown code {
              background: #f1f5f9; padding: 2px 6px; border-radius: 4px;
              font-size: 12px; color: #6366f1;
            }
            .ai-report-markdown blockquote {
              border-left: 3px solid #6366f1; padding: 8px 12px;
              margin: 10px 0; background: #f8f7ff;
              border-radius: 0 8px 8px 0; color: #4c1d95;
            }
          `}</style>
        </>
      )}
    </div>
  );
}
