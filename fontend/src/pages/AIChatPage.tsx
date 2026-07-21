// frontend/src/pages/AIChatPage.tsx
import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { aiService } from '../services/aiService';
import { FEATURES } from '../config/config';
import Icon from '../components/Icon';
import type { ChatMessage, AISuggestion } from '../types/aiTypes';

export default function AIChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AISuggestion[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll xuống tin nhắn mới
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Load suggestions khi render lần đầu
  useEffect(() => {
    if (FEATURES.AI_ASSISTANT && suggestions.length === 0) {
      aiService.getSuggestions()
        .then(res => { if (res.success) setSuggestions(res.data); })
        .catch(() => {});
    }
    inputRef.current?.focus();
  }, [suggestions.length]);

  // Không render nếu feature bị tắt
  if (!FEATURES.AI_ASSISTANT) {
    return (
      <div className="flex flex-col items-center justify-center h-[calc(100vh-73px)] bg-gray-50">
        <div className="p-8 max-w-md text-center bg-white rounded-2xl shadow-sm border border-gray-100">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Icon name="smart_toy" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Tính năng AI đang tắt</h2>
          <p className="text-sm text-gray-500">
            Trợ lý AI hiện đã được cấu hình tắt trong hệ thống. Vui lòng kích hoạt trong file cấu hình để sử dụng.
          </p>
        </div>
      </div>
    );
  }

  // Gửi tin nhắn
  const sendMessage = async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;

    setInput('');
    setError(null);

    const userMsg: ChatMessage = { role: 'user', content: msg, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await aiService.chat(msg, messages, sessionId);
      if (res.success) {
        setSessionId(res.session_id);
        const aiMsg: ChatMessage = {
          role: 'assistant',
          content: res.reply,
          timestamp: Date.now(),
          tools_used: res.tools_used
        };
        setMessages(prev => [...prev, aiMsg]);
      } else {
        setError(res.message || 'Lỗi từ AI');
      }
    } catch (err: any) {
      const errMsg = err.response?.data?.message || err.message || 'Không thể kết nối AI';
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setError(null);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-73px)] bg-slate-50/50">
      {/* ── Toolbar / Subheader ── */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold">
            <Icon name="smart_toy" size={20} />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-gray-800">Trợ lý POS Assistant</h2>
            <p className="text-xs text-gray-400">Tối ưu hiệu suất và phân tích dữ liệu bán hàng</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-red-200 hover:bg-red-50 text-xs font-semibold text-gray-600 hover:text-red-600 transition"
              title="Khởi tạo lại cuộc trò chuyện mới"
            >
              <Icon name="refresh" size={14} />
              Làm mới chat
            </button>
          )}
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
            Online
          </span>
        </div>
      </div>

      {/* ── Chat Messages Stream ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        <div className="max-w-4xl mx-auto w-full">
          {/* Welcome Screen & Suggestions */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-150 mb-6">
                <Icon name="smart_toy" size={32} className="text-white" />
              </div>
              <h1 className="text-2xl font-extrabold text-gray-900 mb-2">Xin chào, tôi có thể giúp gì cho bạn?</h1>
              <p className="text-sm text-gray-500 max-w-md mb-8 leading-relaxed">
                Tôi có thể giúp bạn kiểm tra doanh thu, tra cứu tồn kho, tìm kiếm hóa đơn, phân tích ca làm việc hoặc trả lời các thông tin liên quan đến bán hàng.
              </p>

              {/* Suggestions Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl px-4">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s.text)}
                    className="flex items-center p-4 bg-white hover:bg-indigo-50/20 border border-gray-100 hover:border-indigo-100 rounded-2xl text-left transition duration-200 shadow-sm hover:shadow-md group"
                  >
                    <span className="text-sm font-semibold text-gray-700 group-hover:text-indigo-600 transition-colors">
                      {s.text}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Bubbles */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex items-start gap-4 mb-6 ${
                msg.role === 'user' ? 'flex-row-reverse' : ''
              }`}
            >
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white'
              }`}>
                <Icon name={msg.role === 'user' ? 'person' : 'smart_toy'} size={16} />
              </div>
              <div className={`flex flex-col max-w-[80%] ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}>
                <div className={`p-4 rounded-2xl shadow-sm border ${
                  msg.role === 'user'
                    ? 'bg-blue-600 border-blue-600 text-white rounded-tr-none'
                    : 'bg-white border-gray-100 text-gray-850 rounded-tl-none'
                }`}>
                  {msg.role === 'assistant' ? (
                    <div className="ai-page-markdown prose max-w-none text-sm leading-relaxed text-gray-800">
                      <ReactMarkdown>{msg.content}</ReactMarkdown>
                    </div>
                  ) : (
                    <span className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</span>
                  )}
                </div>
                <span className="text-[10px] text-gray-400 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          ))}

          {/* Typing Loading Indicator */}
          {loading && (
            <div className="flex items-start gap-4 mb-6">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                <Icon name="smart_toy" size={16} />
              </div>
              <div className="p-4 bg-white border border-gray-100 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1 px-5">
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-[ai-dot_1.4s_infinite_ease-in-out_0s]"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-[ai-dot_1.4s_infinite_ease-in-out_0.2s]"></span>
                <span className="w-2 h-2 rounded-full bg-indigo-400 animate-[ai-dot_1.4s_infinite_ease-in-out_0.4s]"></span>
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-4 mb-6">
              <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <Icon name="error_outline" size={16} />
              </div>
              <div className="p-3.5 bg-red-50 border border-red-100 rounded-2xl rounded-tl-none text-red-600 text-sm font-medium shadow-sm">
                {error}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* ── Input Box at Bottom ── */}
      <div className="bg-white border-t border-gray-150 p-4 shrink-0 shadow-[0_-4px_24px_rgba(0,0,0,0.02)]">
        <div className="max-w-4xl mx-auto w-full">
          <div className="flex items-end gap-3 p-2 pl-4 pr-2 bg-slate-50 border-2 border-slate-200 hover:border-indigo-100 focus-within:border-indigo-500 focus-within:bg-white rounded-2xl transition duration-200">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Nhập câu hỏi của bạn (ví dụ: 'Doanh thu hôm nay thế nào?', 'Có sản phẩm nào sắp hết hàng không?')..."
              disabled={loading}
              rows={1}
              className="flex-1 bg-transparent border-none outline-none resize-none text-sm text-gray-800 py-2.5 pr-2 leading-relaxed max-h-36 overflow-y-auto font-sans focus:ring-0 placeholder:text-gray-400"
              style={{ minHeight: '24px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = Math.min(target.scrollHeight, 144) + 'px';
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                input.trim() && !loading
                  ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-200'
                  : 'bg-gray-100 text-gray-400 cursor-default'
              }`}
            >
              <Icon name="arrow_upward" size={20} />
            </button>
          </div>
          <p className="text-[11px] text-gray-400 text-center mt-2.5">
            Trợ lý AI sử dụng dữ liệu bán hàng thực tế. Hãy xác nhận kỹ thông tin quan trọng trước khi đưa ra quyết định.
          </p>
        </div>
      </div>

      {/* Styles for Markdown Formatting */}
      <style>{`
        @keyframes ai-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
        .ai-page-markdown p { margin: 0 0 10px 0; }
        .ai-page-markdown p:last-child { margin-bottom: 0; }
        .ai-page-markdown ul, .ai-page-markdown ol { margin: 6px 0; padding-left: 20px; }
        .ai-page-markdown ul { list-style-type: disc; }
        .ai-page-markdown ol { list-style-type: decimal; }
        .ai-page-markdown li { margin: 3px 0; }
        .ai-page-markdown strong { font-weight: 700; color: #0f172a; }
        .ai-page-markdown table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 13px;
          background: #fff;
          border-radius: 8px;
          overflow: hidden;
          box-shadow: 0 1px 3px rgba(0,0,0,0.02);
          border: 1px solid #f1f5f9;
        }
        .ai-page-markdown th, .ai-page-markdown td {
          padding: 10px 12px;
          text-align: left;
          border-bottom: 1px solid #f1f5f9;
        }
        .ai-page-markdown th {
          font-weight: 600;
          color: #475569;
          background: #f8fafc;
          border-bottom: 2px solid #e2e8f0;
        }
        .ai-page-markdown tr:last-child td {
          border-bottom: none;
        }
        .ai-page-markdown code {
          background: #f1f5f9;
          padding: 2px 6px;
          border-radius: 6px;
          font-size: 12px;
          color: #6366f1;
          font-family: monospace;
        }
        .ai-page-markdown h1, .ai-page-markdown h2, .ai-page-markdown h3 {
          font-weight: 700;
          color: #1e293b;
          margin: 14px 0 8px;
        }
        .ai-page-markdown h1 { font-size: 16px; }
        .ai-page-markdown h2 { font-size: 15px; }
        .ai-page-markdown h3 { font-size: 14px; }
        .ai-page-markdown blockquote {
          border-left: 4px solid #6366f1;
          padding-left: 14px;
          margin: 12px 0;
          color: #64748b;
          font-style: italic;
          background: #f8fafc;
          padding-top: 6px;
          padding-bottom: 6px;
          border-radius: 0 8px 8px 0;
        }
      `}</style>
    </div>
  );
}
