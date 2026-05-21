"use client";

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWindow, { type Message } from "@/components/ChatWindow";
import { useAuth } from "@/hooks/useAuth";
import { getBrowserClient } from "@/lib/auth";

export interface ChatSession {
  id: string;
  title: string;
  updatedAt: number; // epoch ms
  messages: Message[];
}

const STORAGE_KEY = "maharera-sessions-v1";

/* ─────────────────────────── localStorage helpers ─────────────────────── */

function loadLocalSessions(): ChatSession[] {
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

function saveLocalSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch {
    // quota exceeded — drop silently
  }
}

function clearLocalSessions() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}

/* ─────────────────────────── Supabase chat sync ───────────────────────── */

interface DbChatRow {
  id: string;
  user_id: string;
  title: string;
  messages: Message[];
  updated_at: string;
}

async function fetchUserChats(userId: string): Promise<ChatSession[]> {
  const supabase = getBrowserClient();
  const { data, error } = await supabase
    .from("chats")
    .select("id, title, messages, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  if (error) {
    console.error("Failed to fetch chats:", error.message);
    return [];
  }
  return (data as Pick<DbChatRow, "id" | "title" | "messages" | "updated_at">[]).map(
    (row) => ({
      id: row.id,
      title: row.title,
      messages: row.messages ?? [],
      updatedAt: new Date(row.updated_at).getTime(),
    })
  );
}

async function upsertChat(userId: string, session: ChatSession) {
  const supabase = getBrowserClient();
  const { error } = await supabase.from("chats").upsert({
    id: session.id,
    user_id: userId,
    title: session.title,
    messages: session.messages,
    updated_at: new Date(session.updatedAt).toISOString(),
  });
  if (error) console.error("Failed to upsert chat:", error.message);
}

async function deleteChatRow(id: string) {
  const supabase = getBrowserClient();
  const { error } = await supabase.from("chats").delete().eq("id", id);
  if (error) console.error("Failed to delete chat:", error.message);
}

async function migrateLocalToDb(userId: string, localSessions: ChatSession[]) {
  if (localSessions.length === 0) return;
  const supabase = getBrowserClient();
  const rows = localSessions.map((s) => ({
    id: s.id,
    user_id: userId,
    title: s.title,
    messages: s.messages,
    updated_at: new Date(s.updatedAt).toISOString(),
  }));
  const { error } = await supabase.from("chats").upsert(rows);
  if (error) {
    console.error("Failed to migrate local chats:", error.message);
    return;
  }
  clearLocalSessions();
}

/* ─────────────────────────── Format / derive helpers ──────────────────── */

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
  if (!firstUser) return "New Chat";
  const text = firstUser.content.trim().replace(/\s+/g, " ");
  return text.length > 48 ? text.slice(0, 45) + "…" : text;
}

/* ────────────────────────────────── Page ─────────────────────────────── */

export default function Home() {
  const { user, loading: authLoading } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Hydrate sessions whenever auth state changes (initial load or login/logout)
  useEffect(() => {
    if (authLoading) return;

    const currentUserId = user?.id ?? null;
    const previousUserId = lastUserIdRef.current;
    lastUserIdRef.current = currentUserId;

    async function load() {
      if (user) {
        // On login: migrate any existing local sessions to the user's account
        if (previousUserId !== user.id) {
          const local = loadLocalSessions();
          if (local.length > 0) {
            await migrateLocalToDb(user.id, local);
          }
        }
        const dbSessions = await fetchUserChats(user.id);
        if (dbSessions.length > 0) {
          setSessions(dbSessions);
          setActiveSessionId(dbSessions[0].id);
        } else {
          const fresh: ChatSession = {
            id: crypto.randomUUID(),
            title: "New Chat",
            updatedAt: Date.now(),
            messages: [],
          };
          await upsertChat(user.id, fresh);
          setSessions([fresh]);
          setActiveSessionId(fresh.id);
        }
      } else {
        const local = loadLocalSessions();
        if (local.length > 0) {
          setSessions(local);
          setActiveSessionId(local[0].id);
        } else {
          const fresh: ChatSession = {
            id: crypto.randomUUID(),
            title: "New Chat",
            updatedAt: Date.now(),
            messages: [],
          };
          setSessions([fresh]);
          setActiveSessionId(fresh.id);
        }
      }
      setHydrated(true);
    }

    void load();
  }, [user, authLoading]);

  // Persist on every change — to DB if logged in, localStorage otherwise.
  // We intentionally skip DB writes for sessions with no messages to avoid
  // churning rows for sessions the user never sends a message in.
  useEffect(() => {
    if (!hydrated) return;
    if (user) {
      // Only sync sessions that have at least one message
      sessions
        .filter((s) => s.messages.length > 0)
        .forEach((s) => {
          void upsertChat(user.id, s);
        });
    } else {
      saveLocalSessions(sessions);
    }
  }, [sessions, hydrated, user]);

  const handleNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Chat",
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
                    s.title === "New Chat"
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

  const handleRenameSession = useCallback((id: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setSessions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, title: trimmed } : s))
    );
  }, []);

  const handleDeleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => prev.filter((s) => s.id !== id));
      setActiveSessionId((current) => (current === id ? null : current));
      if (user) void deleteChatRow(id);
    },
    [user]
  );

  // Guarantee an active session exists when sessions list changes
  useEffect(() => {
    if (!hydrated) return;
    if (sessions.length === 0) {
      const fresh: ChatSession = {
        id: crypto.randomUUID(),
        title: "New Chat",
        updatedAt: Date.now(),
        messages: [],
      };
      setSessions([fresh]);
      setActiveSessionId(fresh.id);
      return;
    }
    if (!sessions.some((s) => s.id === activeSessionId)) {
      setActiveSessionId(sessions[0].id);
    }
  }, [hydrated, sessions, activeSessionId]);

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
    <div className="flex h-screen w-full overflow-hidden">
      <Sidebar
        sessions={sidebarSessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
        onRenameSession={handleRenameSession}
        onDeleteSession={handleDeleteSession}
        user={user}
      />
      <main className="relative flex-1 flex flex-col min-w-0 bg-zinc-50">
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
