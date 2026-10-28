import { memo } from "preact/compat";
import { useState } from "preact/hooks";
import type { AgentInfo } from "../types";
import { IconLayers, IconMenu, IconMoon, IconSun } from "./Icons";

function currentTheme(): "dark" | "light" {
  const t = document.documentElement.dataset.theme;
  if (t === "dark" || t === "light") return t;
  return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

interface Props {
  title?: string;
  info: AgentInfo | null;
  healthy: boolean | null;
  onMenu: () => void;
  onToolsets: () => void;
}

export const TopBar = memo(function TopBar({ title, info, healthy, onMenu, onToolsets }: Props) {
  const [theme, setTheme] = useState(currentTheme);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode: theme just won't persist */
    }
    setTheme(next);
  };

  const model = info?.models?.[0]?.replace(/^openrouter\//, "") ?? "—";
  const s = info?.toolsets_summary;
  const state = healthy === null ? "pending" : healthy ? "ok" : "down";

  return (
    <header class="topbar">
      <button class="icon-btn only-mobile" onClick={onMenu} aria-label="Open menu">
        <IconMenu />
      </button>
      <h1 class="topbar-title">{title ?? "New investigation"}</h1>
      <div class="topbar-meta">
        <span class={`pill health ${state}`} title={state === "down" ? "Agent unreachable" : "Agent status"}>
          <i class="dot" />
          <span class="hide-xs">{state === "ok" ? "Agent online" : state === "down" ? "Agent offline" : "Connecting"}</span>
        </span>
        <span class="pill model hide-sm" title={info?.models?.[0]}>
          {model}
        </span>
        <button class="pill btn" onClick={onToolsets} title="Toolsets">
          <IconLayers width={14} height={14} />
          {s ? (
            <>
              {s.enabled}
              <span class="muted">on</span>
              {s.failed > 0 && <span class="bad">{s.failed} failed</span>}
            </>
          ) : (
            "Toolsets"
          )}
        </button>
        <button class="icon-btn" onClick={toggle} aria-label="Toggle theme">
          {theme === "dark" ? <IconSun /> : <IconMoon />}
        </button>
      </div>
    </header>
  );
});
