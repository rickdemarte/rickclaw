export abstract class BaseTool {
  /** The specific function name exposed to the LLM */
  public abstract readonly name: string;
  
  /** Short description of what this tool does */
  public abstract readonly description: string;
  
  /** The expected schema (normally JSON Schema object) that the LLM needs to know to call it */
  public abstract readonly parameters: object;

  /**
   * Executes the tool's core logic with the LLM provided arguments.
   * Return a string that will be added to the context as an 'Observation'.
   */
  public abstract execute(args: any): Promise<string>;
}

export class ToolRegistry {
  private tools: Map<string, BaseTool> = new Map();

  public register(tool: BaseTool) {
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): BaseTool | undefined {
    return this.tools.get(name);
  }

  public getAll(): BaseTool[] {
    return Array.from(this.tools.values());
  }

  public clear() {
    this.tools.clear();
  }
}
