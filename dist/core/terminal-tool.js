"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RunCommandTool = void 0;
const tool_registry_1 = require("./tool-registry");
const child_process_1 = require("child_process");
const util_1 = __importDefault(require("util"));
const execPromise = util_1.default.promisify(child_process_1.exec);
class RunCommandTool extends tool_registry_1.BaseTool {
    name = 'run_command';
    description = 'Executes a bash shell command within the Docker container. Useful for running Python scripts directly.';
    parameters = {
        type: 'object',
        properties: {
            command: {
                type: 'string',
                description: 'The shell command to execute. Ex: python3 .agents/skills/email-ses-skill/scripts/send_email.py'
            }
        },
        required: ['command']
    };
    async execute(args) {
        try {
            if (!args.command) {
                return 'Error: run_command requires "command" argument.';
            }
            // Execute command with a timeout so it doesn't hang the loop
            const { stdout, stderr } = await execPromise(args.command, { timeout: 15000, maxBuffer: 1024 * 1024 });
            let result = '';
            if (stdout)
                result += `STDOUT:\n${stdout}\n`;
            if (stderr)
                result += `STDERR:\n${stderr}\n`;
            return result.trim() || 'Command executed successfully (no output).';
        }
        catch (err) {
            if (err.killed) {
                return `Error: Command timed out after 15 seconds.`;
            }
            let errorMsg = `Command failed with exit code ${err.code}\n`;
            if (err.stdout)
                errorMsg += `STDOUT:\n${err.stdout}\n`;
            if (err.stderr)
                errorMsg += `STDERR:\n${err.stderr}\n`;
            return errorMsg;
        }
    }
}
exports.RunCommandTool = RunCommandTool;
//# sourceMappingURL=terminal-tool.js.map