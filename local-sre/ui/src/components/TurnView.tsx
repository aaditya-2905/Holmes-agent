import { memo } from "preact/compat";
import { useEffect, useState } from "preact/hooks";
import type { PendingApproval, Turn } from "../types";
import { IconCheck, IconChevron, IconCopy, IconShield } from "./Icons";
import { Markdown } from "./Markdown";
import { fmtDuration, ToolRow } from "./ToolRow";

/** Ticks only while mounted, so the elapsed clock never re-renders the rest of the thread. */
function Elapsed({ since }: { since: number }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, []);
  return <>{fmtDuration(Math.max(0, now - since))}</>;
}

function CopyButton({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      window.setTimeout(() => setDone(false), 1500);
    } catch {
      /* clipboard blocked (non-secure context) */
    }
  };
  return (
    <button class="btn-ghost small" onClick={copy}>
      {done ? <IconCheck width={14} height={14} /> : <IconCopy width={14} height={14} />}
      {done ? "Copied" : "Copy"}
    </button>
  );
}

function Approvals({
  turnId,
  items,
  onDecide,
}: {
  turnId: string;
  items: PendingApproval[];
  onDecide: (turnId: string, d: Record<string, boolean>) => void;
}) {
  const all = (ok: boolean) => Object.fromEntries(items.map((p) => [p.tool_call_id, ok]));
  return (
    <div class="approval-card">
      <div class="approval-head">
        <IconShield width={18} height={18} />
        <div>
          <strong>Approval needed</strong>
          <p class="muted small">The agent wants to run commands outside its read-only allow list.</p>
        </div>
      </div>
      {items.map((p) => (
        <pre key={p.tool_call_id} class="out approval-cmd">
          {typeof p.params?.command === "string" ? p.params.command : p.description}
        </pre>
      ))}
      <div class="approval-actions">
        <button class="btn-danger" onClick={() => onDecide(turnId, all(false))}>
          Deny
        </button>
        <button class="btn-primary" onClick={() => onDecide(turnId, all(true))}>
          Approve {items.length > 1 ? `all ${items.length}` : ""}
        </button>
      </div>
    </div>
  );
}

interface Props {
  turn: Turn;
  onDecide: (turnId: string, decisions: Record<string, boolean>) => void;
}

export const TurnView = memo(function TurnView({ turn, onDecide }: Props) {
  const live = turn.status === "running" || turn.status === "awaiting";
  const tools = turn.steps.filter((s) => s.kind === "tool");
  const failed = tools.filter((s) => s.kind === "tool" && s.status === "error").length;
  // Steps stay open while the agent works and fold into a summary once there is an answer.
  const [openSteps, setOpenSteps] = useState<boolean | null>(null);
  const stepsOpen = openSteps ?? live;
  const u = turn.usage;
  const ctxPct = u?.contextUsed && u.contextMax ? Math.min(100, (u.contextUsed / u.contextMax) * 100) : 0;

  return (
    <section class="turn">
      <div class="ask">
        <div class="avatar you">You</div>
        <div class="ask-text">{turn.ask}</div>
      </div>

      <div class="reply">
        <div class={`avatar bot${live ? " live" : ""}`} aria-hidden="true" />
        <div class="reply-body">
          {(turn.steps.length > 0 || live) && (
            <div class={`steps${stepsOpen ? " open" : ""}`}>
              <button class="steps-head" onClick={() => setOpenSteps(!stepsOpen)} aria-expanded={stepsOpen}>
                <IconChevron class="chev" width={14} height={14} />
                {live ? (
                  <span class="shimmer">
                    {turn.status === "awaiting" ? "Waiting for your approval" : "Investigating"}
                  </span>
                ) : (
                  <span>Investigation</span>
                )}
                <span class="muted">
                  · {tools.length} tool call{tools.length === 1 ? "" : "s"}
                  {failed > 0 && <span class="bad"> · {failed} failed</span>} ·{" "}
                  {turn.endedAt ? fmtDuration(turn.endedAt - turn.startedAt) : <Elapsed since={turn.startedAt} />}
                </span>
              </button>
              {stepsOpen && (
                <div class="steps-body">
                  {turn.steps.map((s) =>
                    s.kind === "tool" ? (
                      <ToolRow key={s.id} step={s} />
                    ) : (
                      <div key={s.id} class="thought">
                        <Markdown src={s.text} />
                      </div>
                    ),
                  )}
                  {live && turn.steps.length === 0 && <div class="muted small pad">Planning the investigation…</div>}
                </div>
              )}
            </div>
          )}

          {turn.approvals && turn.approvals.length > 0 && (
            <Approvals turnId={turn.id} items={turn.approvals} onDecide={onDecide} />
          )}

          {turn.answer !== undefined && <Markdown class="answer" src={turn.answer || "_(empty answer)_"} />}

          {turn.status === "error" && (
            <div class="error-box">
              <strong>Investigation failed.</strong> {turn.error}
            </div>
          )}
          {turn.status === "stopped" && <div class="muted small">Stopped.</div>}

          {turn.status === "done" && (
            <div class="reply-foot">
              <CopyButton text={turn.answer ?? ""} />
              {u?.promptTokens !== undefined && (
                <span class="muted small">
                  {u.promptTokens.toLocaleString()} in · {(u.completionTokens ?? 0).toLocaleString()} out
                  {u.cost ? ` · $${u.cost.toFixed(4)}` : ""}
                </span>
              )}
              {ctxPct > 0 && (
                <span class="ctx" title={`Context window: ${Math.round(ctxPct)}% used`}>
                  <i style={{ width: `${ctxPct}%` }} />
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
});
