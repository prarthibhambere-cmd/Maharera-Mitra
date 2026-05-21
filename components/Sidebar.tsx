"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  FileText,
  Scale,
  Pencil,
  Trash2,
  Check,
  X,
  LogIn,
  LogOut,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { signOut } from "@/lib/auth";
import AuthModal from "./AuthModal";

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

interface SidebarProps {
  sessions: ChatSession[];
  activeSessionId: string | null;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  user: User | null;
}

function userInitials(user: User): string {
  const email = user.email ?? "";
  const phone = user.phone ?? "";
  if (email) {
    const local = email.split("@")[0];
    return (local[0] ?? "?").toUpperCase();
  }
  if (phone) return phone.slice(-2);
  return "U";
}

function userLabel(user: User): string {
  return user.email ?? user.phone ?? "Signed-in user";
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  user,
}: SidebarProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(
    null
  );
  const [authOpen, setAuthOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const editInputRef = useRef<HTMLInputElement>(null);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
    }
  }

  // Auto-focus the input when entering edit mode
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  function startEdit(session: ChatSession) {
    setConfirmingDeleteId(null);
    setEditingId(session.id);
    setDraftTitle(session.title);
  }

  function commitEdit() {
    if (editingId) {
      const trimmed = draftTitle.trim();
      if (trimmed) onRenameSession(editingId, trimmed);
    }
    setEditingId(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftTitle("");
  }

  function startDelete(session: ChatSession) {
    setEditingId(null);
    setConfirmingDeleteId(session.id);
  }

  function confirmDelete() {
    if (confirmingDeleteId) onDeleteSession(confirmingDeleteId);
    setConfirmingDeleteId(null);
  }

  function cancelDelete() {
    setConfirmingDeleteId(null);
  }

  return (
    <aside className="flex w-80 shrink-0 flex-col bg-zinc-900 text-zinc-400">
      {/* Branding header */}
      <div className="border-b border-zinc-800 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-800 ring-1 ring-zinc-700/50">
            <Scale className="h-4 w-4 text-amber-500" strokeWidth={2} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-tight text-zinc-100">
              MahaRERA-Mitra
            </h1>
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-500">
              Your Maha-RERA AI Friend
            </p>
          </div>
        </div>
      </div>

      {/* New Chat action */}
      <div className="px-3 pt-3">
        <button
          onClick={onNewSession}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-800 px-3 py-2.5 text-sm font-medium text-zinc-100 ring-1 ring-zinc-700/50 transition-colors hover:bg-zinc-700"
        >
          <Plus className="h-4 w-4" strokeWidth={2} />
          <span>New Chat</span>
        </button>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-600">
          Recent Chats
        </p>
        <div className="space-y-0.5">
          {sessions.length === 0 ? (
            <p className="px-2 py-3 text-xs text-zinc-600">
              No chats yet. Start a new one above.
            </p>
          ) : (
            sessions.map((session) => {
              const isActive = activeSessionId === session.id;
              const isEditing = editingId === session.id;
              const isConfirmingDelete = confirmingDeleteId === session.id;

              return (
                <div
                  key={session.id}
                  className={`group relative rounded-lg transition-colors ${
                    isActive
                      ? "bg-zinc-800 text-zinc-100 ring-1 ring-zinc-700/60"
                      : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-200"
                  }`}
                >
                  {isEditing ? (
                    <div className="flex items-center gap-1.5 px-2.5 py-2">
                      <FileText
                        className="h-3.5 w-3.5 shrink-0 text-amber-500"
                        strokeWidth={1.75}
                      />
                      <input
                        ref={editInputRef}
                        value={draftTitle}
                        onChange={(e) => setDraftTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          else if (e.key === "Escape") cancelEdit();
                        }}
                        onBlur={commitEdit}
                        className="min-w-0 flex-1 rounded bg-zinc-900 px-1.5 py-0.5 text-sm text-zinc-100 ring-1 ring-amber-500/40 focus:outline-none focus:ring-amber-500"
                      />
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={commitEdit}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-amber-400"
                        aria-label="Save title"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={cancelEdit}
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                        aria-label="Cancel rename"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : isConfirmingDelete ? (
                    <div className="flex items-center gap-2 px-2.5 py-2">
                      <Trash2 className="h-3.5 w-3.5 shrink-0 text-red-400" />
                      <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                        Delete this chat?
                      </span>
                      <button
                        onClick={confirmDelete}
                        className="rounded bg-red-500/20 px-2 py-0.5 text-[11px] font-medium text-red-300 ring-1 ring-red-500/30 hover:bg-red-500/30"
                      >
                        Delete
                      </button>
                      <button
                        onClick={cancelDelete}
                        className="rounded px-2 py-0.5 text-[11px] text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectSession(session.id)}
                        className="flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2.5 pr-16 text-left"
                      >
                        <FileText
                          className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                            isActive
                              ? "text-amber-500"
                              : "text-zinc-600 group-hover:text-zinc-500"
                          }`}
                          strokeWidth={1.75}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium leading-tight">
                            {session.title}
                          </p>
                          <p className="mt-0.5 text-[10px] text-zinc-500">
                            {session.timestamp}
                          </p>
                        </div>
                      </button>
                      {/* Hover actions */}
                      <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(session);
                          }}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-amber-400"
                          aria-label="Rename chat"
                          title="Rename"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startDelete(session);
                          }}
                          className="rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-red-400"
                          aria-label="Delete chat"
                          title="Delete"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Account block / Sign-in */}
      <div className="border-t border-zinc-800 px-3 py-3">
        {user ? (
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-500 text-xs font-semibold text-white">
              {userInitials(user)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-100">
                {userLabel(user)}
              </p>
              <p className="text-[10px] text-zinc-500">Signed in</p>
            </div>
            <button
              onClick={handleSignOut}
              disabled={signingOut}
              className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-red-400 disabled:opacity-50"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setAuthOpen(true)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-sm font-medium text-zinc-200 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <LogIn className="h-3.5 w-3.5" />
            <span>Sign in</span>
            <span className="rounded-sm bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-400">
              Save chats
            </span>
          </button>
        )}
      </div>

      {/* Powered-by line */}
      <div className="border-t border-zinc-800 px-5 py-2">
        <p className="text-center text-[10px] text-zinc-600">
          Powered by Gemini · RERA Act 2016
        </p>
      </div>

      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </aside>
  );
}
