export declare class AudioService {
    private openai;
    constructor();
    generateSpeech(text: string, outputPath: string): Promise<string>;
    transcribeVoice(audioPath: string): Promise<string>;
}
//# sourceMappingURL=audio-service.d.ts.map