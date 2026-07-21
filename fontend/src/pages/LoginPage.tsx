import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { authService } from '../services/authService';
import Icon from '../components/Icon';
import posHero from '../assets/loginface.png';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ username: '', password: '', remember: false });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username.trim() || !form.password.trim()) {
      setError('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password);
      const currentUser = authService.getCurrentUser();
      if (currentUser?.role === 'admin') {
        navigate('/dashboard');
      } else {
        navigate('/pos');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Sai tên đăng nhập hoặc mật khẩu');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex" style={{ fontFamily: "'Inter', sans-serif", background: '#f0f4ff' }}>

      {/* ── Left: Hero Panel ── */}
      <div
        className="hidden lg:flex flex-col justify-between flex-1 p-12 relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #dce8ff 0%, #c7d9ff 40%, #d4c5ff 100%)',
        }}
      >
        {/* Decorative blobs */}
        <div style={{
          position: 'absolute', top: '-80px', left: '-80px',
          width: '320px', height: '320px', borderRadius: '50%',
          background: 'rgba(99,102,241,0.12)', filter: 'blur(60px)'
        }} />
        <div style={{
          position: 'absolute', bottom: '-60px', right: '-60px',
          width: '260px', height: '260px', borderRadius: '50%',
          background: 'rgba(59,130,246,0.15)', filter: 'blur(50px)'
        }} />

        {/* Logo / Brand */}
        <div className="relative z-10 flex items-center gap-2">
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Icon name="qr_code" size={20} fill className="text-white" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#1e3a8a' }}>QR POS System</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10">
          <h1 style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.2, color: '#1e3a8a', marginBottom: 16 }}>
            Tối ưu hóa<br />
            <span style={{ color: '#2563eb' }}>quy trình bán hàng.</span>
          </h1>
          <p style={{ fontSize: 14, color: '#3b5ea6', maxWidth: 380, lineHeight: 1.7 }}>
            Giải pháp quản lý kho bãi, mã vạch và hóa đơn toàn diện cho doanh nghiệp bán lẻ hiện đại.
            Nhanh chóng, chính xác và chuyên nghiệp.
          </p>

          {/* Hero illustration */}
          <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
            <img
              src={posHero}
              alt="POS System"
              style={{ width: '100%', maxWidth: 400, filter: 'drop-shadow(0 20px 40px rgba(59,130,246,0.2))' }}
            />
          </div>
        </div>

        {/* Footer badges */}
        <div className="relative z-10 flex items-center gap-4">
          {['Bảo mật cao', 'Hoạt động 24/7', 'Hỗ trợ đa chi nhánh'].map(tag => (
            <div key={tag} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.5)', backdropFilter: 'blur(8px)',
              borderRadius: 20, padding: '6px 14px', fontSize: 12,
              color: '#1e3a8a', fontWeight: 600, border: '1px solid rgba(255,255,255,0.7)'
            }}>
              <Icon name="check_circle" size={13} fill className="text-blue-600" />
              {tag}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right: Login Form ── */}
      <div className="flex items-center justify-center w-full lg:w-auto lg:min-w-[440px] p-6 lg:p-12"
        style={{ background: '#fff' }}>

        <div style={{ width: '100%', maxWidth: 360 }}>

          {/* Icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 8px 24px rgba(99,102,241,0.3)'
            }}>
              <Icon name="qr_code" size={26} fill className="text-white" />
            </div>
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <h2 style={{ fontSize: 22, fontWeight: 800, color: '#0f172a', marginBottom: 6, lineHeight: 1.3 }}>
              Đăng nhập hệ<br />thống POS
            </h2>
            <p style={{ fontSize: 13, color: '#64748b' }}>
              Nhập thông tin tài khoản để truy cập quầy thu ngân
            </p>
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca',
              borderRadius: 10, padding: '10px 14px',
              marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8
            }}>
              <Icon name="error_outline" size={16} fill className="text-red-500" />
              <span style={{ fontSize: 13, color: '#dc2626' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Username */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Tên đăng nhập
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  color: '#9ca3af', display: 'flex', alignItems: 'center'
                }}>
                  <Icon name="fingerprint" size={18} />
                </div>
                <input
                  id="login-username"
                  type="text"
                  value={form.username}
                  onChange={e => setForm({ ...form, username: e.target.value })}
                  placeholder="Nhập tên đăng nhập của bạn"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '11px 14px 11px 40px',
                    border: '1.5px solid #e5e7eb', borderRadius: 10,
                    fontSize: 13, color: '#0f172a', outline: 'none',
                    background: '#f9fafb', boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                  onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Mật khẩu
              </label>
              <div style={{ position: 'relative' }}>
                <div style={{
                  position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)',
                  color: '#9ca3af', display: 'flex', alignItems: 'center'
                }}>
                  <Icon name="lock" size={18} />
                </div>
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  disabled={loading}
                  style={{
                    width: '100%', padding: '11px 44px 11px 40px',
                    border: '1.5px solid #e5e7eb', borderRadius: 10,
                    fontSize: 13, color: '#0f172a', outline: 'none',
                    background: '#f9fafb', boxSizing: 'border-box',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={e => (e.target.style.borderColor = '#3b82f6')}
                  onBlur={e => (e.target.style.borderColor = '#e5e7eb')}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#9ca3af', display: 'flex', alignItems: 'center', padding: 2
                  }}
                >
                  <Icon name={showPass ? 'visibility_off' : 'visibility'} size={17} />
                </button>
              </div>
            </div>

            {/* Remember + Forgot */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                <input
                  type="checkbox"
                  id="login-remember"
                  checked={form.remember}
                  onChange={e => setForm({ ...form, remember: e.target.checked })}
                  style={{ width: 14, height: 14, accentColor: '#3b82f6', cursor: 'pointer' }}
                />
                Ghi nhớ đăng nhập
              </label>
              <span
                style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => { }}
              >
                Quên mật khẩu?
              </span>
            </div>

            {/* Submit button */}
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#93c5fd' : 'linear-gradient(135deg, #2563eb, #4f46e5)',
                color: '#fff',
                border: 'none',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: loading ? 'none' : '0 4px 14px rgba(37,99,235,0.4)',
                transition: 'all 0.2s',
                marginTop: 4
              }}
            >
              {loading ? (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
                    <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                    <path d="M12 2a10 10 0 0 1 10 10" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
                  </svg>
                  Đang đăng nhập...
                </>
              ) : (
                <>
                  <Icon name="login" size={17} fill className="text-white" />
                  Đăng nhập
                </>
              )}
            </button>
          </form>

          {/* Footer */}
          <p style={{ marginTop: 24, textAlign: 'center', fontSize: 12.5, color: '#94a3b8' }}>
            Bạn gặp sự cố?{' '}
            <span style={{ color: '#3b82f6', fontWeight: 600, cursor: 'pointer' }}>
              Liên hệ quản trị viên
            </span>
          </p>
        </div>
      </div>

      {/* Spin keyframe */}
      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}