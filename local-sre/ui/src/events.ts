import type { SSEEvent } from "./api";
import type { PendingApproval, Step, ToolStatus, ToolStep, Turn } from "./types";

export const uid = () => (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random()}`).slice(0, 36);

function mapStatus(s: unknown): ToolStatus {
  switch (s) {
    case "success":
      return "success";
    case "no_data":
      return "no_data";
    case "approval_required":
      return "approval";
    default:
      return "error";
  }
}

function patchTool(steps: Step[], id: string, patch: Partial<ToolStep>, fallbackName: string): Step[] {
  let found = false;
  const next = steps.map((s) => {
    if (s.kind !== "tool" || s.id !== id) return s;
    found = true;
    return { ...s, ...patch };
  });
  if (!found) next.push({ kind: "tool", id, name: fallbackName, status: "running", startedAt: Date.now(), ...patch });
  return next;
}

/** Prefer the provider's own message (e.g. which quota was hit) over Holmes' generic summary. */
function describeError(d: any): string {
  const text = d.message || d.msg || d.description || "The agent reported an error.";
  const reset = /X-RateLimit-Reset\\?"?\s*:\s*\\?"?(\d{10,13})/.exec(String(d.description ?? ""))?.[1];
  if (!reset) return text;
  const ms = reset.length > 10 ? Number(reset) : Number(reset) * 1000;
  return `${text} — resets ${new Date(ms).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}.`;
}

export interface Applied {
  turn: Turn;
  history?: unknown[];
}

/** Pure reducer: fold one server-sent event into the turn it belongs to. */
export function applyEvent(turn: Turn, ev: SSEEvent): Applied {
  const d = ev.data ?? {};
  switch (ev.event) {
    case "start_tool_calling": {
      if (turn.steps.some((s) => s.kind === "tool" && s.id === d.id)) return { turn };
      const step: ToolStep = { kind: "tool", id: d.id, name: d.tool_name, status: "running", startedAt: Date.now() };
      return { turn: { ...turn, steps: [...turn.steps, step] } };
    }
    case "tool_calling_result": {
      const r = d.result ?? {};
      const steps = patchTool(
        turn.steps,
        d.tool_call_id,
        {
          name: d.tool_name ?? d.name,
          label: d.description,
          status: mapStatus(r.status),
          params: r.params ?? undefined,
          invocation: r.invocation ?? undefined,
          output: typeof r.data === "string" ? r.data : r.data == null ? undefined : JSON.stringify(r.data, null, 2),
          error: r.error ?? undefined,
          endedAt: Date.now(),
        },
        d.tool_name ?? "tool",
      );
      return { turn: { ...turn, steps } };
    }
    case "ai_message": {
      const text = typeof d.content === "string" ? d.content.trim() : "";
      if (!text) return { turn };
      return { turn: { ...turn, steps: [...turn.steps, { kind: "thought", id: uid(), text }] } };
    }
    case "token_count": {
      const m = d.metadata ?? {};
      return {
        turn: { ...turn, usage: { ...turn.usage, contextUsed: m.tokens?.total_tokens, contextMax: m.max_tokens } },
      };
    }
    case "approval_required": {
      const pending: PendingApproval[] = d.pending_approvals ?? [];
      let steps = turn.steps;
      for (const p of pending) {
        steps = patchTool(steps, p.tool_call_id, { status: "approval", label: p.description, params: p.params }, p.tool_name);
      }
      return { turn: { ...turn, steps, approvals: pending, status: "awaiting" }, history: d.conversation_history };
    }
    case "ai_answer_end": {
      const m = d.metadata ?? {};
      const u = m.usage ?? {};
      const c = m.costs ?? {};
      return {
        turn: {
          ...turn,
          answer: d.analysis ?? "",
          status: "done",
          endedAt: Date.now(),
          usage: {
            ...turn.usage,
            promptTokens: u.prompt_tokens ?? c.prompt_tokens,
            completionTokens: u.completion_tokens ?? c.completion_tokens,
            cost: c.total_cost,
          },
        },
        history: d.conversation_history,
      };
    }
    case "error":
      return {
        turn: {
          ...turn,
          status: "error",
          error: describeError(d),
          steps: settleRunning(turn.steps, "Interrupted"),
          endedAt: Date.now(),
        },
      };
    default:
      return { turn };
  }
}

/** Mark tool rows still spinning as interrupted when a turn ends abnormally. */
export function settleRunning(steps: Step[], why: string): Step[] {
  return steps.map((s) =>
    s.kind === "tool" && s.status === "running" ? { ...s, status: "error", error: why, endedAt: Date.now() } : s,
  );
}
