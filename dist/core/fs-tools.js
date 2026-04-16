"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ListDirTool = exports.ReadFileTool = exports.DeletePathTool = exports.CreateDirTool = exports.WriteFileTool = void 0;
const tool_registry_1 = require("./tool-registry");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class WriteFileTool extends tool_registry_1.BaseTool {
    name = 'write_file';
    description = 'Creates or overwrites a file at a specific path with passed content. For creating skills, always use the path .agents/skills/<skill-name>/SKILL.md relative to the working directory.';
    parameters = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path from working directory. For skills, use: .agents/skills/<skill-name>/SKILL.md'
            },
            content: {
                type: 'string',
                description: 'The raw string content to write into the file.'
            }
        },
        required: ['path', 'content']
    };
    async execute(args) {
        try {
            if (!args.path || !args.content) {
                return "Error: write_file requires 'path' and 'content' arguments.";
            }
            const fullPath = path.resolve(process.cwd(), args.path);
            if (!fullPath.startsWith(process.cwd())) {
                return "Error: Cannot write to paths outside the working directory.";
            }
            const dir = path.dirname(fullPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
            fs.writeFileSync(fullPath, args.content, 'utf8');
            return `File successfully written to ${fullPath}`;
        }
        catch (err) {
            return `Error writing file: ${err.message}`;
        }
    }
}
exports.WriteFileTool = WriteFileTool;
class CreateDirTool extends tool_registry_1.BaseTool {
    name = 'create_dir';
    description = 'Creates a directory recursively if it does not exist. For creating skill directories, use: .agents/skills/<skill-name>/';
    parameters = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path from working directory. For skills, use: .agents/skills/<skill-name>/'
            }
        },
        required: ['path']
    };
    async execute(args) {
        try {
            if (!args.path) {
                return "Error: create_dir requires 'path' argument.";
            }
            const fullPath = path.resolve(process.cwd(), args.path);
            if (!fullPath.startsWith(process.cwd())) {
                return "Error: Cannot create directories outside the working directory.";
            }
            if (!fs.existsSync(fullPath)) {
                fs.mkdirSync(fullPath, { recursive: true });
                return `Directory created at ${fullPath}`;
            }
            return `Directory already exists at ${fullPath}`;
        }
        catch (err) {
            return `Error creating directory: ${err.message}`;
        }
    }
}
exports.CreateDirTool = CreateDirTool;
class DeletePathTool extends tool_registry_1.BaseTool {
    name = 'delete_path';
    description = 'Deletes a file or directory (recursively). Use this to remove skills from .agents/skills/<skill-name>/.';
    parameters = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to delete. For removing skills: .agents/skills/<skill-name>/'
            }
        },
        required: ['path']
    };
    async execute(args) {
        try {
            if (!args.path) {
                return "Error: delete_path requires 'path' argument.";
            }
            const fullPath = path.resolve(process.cwd(), args.path);
            // Safety: prevent deleting outside the working directory
            if (!fullPath.startsWith(process.cwd())) {
                return "Error: Cannot delete paths outside the working directory.";
            }
            if (!fs.existsSync(fullPath)) {
                return `Path does not exist: ${fullPath}`;
            }
            fs.rmSync(fullPath, { recursive: true, force: true });
            return `Successfully deleted: ${fullPath}`;
        }
        catch (err) {
            return `Error deleting path: ${err.message}`;
        }
    }
}
exports.DeletePathTool = DeletePathTool;
class ReadFileTool extends tool_registry_1.BaseTool {
    name = 'read_file';
    description = 'Reads and returns the content of a file. Useful for inspecting skills or verifying written content.';
    parameters = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to the file to read.'
            }
        },
        required: ['path']
    };
    async execute(args) {
        try {
            if (!args.path) {
                return "Error: read_file requires 'path' argument.";
            }
            const fullPath = path.resolve(process.cwd(), args.path);
            if (!fs.existsSync(fullPath)) {
                return `File not found: ${fullPath}`;
            }
            const stats = fs.statSync(fullPath);
            if (stats.isDirectory()) {
                return `Error: ${fullPath} is a directory, not a file. Use list_dir instead.`;
            }
            const content = fs.readFileSync(fullPath, 'utf8');
            if (content.length > 4000) {
                return content.substring(0, 4000) + '\n\n[... truncated, file is ' + content.length + ' chars]';
            }
            return content;
        }
        catch (err) {
            return `Error reading file: ${err.message}`;
        }
    }
}
exports.ReadFileTool = ReadFileTool;
class ListDirTool extends tool_registry_1.BaseTool {
    name = 'list_dir';
    description = 'Lists files and subdirectories in a directory. Useful for verifying skill structure or exploring the filesystem.';
    parameters = {
        type: 'object',
        properties: {
            path: {
                type: 'string',
                description: 'Relative path to the directory to list. Example: .agents/skills/'
            }
        },
        required: ['path']
    };
    async execute(args) {
        try {
            if (!args.path) {
                return "Error: list_dir requires 'path' argument.";
            }
            const fullPath = path.resolve(process.cwd(), args.path);
            if (!fs.existsSync(fullPath)) {
                return `Directory not found: ${fullPath}`;
            }
            const entries = fs.readdirSync(fullPath, { withFileTypes: true });
            const lines = entries.map(e => `${e.isDirectory() ? '📁' : '📄'} ${e.name}`);
            return lines.length > 0 ? lines.join('\n') : '(empty directory)';
        }
        catch (err) {
            return `Error listing directory: ${err.message}`;
        }
    }
}
exports.ListDirTool = ListDirTool;
//# sourceMappingURL=fs-tools.js.map