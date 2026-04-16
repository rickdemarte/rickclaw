"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = void 0;
const fs_1 = __importDefault(require("fs"));
const node_edge_tts_1 = require("node-edge-tts");
const openai_1 = __importDefault(require("openai"));
const logger_1 = require("../utils/logger");
class AudioService {
    openai;
    constructor() {
        this.openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
    }
    // Generate text to speech using Edge TTS
    async generateSpeech(text, outputPath) {
        const tts = new node_edge_tts_1.EdgeTTS({
            voice: 'pt-BR-ThalitaNeural', // high quality Portuguese voice
            lang: 'pt-BR'
        });
        await tts.ttsPromise(text, outputPath);
        return outputPath;
    }
    // Transcribe voice using OpenAI Whisper API (supports pt-BR natively)
    async transcribeVoice(audioPath) {
        logger_1.logger.info(`[AudioService] Transcribing ${audioPath} via OpenAI Whisper API...`);
        try {
            const transcription = await this.openai.audio.transcriptions.create({
                file: fs_1.default.createReadStream(audioPath),
                model: 'whisper-1',
                language: 'pt',
                response_format: 'text'
            });
            const text = (typeof transcription === 'string' ? transcription : transcription.text || '').trim();
            logger_1.logger.info(`[AudioService] Transcribed: ${text}`);
            return text;
        }
        catch (err) {
            logger_1.logger.error(`[AudioService] Whisper API error: ${err.message}`);
            throw new Error(`Failed to transcribe audio: ${err.message}`);
        }
    }
}
exports.AudioService = AudioService;
//# sourceMappingURL=audio-service.js.map