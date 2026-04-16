import { IMessage } from '../types';
export declare class MessageRepository {
    private db;
    insert(message: IMessage): void;
    getRecentContext(conversationId: string, limit: number): IMessage[];
    getAllByConversationId(conversationId: string): IMessage[];
    /** Conta mensagens do usuario nesta conversa */
    countUserMessages(conversationId: string): number;
}
//# sourceMappingURL=message-repository.d.ts.map