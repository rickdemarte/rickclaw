import { BaseTool } from './tool-registry';
export declare class RunCommandTool extends BaseTool {
    readonly name = "run_command";
    readonly description = "Executes a bash shell command within the Docker container. Useful for running Python scripts directly.";
    readonly parameters: {
        type: string;
        properties: {
            command: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(args: any): Promise<string>;
}
//# sourceMappingURL=terminal-tool.d.ts.map