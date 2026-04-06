import { BaseTool } from './tool-registry';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

export class RunCommandTool extends BaseTool {
  public readonly name = 'run_command';
  public readonly description = 'Executes a bash shell command within the Docker container. Useful for running Python scripts directly.';

  public readonly parameters = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'The shell command to execute. Ex: python3 .agents/skills/email-ses-skill/scripts/send_email.py'
      }
    },
    required: ['command']
  };

  public async execute(args: any): Promise<string> {
    try {
      if (!args.command) {
        return 'Error: run_command requires "command" argument.';
      }

      // Execute command with a timeout so it doesn't hang the loop
      const { stdout, stderr } = await execPromise(args.command, { timeout: 15000, maxBuffer: 1024 * 1024 });

      let result = '';
      if (stdout) result += `STDOUT:\n${stdout}\n`;
      if (stderr) result += `STDERR:\n${stderr}\n`;

      return result.trim() || 'Command executed successfully (no output).';
    } catch (err: any) {
      if (err.killed) {
         return `Error: Command timed out after 15 seconds.`;
      }
      let errorMsg = `Command failed with exit code ${err.code}\n`;
      if (err.stdout) errorMsg += `STDOUT:\n${err.stdout}\n`;
      if (err.stderr) errorMsg += `STDERR:\n${err.stderr}\n`;
      
      return errorMsg;
    }
  }
}
