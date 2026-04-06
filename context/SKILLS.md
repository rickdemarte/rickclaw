# 🧩 Sistema de Skills

## O que são Skills
Skills são documentos de instrução (NÃO são tools/funções chamáveis). Cada skill é um arquivo `SKILL.md` com instruções que são injetadas no system prompt quando o intent do usuário é compatível.

**⚠️ REGRA CRUCIAL: Skills NÃO são tools. Você NÃO pode chamar uma skill como função (ex: NÃO faça function call para "telegram-send-skill"). Skills são apenas texto de contexto. As únicas tools que você pode chamar são: write_file, create_dir, delete_path, read_file e list_dir.**

## Localização
- **Diretório de skills**: `.agents/skills/`
- Cada skill fica em sua própria pasta: `.agents/skills/<nome-da-skill>/SKILL.md`
- O diretório é montado como volume Docker — skills persistem entre rebuilds

## Estrutura de uma Skill
```
.agents/skills/
└── minha-skill/
    └── SKILL.md        ← Arquivo obrigatório
```

### Formato do SKILL.md
O arquivo deve ter um **frontmatter YAML** no topo com metadados, seguido do conteúdo em Markdown:

```markdown
---
name: Nome da Skill
description: Descrição curta do que esta skill faz (usada para roteamento de intent)
---

# Instruções da Skill

Aqui vai o conteúdo completo com as instruções que o RickClaw deve seguir
quando esta skill for ativada pelo roteador de intent.
```

**Campos obrigatórios do frontmatter:**
- `name`: Nome identificador da skill
- `description`: Descrição usada pelo SkillRouter para decidir se esta skill é relevante para o input do usuário

## Como o Roteamento Funciona
1. O usuário envia uma mensagem
2. O `SkillRouter` recebe o input + lista de skills disponíveis (nome + descrição)
3. O LLM classifica o intent e retorna o `folderName` da skill mais adequada
4. Se houver match, o conteúdo do `SKILL.md` (sem frontmatter) é injetado no system prompt
5. Se não houver match, o RickClaw responde com seu conhecimento geral

## Hot-Reload
- Skills são lidas do filesystem **a cada mensagem** — não precisa reiniciar o bot
- Para adicionar uma skill: basta criar a pasta e o `SKILL.md`
- Para remover: basta deletar a pasta
- Para atualizar: edite o `SKILL.md` e a próxima mensagem já usará a versão nova

## Criando Skills Autonomamente
O RickClaw possui as tools `write_file` e `create_dir`. Quando o usuário solicitar a criação de uma nova skill, o agente **DEVE**:
1. Usar `create_dir` com o path: `.agents/skills/<nome-da-skill>/`
2. Usar `write_file` com o path: `.agents/skills/<nome-da-skill>/SKILL.md` e conteúdo com frontmatter válido
3. Confirmar ao usuário que a skill foi criada e já está disponível

**⚠️ REGRA CRÍTICA**: O path SEMPRE deve começar com `.agents/skills/`. NUNCA criar skills em `/app/`, na raiz, ou em qualquer outro diretório. Exemplo correto:
- `create_dir` → path: `.agents/skills/minha-skill/`
- `write_file` → path: `.agents/skills/minha-skill/SKILL.md`

## Skills Instaladas Atualmente
As skills disponíveis são carregadas dinamicamente do diretório `.agents/skills/`. Não é necessário listá-las aqui — o sistema as descobre automaticamente.
