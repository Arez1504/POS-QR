// frontend/src/services/shiftService.ts
import api from './authService';

export interface Shift {
  id: number;
  user_id: number;
  cashier_name?: string;
  cashier_username?: string;
  start_time: string;
  end_time: string | null;
  opening_cash: number;
  closing_cash: number | null;
  total_sales: number;
  total_orders: number;
  status: 'open' | 'closed';
  note: string | null;
}

export interface ShiftStats {
  total_sales: number;
  total_orders: number;
  cash_sales: number;
  non_cash_sales: number;
}

export interface ShiftActiveResponse {
  success: boolean;
  data: Shift | null;
  stats?: ShiftStats;
}

export interface ShiftHistoryResponse {
  success: boolean;
  data: Shift[];
  total: number;
  page: number;
  limit: number;
}

export interface ShiftHistoryParams {
  page?: number;
  limit?: number;
  user_id?: number;
  status?: 'open' | 'closed';
  start_date?: string;
  end_date?: string;
}

export interface ShiftAssignment {
  id: number;
  user_id: number;
  employee_name?: string;
  employee_username?: string;
  shift_date: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  notes: string | null;
  created_at: string;
}

export interface ShiftAssignmentParams {
  start_date?: string;
  end_date?: string;
  user_id?: number;
}

export const shiftService = {
  getActive: async (): Promise<ShiftActiveResponse> => {
    const res = await api.get('/shifts/active');
    return res.data;
  },

  open: async (openingCash: number): Promise<{ success: boolean; message: string; data: Shift }> => {
    const res = await api.post('/shifts/open', { opening_cash: openingCash });
    return res.data;
  },

  close: async (closingCash: number, note?: string): Promise<{ success: boolean; message: string; data: Shift }> => {
    const res = await api.post('/shifts/close', { closing_cash: closingCash, note });
    return res.data;
  },

  getHistory: async (params: ShiftHistoryParams = {}): Promise<ShiftHistoryResponse> => {
    const res = await api.get('/shifts/history', { params });
    return res.data;
  },

  getAssignments: async (params: ShiftAssignmentParams = {}): Promise<{ success: boolean; data: ShiftAssignment[] }> => {
    const res = await api.get('/shifts/assignments', { params });
    return res.data;
  },

  createAssignment: async (data: Omit<ShiftAssignment, 'id' | 'created_at'>): Promise<{ success: boolean; message: string; data: ShiftAssignment }> => {
    const res = await api.post('/shifts/assignments', data);
    return res.data;
  },

  updateAssignment: async (id: number, data: Partial<ShiftAssignment>): Promise<{ success: boolean; message: string; data: ShiftAssignment }> => {
    const res = await api.put(`/shifts/assignments/${id}`, data);
    return res.data;
  },

  deleteAssignment: async (id: number): Promise<{ success: boolean; message: string }> => {
    const res = await api.delete(`/shifts/assignments/${id}`);
    return res.data;
  }
};
