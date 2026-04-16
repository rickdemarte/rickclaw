import { IProvider } from './provider-interface';
import { ToolRegistry } from './tool-registry';
import { IMessage, ModelTier } from '../types';
import { UsageTracker } from '../services/usage-tracker';
export declare class AgentLoop {
    private provider;
    private toolRegistry;
    private usageTracker;
    private tier;
    private maxIterations;
    constructor(provider: IProvider, toolRegistry: ToolRegistry, usageTracker: UsageTracker, tier: ModelTier);
    /**
     * Runs the ReAct loop until a final answer is reached or max loops are exhausted.
     */
    run(systemPrompt: string, memoryContext: IMessage[], newUserInput: string, conversationId: string): Promise<IMessage[]>;
}
//# sourceMappingURL=agent-loop.d.ts.map