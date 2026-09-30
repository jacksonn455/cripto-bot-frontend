import { z } from "zod";

/** ai.types AGENT_KEYS — the backend's specialized analysis agents. */
export const AGENT_KEYS = ["performance-analyst", "trade-reviewer", "signal-explainer", "risk-analyst", "market-analyst"] as const;
export type AgentKey = (typeof AGENT_KEYS)[number];

/** GET /ai/status. */
export const aiStatusSchema = z.object({
  enabled: z.boolean(),
  configured: z.boolean(),
  /** Why the agents can't run (never contains the key); absent when they can. */
  reason: z.string().nullish(),
  model: z.string(),
  tracingEnabled: z.boolean(),
  agents: z.array(z.object({ key: z.string(), name: z.string(), description: z.string(), tools: z.array(z.string()) })),
});
export type AiStatus = z.infer<typeof aiStatusSchema>;

/** ai.types AnalysisOutput — structured answer of every agent (advisory only). */
export const analysisOutputSchema = z.object({
  summary: z.string(),
  findings: z.array(z.object({ title: z.string(), detail: z.string(), severity: z.enum(["info", "warning", "critical"]) })),
  recommendations: z.array(z.object({ action: z.string(), rationale: z.string(), requiresBacktest: z.boolean() })),
  confidence: z.enum(["low", "medium", "high"]),
  dataUsed: z.array(z.string()),
});
export type AnalysisOutput = z.infer<typeof analysisOutputSchema>;

/** POST /ai/agents/:agent/run. */
export const agentRunResultSchema = z.object({
  agent: z.string(),
  model: z.string(),
  output: analysisOutputSchema,
  usage: z.object({ requests: z.number(), inputTokens: z.number(), outputTokens: z.number(), totalTokens: z.number() }),
  durationMs: z.number(),
  advisoryOnly: z.literal(true),
});
export type AgentRunResult = z.infer<typeof agentRunResultSchema>;

/** RunAgentDto. */
export interface AgentRunInput {
  question?: string;
  symbol?: string;
  mode?: "BACKTEST" | "PAPER" | "LIVE";
  from?: string;
  to?: string;
}
