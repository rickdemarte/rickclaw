export type Role = 'user' | 'assistant' | 'system' | 'tool';

export interface IMessage {
  id?: number;
  conversation_id: string;
  role: Role;
  content: string;
  created_at?: string;
  tool_call_id?: string;
  name?: string; // used for tool/function names
}

export interface IConversation {
  id: string;
  user_id: string;
  provider: string;
  session_summary?: string;
  session_keywords?: string;
  summary_msg_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface IUserAuth {
  id?: number;
  username: string;
  password_hash: string;
}

export type ModelTier = 'light' | 'default' | 'heavy';

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  model: string;
  provider: string;
}

export interface RoutingResult {
  type: 'static' | 'skill' | 'general' | 'command';
  value?: string;        // Static reply text, skill folder name or command name
  complexity: ModelTier;
  routerUsage?: TokenUsage;
}
