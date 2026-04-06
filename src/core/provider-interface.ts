import { IMessage, TokenUsage } from '../types';
import { BaseTool } from './tool-registry';

// Generic Tool Call structure used when the LLM decides to call a function
export interface ToolCall {
  id: string;
  name: string;
  args: any;
}

// Provider Response can either be a final text answer or a tool call request
export interface ProviderResponse {
  text?: string;
  toolCalls?: ToolCall[];
  usage?: TokenUsage;
}

export interface IProvider {
  /**
   * Generates a coherent response based on the conversation history and currently available tools.
   * @param systemPrompt The instruction set and current skills documentation
   * @param history The recent conversation window
   * @param tools The registered list of tools
   */
  generateResponse(
    systemPrompt: string,
    history: IMessage[],
    tools: BaseTool[]
  ): Promise<ProviderResponse>;
}
