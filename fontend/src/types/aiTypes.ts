// fontend/src/types/aiTypes.ts

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  tools_used?: string[];
}

export interface AIChatResponse {
  success: boolean;
  reply: string;
  session_id: string;
  tools_used?: string[];
  message?: string;
}

export interface AISuggestion {
  icon: string;
  text: string;
}

export interface AIChatSession {
  session_id: string;
  started_at: string;
  last_msg: string;
  message_count: number;
}
