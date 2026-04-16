import { BaseTool } from './tool-registry';
export declare class WriteFileTool extends BaseTool {
    readonly name = "write_file";
    readonly description = "Creates or overwrites a file at a specific path with passed content. For creating skills, always use the path .agents/skills/<skill-name>/SKILL.md relative to the working directory.";
    readonly parameters: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
            content: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(args: any): Promise<string>;
}
export declare class CreateDirTool extends BaseTool {
    readonly name = "create_dir";
    readonly description = "Creates a directory recursively if it does not exist. For creating skill directories, use: .agents/skills/<skill-name>/";
    readonly parameters: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(args: any): Promise<string>;
}
export declare class DeletePathTool extends BaseTool {
    readonly name = "delete_path";
    readonly description = "Deletes a file or directory (recursively). Use this to remove skills from .agents/skills/<skill-name>/.";
    readonly parameters: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(args: any): Promise<string>;
}
export declare class ReadFileTool extends BaseTool {
    readonly name = "read_file";
    readonly description = "Reads and returns the content of a file. Useful for inspecting skills or verifying written content.";
    readonly parameters: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(args: any): Promise<string>;
}
export declare class ListDirTool extends BaseTool {
    readonly name = "list_dir";
    readonly description = "Lists files and subdirectories in a directory. Useful for verifying skill structure or exploring the filesystem.";
    readonly parameters: {
        type: string;
        properties: {
            path: {
                type: string;
                description: string;
            };
        };
        required: string[];
    };
    execute(args: any): Promise<string>;
}
//# sourceMappingURL=fs-tools.d.ts.map