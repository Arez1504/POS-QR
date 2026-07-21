// fontend/src/services/aiService.ts
import api from './authService';  // Dùng chung axios instance có auto-attach JWT
import type { ChatMessage, AIChatResponse, AISuggestion } from '../types/aiTypes';

export const aiService = {
  /**
   * Gửi tin nhắn tới AI trợ lý
   */
  chat: async (message: string, history: ChatMessage[], sessionId?: string): Promise<AIChatResponse> => {
    const res = await api.post('/ai/chat', {
      message,
      history: history.map(m => ({ role: m.role, content: m.content })),
      session_id: sessionId
    });
    return res.data;
  },

  /**
   * Lấy danh sách gợi ý câu hỏi nhanh
   */
  getSuggestions: async (): Promise<{ success: boolean; data: AISuggestion[] }> => {
    const res = await api.get('/ai/suggestions');
    return res.data;
  },

  /**
   * Lấy lịch sử chat
   */
  getHistory: async (sessionId?: string) => {
    const url = sessionId ? `/ai/history?session_id=${sessionId}` : '/ai/history';
    const res = await api.get(url);
    return res.data;
  },

  /**
   * Phân tích tồn kho AI (dùng trong trang Báo cáo)
   */
  analyzeInventory: async (limit: number = 10): Promise<{
    success: boolean;
    analysis: string;
    data: any[];
    message?: string;
  }> => {
    const res = await api.post('/ai/inventory-analysis', { limit });
    return res.data;
  }
};
