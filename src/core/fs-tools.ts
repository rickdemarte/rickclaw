import { BaseTool } from './tool-registry';
import * as fs from 'fs';
import * as path from 'path';

export class WriteFileTool extends BaseTool {
  public readonly name = 'write_file';
  public readonly description = 'Creates or overwrites a file at a specific path with passed content. For creating skills, always use the path .agents/skills/<skill-name>/SKILL.md relative to the working directory.';
  
  public readonly parameters = {
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

  public async execute(args: any): Promise<string> {
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
    } catch (err: any) {
      return `Error writing file: ${err.message}`;
    }
  }
}

export class CreateDirTool extends BaseTool {
  public readonly name = 'create_dir';
  public readonly description = 'Creates a directory recursively if it does not exist. For creating skill directories, use: .agents/skills/<skill-name>/';
  
  public readonly parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path from working directory. For skills, use: .agents/skills/<skill-name>/'
      }
    },
    required: ['path']
  };

  public async execute(args: any): Promise<string> {
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
    } catch (err: any) {
      return `Error creating directory: ${err.message}`;
    }
  }
}

export class DeletePathTool extends BaseTool {
  public readonly name = 'delete_path';
  public readonly description = 'Deletes a file or directory (recursively). Use this to remove skills from .agents/skills/<skill-name>/.';
  
  public readonly parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to delete. For removing skills: .agents/skills/<skill-name>/'
      }
    },
    required: ['path']
  };

  public async execute(args: any): Promise<string> {
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
    } catch (err: any) {
      return `Error deleting path: ${err.message}`;
    }
  }
}

export class ReadFileTool extends BaseTool {
  public readonly name = 'read_file';
  public readonly description = 'Reads and returns the content of a file. Useful for inspecting skills or verifying written content.';
  
  public readonly parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file to read.'
      }
    },
    required: ['path']
  };

  public async execute(args: any): Promise<string> {
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
    } catch (err: any) {
      return `Error reading file: ${err.message}`;
    }
  }
}

export class ListDirTool extends BaseTool {
  public readonly name = 'list_dir';
  public readonly description = 'Lists files and subdirectories in a directory. Useful for verifying skill structure or exploring the filesystem.';
  
  public readonly parameters = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the directory to list. Example: .agents/skills/'
      }
    },
    required: ['path']
  };

  public async execute(args: any): Promise<string> {
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
    } catch (err: any) {
      return `Error listing directory: ${err.message}`;
    }
  }
}
