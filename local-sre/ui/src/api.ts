import type { AgentInfo } from "./types";

export interface SSEEvent {
  event: string;
  data: any;
}

export interface ChatBody {
  ask: string;
  conversation_history?: unknown[];
  tool_decisions?: { tool_call_id: string; approved: boolean; feedback?: string }[];
}

function errorDetail(text: string): string {
  try {
    const j = JSON.parse(text);
    return typeof j.detail === "string" ? j.detail : JSON.stringify(j.detail ?? j);
  } catch {
    return text.slice(0, 500) || "no response body";
  }
}

function parseBlock(block: string): SSEEvent | null {
  let event = "message";
  const data: string[] = [];
  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
  }
  if (!data.length) return null;
  const raw = data.join("\n");
  try {
    return { event, data: JSON.parse(raw) };
  } catch {
    return { event, data: { raw } };
  }
}

/** POST /api/chat with stream=true and yield parsed server-sent events as they arrive. */
export async function* streamChat(body: ChatBody, signal: AbortSignal): AsyncGenerator<SSEEvent> {
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, stream: true, enable_tool_approval: true }),
    signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Agent returned HTTP ${res.status}: ${errorDetail(await res.text().catch(() => ""))}`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += value.includes("\r") ? value.replace(/\r\n/g, "\n") : value;
    let idx: number;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const ev = parseBlock(buf.slice(0, idx));
      buf = buf.slice(idx + 2);
      if (ev) yield ev;
    }
  }
  const tail = buf.trim() ? parseBlock(buf) : null;
  if (tail) yield tail;
}

export async function fetchInfo(signal?: AbortSignal): Promise<AgentInfo> {
  const res = await fetch("/api/info?detail=full", { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function checkHealth(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch("/healthz", { signal, cache: "no-store" });
    return res.ok;
  } catch {
    return false;
  }
}
