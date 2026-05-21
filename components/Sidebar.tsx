"use client";

import { useState } from "react";
import {
  MessageSquare,
  Plus,
  FileCheck,
  Building2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

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
}

export default function Sidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={`flex flex-col border-r border-slate-200 bg-slate-50 transition-all duration-300 ${
        collapsed ? "w-16" : "w-72"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-5">
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <Building2 className="h-6 w-6 text-slate-800" strokeWidth={1.5} />
            <div>
              <h1 className="text-sm font-semibold tracking-tight text-slate-900">
                MahaRERA Mitra
              </h1>
              <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">
                Document AI
              </p>
            </div>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="rounded-md p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* New Chat Button */}
      <div className="px-3 py-3">
        <button
          onClick={onNewSession}
          className={`flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:shadow ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <Plus className="h-4 w-4" />
          {!collapsed && <span>New Audit</span>}
        </button>
      </div>

      {/* Sessions List */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        {!collapsed && (
          <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
            Recent Sessions
          </p>
        )}
        <div className="space-y-0.5">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => onSelectSession(session.id)}
              className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${
                activeSessionId === session.id
                  ? "bg-slate-200/80 text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"
              } ${collapsed ? "justify-center" : ""}`}
            >
              {activeSessionId === session.id ? (
                <FileCheck className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <MessageSquare className="h-4 w-4 shrink-0" />
              )}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{session.title}</p>
                  <p className="text-[10px] text-slate-400">
                    {session.timestamp}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="border-t border-slate-200 px-4 py-3">
          <p className="text-[10px] text-slate-400 text-center">
            Powered by Gemini &middot; RERA Act 2016
          </p>
        </div>
      )}
    </aside>
  );
}
