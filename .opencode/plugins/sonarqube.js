/**
 * SonarQube plugin for OpenCode.ai
 *
 * Registers SonarQube skills, injects MCP server config (sourced from the
 * shared mcp.json), and provides bootstrap context so the agent knows about
 * available SonarQube tools.
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const extractAndStripFrontmatter = (content) => {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { frontmatter: {}, content };

  const frontmatterStr = match[1];
  const body = match[2];
  const frontmatter = {};

  for (const line of frontmatterStr.split('\n')) {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, '');
      frontmatter[key] = value;
    }
  }

  return { frontmatter, content: body };
};

// Read the shared mcp.json and convert to OpenCode's MCP config format.
// The shared format uses { command: "sonar", args: ["run", "mcp"] }
// while OpenCode uses { command: ["sonar", "run", "mcp"] }.
const loadMcpConfig = (repoRoot) => {
  const mcpPath = path.join(repoRoot, 'mcp.json');
  if (!fs.existsSync(mcpPath)) return { sonarqube: {} };

  try {
    const raw = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
    const servers = raw.mcpServers || {};
    const converted = {};
    for (const [name, cfg] of Object.entries(servers)) {
      const cmd = cfg.command ? [cfg.command, ...(cfg.args || [])] : [];
      converted[name] = {
        type: 'local',
        command: cmd,
        enabled: true,
      };
      if (cfg.env || cfg.environment) {
        converted[name].environment = cfg.env || cfg.environment;
      }
    }
    return converted;
  } catch {
    return { sonarqube: {} };
  }
};

const discoverSkills = (skillsDir) => {
  const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
  return entries
    .filter(d => d.isDirectory())
    .map(d => {
      const skillPath = path.join(skillsDir, d.name, 'SKILL.md');
      if (!fs.existsSync(skillPath)) return null;
      const raw = fs.readFileSync(skillPath, 'utf8');
      const { frontmatter } = extractAndStripFrontmatter(raw);
      return { name: frontmatter.name || d.name, description: frontmatter.description || '', path: d.name };
    })
    .filter(Boolean);
};

let _bootstrapCache = undefined;

export const SonarQubePlugin = async ({ client, directory }) => {
  const repoRoot = path.resolve(__dirname, '../..');
  const sonarSkillsDir = path.join(repoRoot, 'skills');

  const getBootstrapContent = () => {
    if (_bootstrapCache !== undefined) return _bootstrapCache;

    if (!fs.existsSync(sonarSkillsDir)) {
      _bootstrapCache = null;
      return null;
    }

    const skills = discoverSkills(sonarSkillsDir);

    const skillList = skills
      .map(s => `- **\`${s.name}\`** — ${s.description}`)
      .join('\n');

    _bootstrapCache = `<EXTREMELY_IMPORTANT>
SonarQube code quality and security integration is available through 9 specialized skills and MCP tools.

**Available SonarQube skills:**

${skillList}

**Tool Mapping for OpenCode:**
When SonarQube skills reference tools, substitute OpenCode equivalents:
- \`Bash(sonar:*)\` → Use the \`bash\` tool to run sonar CLI commands
- \`mcp__sonarqube__*\` → OpenCode names MCP tools as \`sonarqube_<toolname>\` (drop the \`mcp__\` prefix). The exact names depend on what the MCP server exposes.
- \`Read\` → OpenCode's \`read\` tool
- \`Grep\` → OpenCode's \`grep\` tool
- \`Edit\` → OpenCode's \`edit\` tool
- Slash commands like \`/sonarqube:sonar-integrate\` → Load the skill with the \`skill\` tool instead
- For \`sonar-integrate\` skill step 4: skip agent-specific CLI commands (\`sonar integrate claude\`, etc.) — the MCP config is already handled by this plugin.

**Getting started:** Load the \`sonar-integrate\` skill to set up the SonarQube CLI, authenticate, and configure the MCP server.
</EXTREMELY_IMPORTANT>`;

    return _bootstrapCache;
  };

  return {
    // Register skills path and inject MCP server config from shared mcp.json
    config: async (config) => {
      config.skills = config.skills || {};
      config.skills.paths = config.skills.paths || [];
      if (!config.skills.paths.includes(sonarSkillsDir)) {
        config.skills.paths.push(sonarSkillsDir);
      }

      // Inject MCP from shared config (idempotent — won't override existing)
      config.mcp = config.mcp || {};
      const mcpServers = loadMcpConfig(repoRoot);
      for (const [name, cfg] of Object.entries(mcpServers)) {
        if (!config.mcp[name] && cfg.command && cfg.command.length > 0) {
          config.mcp[name] = cfg;
        }
      }
    },

    // Inject bootstrap into the first user message of each session
    'experimental.chat.messages.transform': async (_input, output) => {
      const bootstrap = getBootstrapContent();
      if (!bootstrap || !output.messages.length) return;
      const firstUser = output.messages.find(m => m.info.role === 'user');
      if (!firstUser || !firstUser.parts.length) return;

      // Guard against double injection
      if (firstUser.parts.some(p => p.type === 'text' && p.text.includes('EXTREMELY_IMPORTANT'))) return;

      const ref = firstUser.parts[0];
      firstUser.parts.unshift({ ...ref, type: 'text', text: bootstrap });
    },
  };
};
