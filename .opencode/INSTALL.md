# Installing SonarQube Plugin for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed
- [SonarQube CLI](https://cli.sonarqube.com/) (`sonar`) installed
- A container runtime (Docker, Podman, or Nerdctl) for the MCP server
- A SonarQube account (Cloud, Server, or Community Build)

## Installation

Add the plugin to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["sonarqube@git+https://github.com/SonarSource/sonarqube-agent-plugins.git"]
}
```

Restart OpenCode. The plugin automatically registers all 9 SonarQube skills and configures the MCP server from the shared `mcp.json`.

## Setup

After installation, load the setup skill:

```
Use the skill tool to load sonar-integrate
```

This walks you through installing/updating `sonarqube-cli`, authenticating, and verifying everything is wired up.

Or authenticate manually:

```bash
# SonarQube Cloud (EU)
sonar auth login -o <your-org-key>

# SonarQube Cloud (US)
sonar auth login -o <your-org-key> -s https://sonarqube.us

# Self-hosted SonarQube Server
sonar auth login -s <your-server-url>
```

Add a `sonar-project.properties` file to your project root for automatic project key resolution:

```properties
sonar.projectKey=my-project-key
```

## Verify

```bash
sonar auth status
```

Then ask OpenCode naturally: "list my SonarQube issues" or "check my quality gate" — it will use the appropriate skill.

## Available Skills

Use OpenCode's `skill` tool to load any of these:

| Skill | Purpose |
|-------|---------|
| `sonar-integrate` | Install CLI, authenticate, wire up integration |
| `sonar-list-projects` | List available SonarQube projects |
| `sonar-list-issues` | Search and filter project issues |
| `sonar-fix-issue` | Fix a specific issue by rule key and location |
| `sonar-quality-gate` | Check project quality gate status |
| `sonar-analyze` | Run analysis on a file or project |
| `sonar-coverage` | Check test coverage metrics |
| `sonar-duplication` | Check code duplication |
| `sonar-dependency-risks` | Check dependency risks |

Or ask naturally: "show open SonarQube findings", "check my test coverage", "analyze this file for issues".

## Updating

OpenCode installs via a git-backed package spec. If updates don't appear after restart, clear OpenCode's package cache or reinstall:

```bash
rm -rf ~/.cache/opencode/packages/sonarqube*
```

## Troubleshooting

### Plugin not loading

1. Restart OpenCode
2. Verify `opencode.json` has the `sonarqube@git+https://...` plugin line
3. Make sure you're running a recent version of OpenCode

### MCP server not starting

1. Verify `sonar` is installed and authenticated: `sonar auth status`
2. Ensure a container runtime (Docker/Podman/Nerdctl) is running
3. Check that `sonar run mcp` works in a terminal
4. The server starts on demand when MCP tools are first used

### Skills not found

Use the `skill` tool to list available skills and verify `sonarqube/` prefixed skills appear.

### Tool mapping

SonarQube skills reference tools that may not exist in OpenCode. The plugin provides automatic tool mapping:
- `Bash(sonar:*)` → use `bash` tool
- `mcp__sonarqube__*` → SonarQube MCP tools (prefixed `sonarqube_`)
- Slash commands `/sonarqube:*` → load the corresponding skill with the `skill` tool
