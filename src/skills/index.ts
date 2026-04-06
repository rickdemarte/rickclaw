import { SkillLoader } from "./skill-loader";
import { SkillRouter } from "./skill-router";
import { AgentController } from "../core/agent-controller";

// The integration piece for Phase 4 or inside the AgentController 
// is usually handled by `AgentController` itself loading the skills.
// We'll export the loader so AgentController can import it later.
export { SkillLoader, SkillRouter };
