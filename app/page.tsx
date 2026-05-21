"use client";

import { useState, useCallback } from "react";
import Sidebar from "@/components/Sidebar";
import ChatWindow from "@/components/ChatWindow";

interface ChatSession {
  id: string;
  title: string;
  timestamp: string;
}

export default function Home() {
  const [sessions, setSessions] = useState<ChatSession[]>([
    {
      id: "1",
      title: "Agreement for Sale — Lodha Palava",
      timestamp: "Today, 2:14 PM",
    },
    {
      id: "2",
      title: "RERA Registration Check",
      timestamp: "Yesterday",
    },
    {
      id: "3",
      title: "Circular 38/2023 Analysis",
      timestamp: "May 18, 2026",
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>("1");

  const handleNewSession = useCallback(() => {
    const newSession: ChatSession = {
      id: crypto.randomUUID(),
      title: "New Compliance Audit",
      timestamp: "Just now",
    };
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, []);

  return (
    <div className="flex h-full">
      <Sidebar
        sessions={sessions}
        activeSessionId={activeSessionId}
        onSelectSession={setActiveSessionId}
        onNewSession={handleNewSession}
      />
      <main className="flex-1 flex flex-col min-w-0">
        <ChatWindow />
      </main>
    </div>
  );
}
