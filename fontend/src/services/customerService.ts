// frontend/src/services/customerService.ts
import api from './authService';

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  reward_points: number;
  total_spent: number;
  note?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PointTransaction {
  id: number;
  customer_id: number;
  order_id?: number;
  order_code?: string;
  type: 'earn' | 'redeem' | 'adjust' | 'expire';
  points: number;
  balance_before: number;
  balance_after: number;
  note?: string;
  created_at: string;
}

export interface CreateCustomerData {
  name: string;
  phone: string;
  email?: string;
  address?: string;
  date_of_birth?: string;
  gender?: 'male' | 'female' | 'other';
  note?: string;
}

// Quy đổi điểm
export const POINTS_CONFIG = {
  VND_PER_POINT: 1000,   // 1 điểm = 1.000đ giảm giá
  POINTS_PER_VND: 10000, // 10.000đ = 1 điểm
};

export const customerService = {
  /** Tìm kiếm khách hàng bằng SĐT (dùng tại POS) */
  searchByPhone: async (phone: string): Promise<Customer | null> => {
    try {
      const res = await api.get(`/customers/search?phone=${encodeURIComponent(phone)}`);
      return res.data.success ? res.data.data : null;
    } catch (err: any) {
      if (err.response?.status === 404) return null;
      throw err;
    }
  },

  /** Danh sách khách hàng */
  getList: async (params: { page?: number; limit?: number; search?: string } = {}) => {
    const { page = 1, limit = 20, search = '' } = params;
    const res = await api.get(`/customers?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`);
    return res.data;
  },

  /** Thông tin chi tiết + lịch sử điểm */
  getById: async (id: number) => {
    const res = await api.get(`/customers/${id}`);
    return res.data.data;
  },

  /** Tạo mới */
  create: async (data: CreateCustomerData): Promise<Customer> => {
    const res = await api.post('/customers', data);
    return res.data.data;
  },

  /** Cập nhật */
  update: async (id: number, data: CreateCustomerData): Promise<Customer> => {
    const res = await api.put(`/customers/${id}`, data);
    return res.data.data;
  },

  /** Xóa */
  delete: async (id: number): Promise<void> => {
    await api.delete(`/customers/${id}`);
  },

  /** Lịch sử điểm */
  getPointHistory: async (id: number): Promise<PointTransaction[]> => {
    const res = await api.get(`/customers/${id}/points`);
    return res.data.data;
  },

  /** Tính số tiền giảm từ điểm */
  calculatePointsValue: (points: number): number => {
    return points * POINTS_CONFIG.VND_PER_POINT;
  },

  /** Tính điểm sẽ nhận được từ số tiền */
  calculateEarnedPoints: (amount: number): number => {
    return Math.floor(amount / POINTS_CONFIG.POINTS_PER_VND);
  },
};
