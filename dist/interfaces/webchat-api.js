"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebChatAPI = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const child_process_1 = require("child_process");
const user_repository_1 = require("../persistence/user-repository");
const provider_factory_1 = require("../core/provider-factory");
const database_1 = require("../persistence/database");
const logger_1 = require("../utils/logger");
class WebChatAPI {
    controller;
    app = (0, express_1.default)();
    userRepo = new user_repository_1.UserRepository();
    /**
     * JWT secret key for signing/verifying tokens.
     * Generated fresh per process if no env var is set — this means tokens
     * invalidate on restart (acceptable for a local personal agent).
     * Set JWT_SECRET in .env for persistent sessions across restarts.
     */
    jwtSecret;
    telegramHandler = null;
    constructor(controller) {
        this.controller = controller;
        this.jwtSecret = process.env.JWT_SECRET || crypto_1.default.randomUUID();
        // --- CORS: Restrict to localhost origins only ---
        this.app.use((0, cors_1.default)({
            origin: [
                'http://localhost:3000',
                'http://127.0.0.1:3000',
                `http://localhost:${process.env.PORT || 3000}`,
                `http://127.0.0.1:${process.env.PORT || 3000}`
            ],
            credentials: true
        }));
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.static(path_1.default.join(process.cwd(), 'public')));
        // --- Rate Limiting: 30 req/min on API routes ---
        const apiLimiter = (0, express_rate_limit_1.default)({
            windowMs: 60 * 1000,
            max: 30,
            standardHeaders: true,
            legacyHeaders: false,
            message: { error: 'Too many requests. Try again in a minute.' }
        });
        this.app.use('/api/', apiLimiter);
        this.setupRoutes();
    }
    /**
     * Extracts and verifies the JWT from the Authorization header.
     * Returns the decoded payload or null if invalid/missing.
     */
    verifyToken(req) {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split(' ')[1];
        if (!token)
            return null;
        try {
            return jsonwebtoken_1.default.verify(token, this.jwtSecret);
        }
        catch {
            return null;
        }
    }
    setTelegramHandler(handler) {
        this.telegramHandler = handler;
    }
    setupRoutes() {
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 0. Health Check — no auth, outside rate limiter
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.app.get('/health', (_req, res) => {
            let dbStatus = 'ok';
            try {
                const db = database_1.DbConnection.getInstance();
                const result = db.prepare('SELECT 1 AS ok').get();
                if (!result || result.ok !== 1)
                    dbStatus = 'error';
            }
            catch {
                dbStatus = 'error';
            }
            const telegramStatus = this.telegramHandler
                ? (this.telegramHandler.isRunning() ? 'running' : 'stopped')
                : 'not_configured';
            const providers = provider_factory_1.ProviderFactory.getProvidersStatus();
            const defaultProvider = process.env.DEFAULT_PROVIDER || 'gemini';
            const defaultConfigured = providers.find(p => p.name === defaultProvider)?.configured ?? false;
            const healthy = dbStatus === 'ok' && defaultConfigured;
            res.status(healthy ? 200 : 503).json({
                status: healthy ? 'ok' : 'degraded',
                uptime: Math.floor(process.uptime()),
                timestamp: new Date().toISOString(),
                database: dbStatus,
                telegram: telegramStatus,
                providers: Object.fromEntries(providers.map(p => [p.name, p.configured ? 'configured' : 'missing_key'])),
                defaultProvider,
            });
        });
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 0b. Status Page — visual HTML dashboard for /health
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.app.get('/status', (_req, res) => {
            res.sendFile(path_1.default.join(process.cwd(), 'public', 'status.html'));
        });
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 1. Auth Endpoint — Returns a signed JWT
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.app.post('/api/auth', async (req, res) => {
            const { username, password } = req.body;
            if (!username || !password) {
                return res.status(400).json({ error: "Missing credentials" });
            }
            const user = this.userRepo.getByUsername(username);
            if (!user) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            const valid = await bcrypt_1.default.compare(password, user.password_hash);
            if (!valid) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            // Sign JWT with 7-day expiration
            const token = jsonwebtoken_1.default.sign({ username: user.username }, this.jwtSecret, { expiresIn: '7d' });
            logger_1.logger.info(`[WebChatAPI] User '${username}' authenticated successfully.`);
            res.json({ token, message: "Logged in" });
        });
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 2. Chat Endpoint — POST + SSE (token in header)
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.app.post('/api/chat/stream', async (req, res) => {
            const payload = this.verifyToken(req);
            if (!payload) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const { text, uid } = req.body;
            if (!text) {
                return res.status(400).json({ error: "Missing text" });
            }
            const userId = uid || payload.username || 'admin-web';
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.write(`data: {"status": "thinking"}\n\n`);
            try {
                const answer = await this.controller.handleUserMessage(userId, text);
                res.write(`data: ${JSON.stringify({ chunk: answer })}\n\n`);
                res.write(`data: {"status": "done"}\n\n`);
            }
            catch (e) {
                logger_1.logger.error('[WebChatAPI] Failed to process message', e);
                res.write(`data: {"error": "Internal Agent Error"}\n\n`);
            }
            finally {
                res.end();
            }
        });
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 3. Clear Session Endpoint
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.app.post('/api/chat/clear', async (req, res) => {
            const payload = this.verifyToken(req);
            if (!payload) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const uid = req.body.uid || payload.username || 'admin-web';
            this.controller.clearMemory(uid);
            res.json({ message: "Session cleared" });
        });
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 4. Upload Document Endpoint
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        const upload = (0, multer_1.default)({ dest: 'tmp/', limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB
        this.app.post('/api/chat/upload', upload.single('file'), async (req, res) => {
            const payload = this.verifyToken(req);
            if (!payload) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const file = req.file;
            if (!file)
                return res.status(400).json({ error: "No file uploaded" });
            try {
                let extractedText = "";
                if (file.mimetype === 'application/pdf') {
                    const scriptPath = '.agents/skills/pdf-extractor-skill/scripts/extract_pdf.py';
                    const result = (0, child_process_1.execFileSync)('python3', [scriptPath, file.path]);
                    extractedText = result.toString();
                }
                else if (file.originalname.endsWith('.md') || file.originalname.endsWith('.txt')) {
                    extractedText = fs_1.default.readFileSync(file.path, 'utf8');
                }
                fs_1.default.unlinkSync(file.path);
                const prompt = `Arquivo anexado via Upload Web (${file.originalname}):\n\n${extractedText}\n\nUser Context: ${req.body.text || ''}`;
                const userId = payload.username || 'admin-web';
                const answer = await this.controller.handleUserMessage(userId, prompt);
                res.json({ reply: answer });
            }
            catch (err) {
                logger_1.logger.error("[WebChat Upload] Error:", err);
                res.status(500).json({ error: "Extrator de arquivos falhou." });
            }
        });
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 5. Download Export Endpoint
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.app.get('/api/files/download_tmp', (req, res) => {
            const payload = this.verifyToken(req);
            if (!payload) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const file = req.query.id;
            if (!file || file.includes('..') || file.includes('/')) {
                return res.status(400).json({ error: "Invalid file id" });
            }
            const filePath = path_1.default.join(process.cwd(), 'tmp', file);
            res.download(filePath);
        });
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 6. Cost Tracking Endpoint
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.app.get('/api/costs', (req, res) => {
            const payload = this.verifyToken(req);
            if (!payload) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            try {
                const costData = this.controller.getCostData();
                res.json(costData);
            }
            catch (err) {
                logger_1.logger.error('[WebChatAPI] Failed to fetch cost data:', err);
                res.status(500).json({ error: "Failed to fetch cost data" });
            }
        });
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        // 7. Change Password Endpoint
        // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
        this.app.post('/api/auth/change-password', async (req, res) => {
            const payload = this.verifyToken(req);
            if (!payload) {
                return res.status(401).json({ error: "Unauthorized" });
            }
            const { currentPassword, newPassword } = req.body;
            if (!currentPassword || !newPassword) {
                return res.status(400).json({ error: "Senha atual e nova senha sao obrigatorias." });
            }
            if (newPassword.length < 6) {
                return res.status(400).json({ error: "A nova senha deve ter pelo menos 6 caracteres." });
            }
            const user = this.userRepo.getByUsername(payload.username);
            if (!user) {
                return res.status(404).json({ error: "Usuario nao encontrado." });
            }
            const valid = await bcrypt_1.default.compare(currentPassword, user.password_hash);
            if (!valid) {
                return res.status(401).json({ error: "Senha atual incorreta." });
            }
            const newHash = await bcrypt_1.default.hash(newPassword, 10);
            this.userRepo.upsert(payload.username, newHash);
            logger_1.logger.info(`[WebChatAPI] Password changed for user '${payload.username}'.`);
            res.json({ message: "Senha alterada com sucesso." });
        });
    }
    start() {
        const port = process.env.PORT || 3000;
        // Bootstrap the admin user if it doesn't exist
        const adminPass = process.env.WEB_CHAT_PASSWORD;
        if (!adminPass) {
            logger_1.logger.warn('[WebChatAPI] WEB_CHAT_PASSWORD not set in .env. Admin account will NOT be created automatically.');
            logger_1.logger.warn('[WebChatAPI] To create an admin user, set WEB_CHAT_PASSWORD in .env and restart, or run: npm run reset-password');
        }
        else {
            const adminUser = process.env.WEB_CHAT_USERNAME || 'admin';
            const existing = this.userRepo.getByUsername(adminUser);
            if (!existing) {
                logger_1.logger.info(`[WebChatAPI] Bootstrapping user '${adminUser}' into SQLite...`);
                // Accept both pre-hashed bcrypt values and plaintext passwords
                const isBcryptHash = /^\$2[aby]?\$\d{1,2}\$.{53}$/.test(adminPass);
                const hash = isBcryptHash ? adminPass : bcrypt_1.default.hashSync(adminPass, 10);
                this.userRepo.upsert(adminUser, hash);
            }
        }
        return this.app.listen(port, () => {
            logger_1.logger.info(`[WebChatAPI] Local server listening on http://localhost:${port}`);
        });
    }
}
exports.WebChatAPI = WebChatAPI;
//# sourceMappingURL=webchat-api.js.map