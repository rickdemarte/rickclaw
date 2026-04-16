import { IConversation, IMessage } from '../types';
export declare class MemoryManager {
    private conversationRepo;
    private messageRepo;
    constructor();
    getOrCreateActiveConversation(userId: string, provider: string): IConversation;
    createNewSession(userId: string, provider: string): IConversation;
    getConversationHistoryContext(conversationId: string): IMessage[];
    addMessage(message: IMessage): void;
    getHistory(userId: string): IConversation[];
    setActiveSession(userId: string, sessionId: string, provider: string): void;
    getSummaryData(conversationId: string): {
        session_summary: string | null;
        session_keywords: string | null;
        summary_msg_count: number;
    } | undefined;
    updateSummary(conversationId: string, summary: string, keywords: string, msgCount: number): void;
    countUserMessages(conversationId: string): number;
}
//# sourceMappingURL=memory-manager.d.ts.map