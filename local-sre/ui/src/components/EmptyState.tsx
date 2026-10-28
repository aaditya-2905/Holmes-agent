import type { JSX } from "preact";
import type { AgentInfo } from "../types";
import { IconAlert, IconBox, IconCpu, IconDisk, IconNet, IconPulse, Logo } from "./Icons";

const prompts: { icon: (p: JSX.SVGAttributes<SVGSVGElement>) => JSX.Element; title: string; ask: string }[] = [
  {
    icon: IconPulse,
    title: "Health check",
    ask: "Give me a health check of this machine: CPU, memory, disk, failing services and anything unusual.",
  },
  {
    icon: IconCpu,
    title: "Why is it slow?",
    ask: "This machine feels slow right now. Find out what is consuming resources and why.",
  },
  {
    icon: IconNet,
    title: "Network path",
    ask: "Check the network: interfaces, gateway, DNS and the path to the internet. Is anything degraded?",
  },
  {
    icon: IconAlert,
    title: "Recent errors",
    ask: "What errors were logged in the last hour, and which ones actually matter?",
  },
  {
    icon: IconBox,
    title: "Containers",
    ask: "Review my Docker containers: which are unhealthy, restarting or exited with errors, and why?",
  },
  {
    icon: IconDisk,
    title: "Disk space",
    ask: "Which filesystems are filling up, and what is using the most space?",
  },
];

export function EmptyState({ info, onPick }: { info: AgentInfo | null; onPick: (ask: string) => void }) {
  return (
    <div class="empty">
      <div class="empty-logo">
        <Logo />
      </div>
      <h2>What should we investigate?</h2>
      <p class="muted">
        Holmes inspects this machine with read-only tools — processes, services, logs, network and containers — and
        explains the root cause.
        {info?.toolsets_summary && ` ${info.toolsets_summary.enabled} toolsets ready.`}
      </p>
      <div class="cards">
        {prompts.map(({ icon: Icon, title, ask }) => (
          <button key={title} class="card" onClick={() => onPick(ask)}>
            <span class="card-icon">
              <Icon width={18} height={18} />
            </span>
            <span class="card-title">{title}</span>
            <span class="card-ask">{ask}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
