import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import { AGENTS, findAgent } from "./catalog/agents.ts";
import type { Agent } from "./catalog/types.ts";

/** "universal" always, plus every agent whose `~/<folder>/skills` folder exists. */
export function detectAgents(home: string = homedir()): Agent[] {
  return AGENTS.filter((a) => a.folder === null || existsSync(join(home, a.folder, "skills")));
}

export interface AgentChoice {
  agents: Agent[];
  /** Names passed with `-a` that are not in the agent map. */
  unknown: string[];
}

/**
 * Agents to install for: the `-a` list when given, otherwise auto-detected.
 * "universal" is always included because the canonical copy is what agents link to.
 */
export function chooseAgents(requested: string[], home?: string): AgentChoice {
  if (requested.length === 0) return { agents: detectAgents(home), unknown: [] };

  const agents: Agent[] = [findAgent("universal")!];
  const unknown: string[] = [];
  for (const id of requested) {
    const agent = findAgent(id);
    if (!agent) unknown.push(id);
    else if (!agents.includes(agent)) agents.push(agent);
  }
  return { agents, unknown };
}
