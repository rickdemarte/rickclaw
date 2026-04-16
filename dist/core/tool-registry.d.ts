export declare abstract class BaseTool {
    /** The specific function name exposed to the LLM */
    abstract readonly name: string;
    /** Short description of what this tool does */
    abstract readonly description: string;
    /** The expected schema (normally JSON Schema object) that the LLM needs to know to call it */
    abstract readonly parameters: object;
    /**
     * Executes the tool's core logic with the LLM provided arguments.
     * Return a string that will be added to the context as an 'Observation'.
     */
    abstract execute(args: any): Promise<string>;
}
export declare class ToolRegistry {
    private tools;
    register(tool: BaseTool): void;
    getTool(name: string): BaseTool | undefined;
    getAll(): BaseTool[];
    clear(): void;
}
//# sourceMappingURL=tool-registry.d.ts.map