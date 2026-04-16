import { IConversation } from '../types';
export declare class ConversationRepository {
    private db;
    getById(id: string): IConversation | undefined;
    getByUserId(userId: string): IConversation[];
    getLatestByUserId(userId: string): IConversation | undefined;
    create(conversation: IConversation): void;
    updateProvider(id: string, provider: string): void;
    getRecentByUserId(userId: string, limit?: number): IConversation[];
    getByIdAndUserId(id: string, userId: string): IConversation | undefined;
    updateSummary(id: string, summary: string, keywords: string, msgCount: number): void;
    getSummaryData(id: string): {
        session_summary: string | null;
        session_keywords: string | null;
        summary_msg_count: number;
    } | undefined;
}
//# sourceMappingURL=conversation-repository.d.ts.map