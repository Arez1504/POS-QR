// frontend/src/services/authService.ts
import axios from 'axios';

// Lấy API_URL động dựa theo hostname trình duyệt để hoạt động trên điện thoại
const getApiUrl = () => {
  const envUrl = (import.meta as any).env?.VITE_API_URL;
  if (envUrl) return envUrl;
  return '/api';
};

const API_URL = getApiUrl();

const api = axios.create({ baseURL: API_URL });

// Tự động gắn token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pos_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Tự redirect nếu token hết hạn
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 || err.response?.status === 403) {
      localStorage.removeItem('pos_token');
      localStorage.removeItem('pos_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export const authService = {
  login: async (username: string, password: string) => {
    const res = await api.post('/auth/login', { username, password });
    if (res.data.success) {
      localStorage.setItem('pos_token', res.data.token);
      localStorage.setItem('pos_user', JSON.stringify(res.data.user));
    }
    return res.data;
  },

  logout: async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('pos_token');
    localStorage.removeItem('pos_user');
  },

  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },

  changePassword: async (old_password: string, new_password: string) => {
    const res = await api.put('/auth/change-password', { old_password, new_password });
    return res.data;
  },

  getCurrentUser: () => {
    const user = localStorage.getItem('pos_user');
    return user ? JSON.parse(user) : null;
  },

  isLoggedIn: () => !!localStorage.getItem('pos_token'),
};

export default api;