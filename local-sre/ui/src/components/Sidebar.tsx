import { memo } from "preact/compat";
import type { ConversationMeta } from "../types";
import { IconClose, IconPlus, IconTrash, Logo } from "./Icons";

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function ago(ts: number): string {
  const s = Math.round((ts - Date.now()) / 1000);
  const abs = Math.abs(s);
  if (abs < 60) return "just now";
  if (abs < 3600) return rtf.format(Math.round(s / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(s / 3600), "hour");
  return rtf.format(Math.round(s / 86400), "day");
}

interface Props {
  index: ConversationMeta[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export const Sidebar = memo(function Sidebar({ index, activeId, onSelect, onNew, onDelete, onClose }: Props) {
  return (
    <>
      <div class="scrim" onClick={onClose} />
      <aside class="sidebar">
        <div class="brand">
          <Logo />
          <div>
            <div class="brand-name">Holmes</div>
            <div class="brand-sub">Local SRE agent</div>
          </div>
          <button class="icon-btn only-mobile" onClick={onClose} aria-label="Close menu">
            <IconClose />
          </button>
        </div>
        <button class="new-btn" onClick={onNew}>
          <IconPlus /> New investigation <kbd>Ctrl K</kbd>
        </button>
        <nav class="history" aria-label="Previous investigations">
          {index.length === 0 && <p class="history-empty">Investigations you run are saved here, in this browser.</p>}
          {index.map((m) => (
            <div key={m.id} class={`history-item${m.id === activeId ? " active" : ""}`}>
              <button class="history-open" onClick={() => onSelect(m.id)} title={m.title}>
                <span class="history-title">{m.title}</span>
                <span class="history-time">{ago(m.updatedAt)}</span>
              </button>
              <button class="icon-btn history-del" onClick={() => onDelete(m.id)} aria-label="Delete investigation">
                <IconTrash width={14} height={14} />
              </button>
            </div>
          ))}
        </nav>
        <div class="sidebar-foot">Read-only tools · runs on 127.0.0.1</div>
      </aside>
    </>
  );
});
