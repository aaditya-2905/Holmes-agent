export type ToolStatus = "running" | "success" | "error" | "no_data" | "approval" | "denied";

export interface ToolStep {
  kind: "tool";
  id: string;
  name: string;
  label?: string;
  status: ToolStatus;
  params?: Record<string, unknown>;
  invocation?: string;
  output?: string;
  error?: string;
  startedAt: number;
  endedAt?: number;
}

export interface ThoughtStep {
  kind: "thought";
  id: string;
  text: string;
}

export type Step = ToolStep | ThoughtStep;

export interface PendingApproval {
  tool_call_id: string;
  tool_name: string;
  description: string;
  params: Record<string, unknown>;
}

export type TurnStatus = "running" | "done" | "error" | "stopped" | "awaiting";

export interface Usage {
  promptTokens?: number;
  completionTokens?: number;
  cost?: number;
  contextUsed?: number;
  contextMax?: number;
}

export interface Turn {
  id: string;
  ask: string;
  steps: Step[];
  answer?: string;
  error?: string;
  approvals?: PendingApproval[];
  status: TurnStatus;
  startedAt: number;
  endedAt?: number;
  usage?: Usage;
}

export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  turns: Turn[];
  /** Server-side message list, sent back to continue the conversation. */
  history: unknown[] | null;
}

export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: number;
}

export interface ToolsetInfo {
  name: string;
  enabled: boolean;
  status: string;
  type?: string;
  tool_count?: number;
  error?: string;
}

export interface AgentInfo {
  version: string;
  models: string[];
  toolsets_summary?: { total: number; enabled: number; failed: number; disabled: number };
  toolsets?: ToolsetInfo[];
}
