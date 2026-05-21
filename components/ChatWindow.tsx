"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Bot,
  User,
  Scale,
  FileText,
  BookOpen,
  Upload,
} from "lucide-react";
import FileUploadZone from "./FileUploadZone";

interface SourceCitation {
  title: string;
  sourceType: string;
  similarity: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: SourceCitation[];
}

function decodeCitationsHeader(header: string | null): SourceCitation[] {
  if (!header) return [];
  try {
    const decoded =
      typeof atob === "function"
        ? atob(header)
        : Buffer.from(header, "base64").toString("utf-8");
    const parsed = JSON.parse(decoded);
    if (!Array.isArray(parsed)) return [];

    const dedup = new Map<string, SourceCitation>();
    for (const c of parsed as SourceCitation[]) {
      if (!c?.title) continue;
      const key = `${c.sourceType}::${c.title}`;
      const existing = dedup.get(key);
      if (!existing || c.similarity > existing.similarity) {
        dedup.set(key, c);
      }
    }
    return Array.from(dedup.values()).sort(
      (a, b) => b.similarity - a.similarity
    );
  } catch {
    return [];
  }
}

export default function ChatWindow() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 160) + "px";
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
    };
    const assistantMsg: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
    };

    const updatedMessages = [...messages, userMsg];
    setMessages([...updatedMessages, assistantMsg]);
    setInput("");
    setIsStreaming(true);

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    try {
      const formData = new FormData();
      formData.append(
        "messages",
        JSON.stringify(
          updatedMessages.map((m) => ({ role: m.role, content: m.content }))
        )
      );
      if (uploadedFile) {
        formData.append("file", uploadedFile);
        setUploadedFile(null);
      }

      const res = await fetch("/api/chat", { method: "POST", body: formData });
      if (!res.ok) {
        let serverMessage = `Request failed with status ${res.status}`;
        try {
          const body = await res.json();
          if (body?.error) serverMessage = body.error;
        } catch {
          // body wasn't JSON; keep the generic status message
        }
        throw new Error(serverMessage);
      }

      const citations = decodeCitationsHeader(res.headers.get("X-Citations"));
      if (citations.length > 0) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, citations } : m
          )
        );
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: accumulated } : m
          )
        );
      }
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : "Unknown error";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: `**Error:** ${detail}\n\nCheck the server logs for details.`,
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto max-w-3xl px-6 py-8">
            {messages.map((msg) => (
              <div key={msg.id} className="mb-6">
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                      msg.role === "user"
                        ? "bg-slate-800 text-white"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User className="h-3.5 w-3.5" />
                    ) : (
                      <Bot className="h-3.5 w-3.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {msg.role === "user" ? "You" : "MahaRERA Mitra"}
                    </p>
                    <div className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed">
                      <MessageContent content={msg.content} />
                    </div>
                    {msg.role === "assistant" && msg.content && (
                      <CitationZone citations={msg.citations} />
                    )}
                  </div>
                </div>
              </div>
            ))}
            {isStreaming && (
              <div className="flex items-center gap-2 px-10 py-2 text-xs text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Analyzing compliance context…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-100 bg-white px-6 py-4">
        <div className="mx-auto max-w-3xl space-y-3">
          <FileUploadZone
            onFileSelect={setUploadedFile}
            activeFile={uploadedFile}
            onClear={() => setUploadedFile(null)}
          />
          <form onSubmit={handleSubmit} className="relative">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                autoResize();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
              placeholder="Ask about RERA compliance, project registration, or upload a document for analysis…"
              rows={1}
              className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-12 text-sm text-slate-800 placeholder:text-slate-400 focus:border-slate-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-slate-200 transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isStreaming}
              className="absolute bottom-2.5 right-2.5 rounded-lg bg-slate-800 p-2 text-white transition-colors hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {isStreaming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <Scale className="h-8 w-8 text-slate-400" strokeWidth={1.5} />
      </div>
      <h2 className="text-lg font-semibold text-slate-800">
        MahaRERA Compliance Assistant
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-500">
        Upload an Agreement for Sale, Layout Approval, or any RERA document for
        instant compliance analysis. Ask questions about the RERA Act 2016,
        MahaRERA circulars, and regulatory obligations.
      </p>
      <div className="mt-8 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {[
          "Is my project RERA-registered?",
          "Penalties for delayed possession",
          "Review my Agreement for Sale",
          "Latest MahaRERA circulars",
        ].map((q) => (
          <div
            key={q}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-600 shadow-sm"
          >
            {q}
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageContent({ content }: { content: string }) {
  if (!content) {
    return (
      <span className="inline-flex items-center gap-1.5 text-slate-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Thinking…
      </span>
    );
  }

  const paragraphs = content.split("\n");
  return (
    <>
      {paragraphs.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        if (line.startsWith("### "))
          return (
            <h3 key={i} className="mt-3 mb-1 font-semibold text-slate-800">
              {line.slice(4)}
            </h3>
          );
        if (line.startsWith("## "))
          return (
            <h2 key={i} className="mt-4 mb-1 text-base font-semibold text-slate-800">
              {line.slice(3)}
            </h2>
          );
        if (line.startsWith("- ") || line.startsWith("* "))
          return (
            <li key={i} className="ml-4 list-disc">
              {renderInline(line.slice(2))}
            </li>
          );
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

const SOURCE_TYPE_META: Record<
  string,
  { label: string; icon: typeof FileText; classes: string }
> = {
  circular: {
    label: "Circular",
    icon: FileText,
    classes: "bg-blue-50 text-blue-700 border-blue-100",
  },
  act: {
    label: "RERA Act",
    icon: BookOpen,
    classes: "bg-slate-100 text-slate-700 border-slate-200",
  },
  "user-upload": {
    label: "Uploaded",
    icon: Upload,
    classes: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
};

function CitationZone({ citations }: { citations?: SourceCitation[] }) {
  if (!citations || citations.length === 0) {
    return (
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-400">
        <Scale className="h-3 w-3" />
        <span>No matching knowledge-base sources — response from base model</span>
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/60 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <Scale className="h-3 w-3 text-slate-400" />
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Sources &amp; Citations ({citations.length})
        </p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {citations.map((c, i) => {
          const meta =
            SOURCE_TYPE_META[c.sourceType] ?? SOURCE_TYPE_META["act"];
          const Icon = meta.icon;
          return (
            <div
              key={`${c.title}-${i}`}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs ${meta.classes}`}
              title={`${meta.label}: ${c.title} (relevance ${c.similarity.toFixed(2)})`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="font-medium">{meta.label}</span>
              <span className="text-slate-400">·</span>
              <span className="max-w-[200px] truncate text-slate-600">
                {c.title}
              </span>
              <span className="ml-1 rounded-sm bg-white/60 px-1 py-0.5 text-[10px] font-mono text-slate-500">
                {(c.similarity * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
