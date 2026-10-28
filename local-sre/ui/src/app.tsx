import { useCallback, useEffect, useRef, useState } from "preact/hooks";
import { checkHealth, fetchInfo, streamChat, type ChatBody } from "./api";
import { applyEvent, settleRunning, uid, type Applied } from "./events";
import { deleteConversation, loadConversation, loadIndex, saveConversation } from "./store";
import type { AgentInfo, Conversation, ConversationMeta, Turn } from "./types";
import { Composer } from "./components/Composer";
import { EmptyState } from "./components/EmptyState";
import { Sidebar } from "./components/Sidebar";
import { ToolsetsPanel } from "./components/ToolsetsPanel";
import { TopBar } from "./components/TopBar";
import { TurnView } from "./components/TurnView";

const titleFrom = (text: string) => {
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
};

const toMeta = (c: Conversation): ConversationMeta => ({ id: c.id, title: c.title, updatedAt: c.updatedAt });

export function App() {
  const [index, setIndex] = useState<ConversationMeta[]>([]);
  const [convs, setConvs] = useState<Record<string, Conversation>>({});
  const [activeId, setActiveId] = useState<string | null>(null);
  const [info, setInfo] = useState<AgentInfo | null>(null);
  const [healthy, setHealthy] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);

  // Mirrors of state for use inside async stream loops without stale closures.
  const convsRef = useRef(convs);
  const indexRef = useRef(index);
  const controllers = useRef(new Map<string, AbortController>());
  const scroller = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  const commit = useCallback((c: Conversation) => {
    setConvs((prev) => (convsRef.current = { ...prev, [c.id]: c }));
  }, []);

  const upsertIndex = useCallback((c: Conversation) => {
    setIndex((prev) => {
      const next = [toMeta(c), ...prev.filter((m) => m.id !== c.id)];
      indexRef.current = next;
      return next;
    });
  }, []);

  const persist = useCallback((id: string) => {
    const c = convsRef.current[id];
    if (c) void saveConversation(c, indexRef.current);
  }, []);

  const updateTurn = useCallback((convId: string, turnId: string, fn: (t: Turn) => Applied) => {
    setConvs((prev) => {
      const c = prev[convId];
      if (!c) return prev;
      const i = c.turns.findIndex((t) => t.id === turnId);
      if (i < 0) return prev;
      const r = fn(c.turns[i]);
      if (r.turn === c.turns[i] && !r.history) return prev;
      const turns = c.turns.slice();
      turns[i] = r.turn;
      const next = { ...prev, [convId]: { ...c, turns, history: r.history ?? c.history, updatedAt: Date.now() } };
      convsRef.current = next;
      return next;
    });
  }, []);

  // ---- bootstrap: saved conversations, agent info, health polling ----
  useEffect(() => {
    void loadIndex().then((idx) => {
      indexRef.current = idx;
      setIndex(idx);
    });
    const ac = new AbortController();
    let haveInfo = false;
    const poll = async () => {
      const ok = await checkHealth(ac.signal);
      setHealthy(ok);
      if (ok && !haveInfo) {
        try {
          setInfo(await fetchInfo(ac.signal));
          haveInfo = true;
        } catch {
          /* retried on the next poll */
        }
      }
    };
    void poll();
    const t = window.setInterval(() => document.visibilityState === "visible" && void poll(), 20000);
    return () => {
      ac.abort();
      window.clearInterval(t);
    };
  }, []);

  const refreshInfo = useCallback(() => {
    void fetchInfo().then(setInfo).catch(() => undefined);
  }, []);

  // ---- streaming ----
  const run = useCallback(
    async (convId: string, turnId: string, body: ChatBody) => {
      const ac = new AbortController();
      controllers.current.set(turnId, ac);
      try {
        for await (const ev of streamChat(body, ac.signal)) {
          updateTurn(convId, turnId, (t) => applyEvent(t, ev));
        }
        updateTurn(convId, turnId, (t) =>
          t.status === "running"
            ? {
                turn: {
                  ...t,
                  status: "error",
                  error: "The connection closed before the agent finished.",
                  steps: settleRunning(t.steps, "Interrupted"),
                  endedAt: Date.now(),
                },
              }
            : { turn: t },
        );
      } catch (e) {
        const stopped = ac.signal.aborted;
        updateTurn(convId, turnId, (t) => ({
          turn: {
            ...t,
            status: stopped ? "stopped" : "error",
            error: stopped ? undefined : e instanceof Error ? e.message : String(e),
            steps: settleRunning(t.steps, stopped ? "Stopped" : "Interrupted"),
            approvals: undefined,
            endedAt: Date.now(),
          },
        }));
        if (!stopped) setHealthy(await checkHealth());
      } finally {
        controllers.current.delete(turnId);
        persist(convId);
      }
    },
    [updateTurn, persist],
  );

  const active = activeId ? convs[activeId] : undefined;
  const lastTurn = active?.turns[active.turns.length - 1];
  const busy = lastTurn?.status === "running" || lastTurn?.status === "awaiting";

  const send = useCallback(
    (text: string) => {
      const now = Date.now();
      const base: Conversation = active ?? {
        id: uid(),
        title: titleFrom(text),
        createdAt: now,
        updatedAt: now,
        turns: [],
        history: null,
      };
      const turn: Turn = { id: uid(), ask: text, steps: [], status: "running", startedAt: now };
      const c: Conversation = { ...base, turns: [...base.turns, turn], updatedAt: now };
      commit(c);
      upsertIndex(c);
      setActiveId(c.id);
      stick.current = true;
      void run(c.id, turn.id, { ask: text, conversation_history: c.history ?? undefined });
    },
    [active, commit, upsertIndex, run],
  );

  const stop = useCallback(() => {
    if (lastTurn) controllers.current.get(lastTurn.id)?.abort();
  }, [lastTurn]);

  const decide = useCallback(
    (turnId: string, decisions: Record<string, boolean>) => {
      const c = activeId ? convsRef.current[activeId] : undefined;
      if (!c?.history) return;
      updateTurn(c.id, turnId, (t) => ({
        turn: {
          ...t,
          status: "running",
          approvals: undefined,
          steps: t.steps.map((s) =>
            s.kind === "tool" && s.id in decisions
              ? { ...s, status: decisions[s.id] ? "running" : "denied", startedAt: Date.now(), endedAt: undefined }
              : s,
          ),
        },
      }));
      void run(c.id, turnId, {
        ask: "",
        conversation_history: c.history,
        tool_decisions: Object.entries(decisions).map(([tool_call_id, approved]) => ({ tool_call_id, approved })),
      });
    },
    [activeId, updateTurn, run],
  );

  const select = useCallback(async (id: string) => {
    setSidebarOpen(false);
    stick.current = true;
    if (!convsRef.current[id]) {
      const c = await loadConversation(id);
      if (!c) return;
      // A turn that was mid-flight when the page closed can never finish.
      c.turns = c.turns.map((t) =>
        t.status === "running" || t.status === "awaiting"
          ? { ...t, status: "stopped", approvals: undefined, steps: settleRunning(t.steps, "Interrupted") }
          : t,
      );
      setConvs((prev) => (convsRef.current = { ...prev, [id]: c }));
    }
    setActiveId(id);
  }, []);

  const newChat = useCallback(() => {
    setActiveId(null);
    setSidebarOpen(false);
  }, []);

  const remove = useCallback(
    (id: string) => {
      const next = indexRef.current.filter((m) => m.id !== id);
      indexRef.current = next;
      setIndex(next);
      setConvs((prev) => {
        const { [id]: _gone, ...rest } = prev;
        return (convsRef.current = rest);
      });
      if (activeId === id) setActiveId(null);
      void deleteConversation(id, next);
    },
    [activeId],
  );

  // ---- keyboard: Ctrl/Cmd+K new investigation, Esc closes overlays ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        newChat();
      } else if (e.key === "Escape") {
        setPanelOpen(false);
        setSidebarOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [newChat]);

  // ---- follow the stream unless the user scrolled up ----
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = active && stick.current ? el.scrollHeight : active ? el.scrollTop : 0;
  }, [active]);

  const onScroll = useCallback(() => {
    const el = scroller.current;
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }, []);

  return (
    <div class={`shell${sidebarOpen ? " sidebar-open" : ""}`}>
      <Sidebar
        index={index}
        activeId={activeId}
        onSelect={select}
        onNew={newChat}
        onDelete={remove}
        onClose={() => setSidebarOpen(false)}
      />
      <main class="main">
        <TopBar
          title={active?.title}
          info={info}
          healthy={healthy}
          onMenu={() => setSidebarOpen(true)}
          onToolsets={() => setPanelOpen(true)}
        />
        <div class="scroll" ref={scroller} onScroll={onScroll}>
          {active ? (
            <div class="thread">
              {active.turns.map((t) => (
                <TurnView key={t.id} turn={t} onDecide={decide} />
              ))}
            </div>
          ) : (
            <EmptyState info={info} onPick={send} />
          )}
        </div>
        <Composer busy={busy} disabled={healthy === false} onSend={send} onStop={stop} />
      </main>
      {panelOpen && <ToolsetsPanel info={info} onClose={() => setPanelOpen(false)} onRefresh={refreshInfo} />}
    </div>
  );
}
