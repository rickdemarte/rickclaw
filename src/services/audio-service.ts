import path from 'path';
import fs from 'fs';
import { EdgeTTS } from 'node-edge-tts';
import OpenAI from 'openai';
import { logger } from '../utils/logger';

export class AudioService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }

    // Generate text to speech using Edge TTS
    public async generateSpeech(text: string, outputPath: string): Promise<string> {
        const tts = new EdgeTTS({
            voice: 'pt-BR-ThalitaNeural', // high quality Portuguese voice
            lang: 'pt-BR'
        });
        await tts.ttsPromise(text, outputPath);
        return outputPath;
    }

    // Transcribe voice using OpenAI Whisper API (supports pt-BR natively)
    public async transcribeVoice(audioPath: string): Promise<string> {
        logger.info(`[AudioService] Transcribing ${audioPath} via OpenAI Whisper API...`);

        try {
            const transcription = await this.openai.audio.transcriptions.create({
                file: fs.createReadStream(audioPath),
                model: 'whisper-1',
                language: 'pt',
                response_format: 'text'
            });

            const text = (typeof transcription === 'string' ? transcription : (transcription as any).text || '').trim();
            logger.info(`[AudioService] Transcribed: ${text}`);
            return text;
        } catch (err: any) {
            logger.error(`[AudioService] Whisper API error: ${err.message}`);
            throw new Error(`Failed to transcribe audio: ${err.message}`);
        }
    }
}
