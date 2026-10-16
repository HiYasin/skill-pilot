import type { Agent } from "./types.ts";

/** Every skill is written once to this folder; agent folders link to it. */
export const CANONICAL_SKILLS_DIR = ".agents/skills";

/**
 * Supported agents. An agent is detected when `~/<folder>/skills` exists.
 * Adding an agent is one line here.
 */
export const AGENTS: Agent[] = [
  { id: "universal", name: "Universal (.agents)", folder: null },
  { id: "claude-code", name: "Claude Code", folder: ".claude" },
  { id: "cline", name: "Cline", folder: ".cline" },
  { id: "junie", name: "Junie", folder: ".junie" },
  { id: "codebuddy", name: "CodeBuddy", folder: ".codebuddy" },
  { id: "continue", name: "Continue", folder: ".continue" },
  { id: "kiro-cli", name: "Kiro", folder: ".kiro" },
];

export function findAgent(id: string): Agent | undefined {
  return AGENTS.find((a) => a.id === id);
}
