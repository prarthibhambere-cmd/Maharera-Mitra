"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWindow, { type Message } from "@/components/ChatWindow";

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number; // epoch ms
  messages: Message[];
}

const STORAGE_KEY = "maharera-sessions-v1";

function loadSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is ChatSession =>
        typeof s?.id === "string" &&
        typeof s?.title === "string" &&
        typeof s?.updatedAt === "number" &&
        Array.isArray(s?.messages)
    );
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // quota exceeded or storage disabled — silently drop
  }
}

function formatTimestamp(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  if (sameDay) {
    return `Today, ${d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
  }
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (
    d.getFullYear() === yesterday.getFullYear() &&
    d.getMonth() === yesterday.getMonth() &&
    d.getDate() === yesterday.getDate()
  ) {
    return "Yesterday";
  }
  return d.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function deriveTitle(messages: Message[]): string {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New Compliance Audit";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > 48 ? text.slice(0, 45) + "…" : text;
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage on mount
  useEffect(() => {
    const loaded = loadSessions();
    if (loaded.length > 0) {
      setSessions(loaded);
      setActiveSessionId(loaded[0].id);
    } else {
      // Start with one empty session so the UI isn't bare
      const fresh: ChatSession = {
        id: crypto.randomUUID(),
        title: "New Compliance Audit",
        updatedAt: Date.now(),
        messages: [],
      };
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
    }
    setHydrated(true);
  }, []);

  // Persist on every change after hydration
  useEffect(() => {
    if (hydrated) saveSessions(sessions);
  }, [sessions, hydrated]);

  const handleNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Compliance Audit",
      updatedAt: Date.now(),
      messages: [],
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, []);

  const handleMessagesChange = useCallback(
    (sessionId: string, messages: Message[]) => {
      setSessions((prev) =>
        prev
          .map((s) =>
            s.id === sessionId
              ? {
                  ...s,
                  messages,
                  title:
                    s.title === "New Compliance Audit"
                      ? deriveTitle(messages)
                      : s.title,
                  updatedAt: Date.now(),
                }
              : s
          )
          .sort((a, b) => b.updatedAt - a.updatedAt)
      );
    },
    []
  );

  const sidebarSessions = useMemo(
    () =>
      sessions.map((s) => ({
        id: s.id,
        title: s.title,
        timestamp: formatTimestamp(s.updatedAt),
      })),
    [sessions]
  );

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null;

  return (
    <div className="flex h-full">
      <Sidebar
        sessions={sidebarSessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
      />
      <main className="flex-1 flex flex-col min-w-0">
        {activeSession && (
          <ChatWindow
            key={activeSession.id}
            sessionId={activeSession.id}
            messages={activeSession.messages}
            onMessagesChange={(msgs) =>
              handleMessagesChange(activeSession.id, msgs)
            }
          />
        )}
      </main>
    </div>
  );
}
