// Represents the frontmatter + metadata loaded from memory
export interface ISkillMeta {
    folderName: string;
    name: string;
    description: string;
    filePath: string;
}

// Represents the full body
export interface ISkill extends ISkillMeta {
    content: string;
}
