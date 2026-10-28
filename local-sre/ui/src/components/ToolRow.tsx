import { memo } from "preact/compat";
import { useState } from "preact/hooks";
import type { ToolStep } from "../types";
import { IconChevron } from "./Icons";

const MAX_INLINE = 30_000;

const statusText: Record<ToolStep["status"], string> = {
  running: "running",
  success: "ok",
  no_data: "no data",
  error: "error",
  approval: "needs approval",
  denied: "denied",
};

function fmtParams(params?: Record<string, unknown>): string {
  if (!params) return "";
  return Object.entries(params)
    .filter(([k, v]) => v !== null && v !== undefined && v !== "" && !k.startsWith("__"))
    .map(([k, v]) => `${k}=${typeof v === "string" ? v : JSON.stringify(v)}`)
    .join("  ");
}

export const fmtDuration = (ms: number) => (ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(ms < 10000 ? 1 : 0)}s`);

export const ToolRow = memo(function ToolRow({ step }: { step: ToolStep }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  // Script tools report their whole script as the description; prefer the short label.
  const label = step.label && !step.label.includes("\n") && step.label.length < 160 ? step.label : step.name;
  const params = fmtParams(step.params);
  const dur = step.endedAt ? fmtDuration(step.endedAt - step.startedAt) : "";
  const out = step.output ?? "";
  const shown = full || out.length <= MAX_INLINE ? out : out.slice(0, MAX_INLINE);
  const canOpen = step.status !== "running";

  return (
    <div class={`tool ${step.status}${open ? " open" : ""}`}>
      <button class="tool-head" onClick={() => canOpen && setOpen(!open)} aria-expanded={open} disabled={!canOpen}>
        <span class="tool-icon">{step.status === "running" ? <i class="spinner" /> : <i class="dot" />}</span>
        <span class="tool-label">{label}</span>
        {label !== step.name && <span class="tool-name">{step.name}</span>}
        <span class="tool-spacer" />
        <span class={`badge ${step.status}`}>{statusText[step.status]}</span>
        {dur && <span class="tool-dur">{dur}</span>}
        {canOpen && <IconChevron class="chev" width={14} height={14} />}
      </button>
      {/* Output is only mounted when expanded: large kubectl/journal dumps never touch the DOM otherwise. */}
      {open && (
        <div class="tool-body">
          {params && (
            <div class="kv">
              <span>params</span>
              <code>{params}</code>
            </div>
          )}
          {step.error && <div class="tool-error">{step.error.split("\n")[0]}</div>}
          {out ? (
            <pre class="out">{shown}</pre>
          ) : (
            !step.error && <div class="muted small">No output.</div>
          )}
          {shown.length < out.length && (
            <button class="btn-ghost small" onClick={() => setFull(true)}>
              Show all {(out.length / 1024).toFixed(0)} KB
            </button>
          )}
          {step.invocation && (
            <details class="invocation">
              <summary>Command</summary>
              <pre class="out">{step.invocation}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
});
