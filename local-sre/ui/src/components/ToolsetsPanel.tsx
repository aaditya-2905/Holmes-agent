import type { AgentInfo, ToolsetInfo } from "../types";
import { IconClose } from "./Icons";

const order: Record<string, number> = { failed: 0, enabled: 1, disabled: 2 };

interface Props {
  info: AgentInfo | null;
  onClose: () => void;
  onRefresh: () => void;
}

export function ToolsetsPanel({ info, onClose, onRefresh }: Props) {
  const list: ToolsetInfo[] = [...(info?.toolsets ?? [])].sort(
    (a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || a.name.localeCompare(b.name),
  );
  const active = list.filter((t) => t.status !== "disabled");
  const disabled = list.filter((t) => t.status === "disabled");

  return (
    <div class="overlay" onClick={onClose}>
      <aside class="panel" onClick={(e) => e.stopPropagation()} aria-label="Toolsets">
        <div class="panel-head">
          <div>
            <h2>Toolsets</h2>
            <p class="muted">
              Holmes {info?.version ?? ""} · {info?.toolsets_summary?.enabled ?? 0} enabled
            </p>
          </div>
          <button class="btn-ghost" onClick={onRefresh}>
            Refresh
          </button>
          <button class="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose />
          </button>
        </div>
        <div class="panel-body">
          {active.map((t) => (
            <div key={t.name} class={`ts-row ${t.status}`}>
              <i class="dot" />
              <div class="ts-main">
                <div class="ts-name">{t.name}</div>
                {t.error && <div class="ts-err">{t.error}</div>}
              </div>
              <span class="ts-count">{t.tool_count ?? 0} tools</span>
            </div>
          ))}
          {disabled.length > 0 && (
            <details class="ts-disabled">
              <summary>{disabled.length} disabled (not configured)</summary>
              <div class="ts-chips">
                {disabled.map((t) => (
                  <span key={t.name} class="chip">
                    {t.name}
                  </span>
                ))}
              </div>
            </details>
          )}
        </div>
      </aside>
    </div>
  );
}
