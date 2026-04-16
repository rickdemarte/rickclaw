"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MemoryManager = void 0;
const conversation_repository_1 = require("./conversation-repository");
const message_repository_1 = require("./message-repository");
const crypto_1 = __importDefault(require("crypto"));
class MemoryManager {
    conversationRepo;
    messageRepo;
    constructor() {
        this.conversationRepo = new conversation_repository_1.ConversationRepository();
        this.messageRepo = new message_repository_1.MessageRepository();
    }
    getOrCreateActiveConversation(userId, provider) {
        let conv = this.conversationRepo.getLatestByUserId(userId);
        if (!conv) {
            conv = {
                id: crypto_1.default.randomUUID(),
                user_id: userId,
                provider: provider
            };
            this.conversationRepo.create(conv);
        }
        else if (conv.provider !== provider) {
            // If we switched providers mid-session or something similar
            this.conversationRepo.updateProvider(conv.id, provider);
            conv.provider = provider;
        }
        return conv;
    }
    createNewSession(userId, provider) {
        const conv = {
            id: crypto_1.default.randomUUID(),
            user_id: userId,
            provider: provider
        };
        this.conversationRepo.create(conv);
        return conv;
    }
    getConversationHistoryContext(conversationId) {
        const limit = parseInt(process.env.MEMORY_WINDOW_SIZE || '20', 10);
        return this.messageRepo.getRecentContext(conversationId, limit);
    }
    addMessage(message) {
        if (message.content) {
            message.content = message.content.replace(/\u0000/g, '');
        }
        this.messageRepo.insert(message);
    }
    getHistory(userId) {
        return this.conversationRepo.getRecentByUserId(userId);
    }
    setActiveSession(userId, sessionId, provider) {
        const conv = this.conversationRepo.getByIdAndUserId(sessionId, userId);
        if (conv) {
            this.conversationRepo.updateProvider(sessionId, provider);
        }
    }
    getSummaryData(conversationId) {
        return this.conversationRepo.getSummaryData(conversationId);
    }
    updateSummary(conversationId, summary, keywords, msgCount) {
        this.conversationRepo.updateSummary(conversationId, summary, keywords, msgCount);
    }
    countUserMessages(conversationId) {
        return this.messageRepo.countUserMessages(conversationId);
    }
}
exports.MemoryManager = MemoryManager;
//# sourceMappingURL=memory-manager.js.map