import { ConversationRepository } from './conversation-repository';
import { MessageRepository } from './message-repository';
import { IConversation, IMessage } from '../types';
import crypto from 'crypto';

export class MemoryManager {
  private conversationRepo: ConversationRepository;
  private messageRepo: MessageRepository;
  
  constructor() {
    this.conversationRepo = new ConversationRepository();
    this.messageRepo = new MessageRepository();
  }

  public getOrCreateActiveConversation(userId: string, provider: string): IConversation {
    let conv = this.conversationRepo.getLatestByUserId(userId);
    if (!conv) {
      conv = {
        id: crypto.randomUUID(),
        user_id: userId,
        provider: provider
      };
      this.conversationRepo.create(conv);
    } else if (conv.provider !== provider) {
      // If we switched providers mid-session or something similar
      this.conversationRepo.updateProvider(conv.id, provider);
      conv.provider = provider;
    }
    return conv;
  }

  public createNewSession(userId: string, provider: string): IConversation {
    const conv = {
      id: crypto.randomUUID(),
      user_id: userId,
      provider: provider
    };
    this.conversationRepo.create(conv);
    return conv;
  }

  public getConversationHistoryContext(conversationId: string): IMessage[] {
    const limit = parseInt(process.env.MEMORY_WINDOW_SIZE || '20', 10);
    return this.messageRepo.getRecentContext(conversationId, limit);
  }

  public addMessage(message: IMessage): void {
    if (message.content) {
       message.content = message.content.replace(/\u0000/g, '');
    }
    this.messageRepo.insert(message);
  }

  public getHistory(userId: string): IConversation[] {
    return this.conversationRepo.getRecentByUserId(userId);
  }

  public setActiveSession(userId: string, sessionId: string, provider: string): void {
     const conv = this.conversationRepo.getByIdAndUserId(sessionId, userId);
     if (conv) {
         this.conversationRepo.updateProvider(sessionId, provider);
     }
  }

  public getSummaryData(conversationId: string) {
    return this.conversationRepo.getSummaryData(conversationId);
  }

  public updateSummary(conversationId: string, summary: string, keywords: string, msgCount: number): void {
    this.conversationRepo.updateSummary(conversationId, summary, keywords, msgCount);
  }

  public countUserMessages(conversationId: string): number {
    return this.messageRepo.countUserMessages(conversationId);
  }
}
