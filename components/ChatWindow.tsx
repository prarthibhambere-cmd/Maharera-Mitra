"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Send,
  Loader2,
  Bot,
  Scale,
  FileText,
  BookOpen,
  Upload,
} from "lucide-react";
import FileUploadZone from "./FileUploadZone";

export interface SourceCitation {
  title: string;
  sourceType: string;
  similarity: number;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: SourceCitation[];
}

interface ChatWindowProps {
  sessionId: string;
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
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

export default function ChatWindow({
  messages,
  onMessagesChange,
}: ChatWindowProps) {
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Keep a ref to latest messages so async stream updates avoid stale closures.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const setMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      const next =
        typeof updater === "function"
          ? (updater as (prev: Message[]) => Message[])(messagesRef.current)
          : updater;
      messagesRef.current = next;
      onMessagesChange(next);
    },
    [onMessagesChange]
  );

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

  async function sendMessage(text: string) {
    const trimmed = text.trim();
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
      const detail = err instanceof Error ? err.message : "Unknown error";
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return (
    <>
      {/* Scrollable conversation plane */}
      <div ref={scrollRef} className="absolute inset-0 overflow-y-auto">
        {messages.length === 0 ? (
          <EmptyState onSampleClick={(text) => void sendMessage(text)} />
        ) : (
          <div className="mx-auto w-full max-w-4xl px-6 py-8 pb-44">
            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserMessage key={msg.id} content={msg.content} />
              ) : (
                <AssistantMessage
                  key={msg.id}
                  content={msg.content}
                  citations={msg.citations}
                />
              )
            )}
            {isStreaming && (
              <div className="mt-2 flex items-center gap-2 pl-12 text-xs text-zinc-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>Analyzing compliance context…</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Floating footer dock with ambient gradient fade */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-zinc-50 via-zinc-50/95 to-transparent px-6 pb-6 pt-12">
        <div className="pointer-events-auto mx-auto w-full max-w-4xl space-y-3">
          <FileUploadZone
            onFileSelect={setUploadedFile}
            activeFile={uploadedFile}
            onClear={() => setUploadedFile(null)}
          />
          <form onSubmit={handleSubmit} className="relative">
            <div className="rounded-xl border border-zinc-200 bg-white shadow-md transition-shadow focus-within:shadow-lg">
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
                placeholder="Ask about RERA compliance, project registration, or attach a document for analysis…"
                rows={1}
                className="w-full resize-none rounded-xl bg-transparent py-3.5 pl-4 pr-14 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!input.trim() || isStreaming}
                aria-label="Send message"
                className="absolute bottom-2.5 right-2.5 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-900 text-zinc-100 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" strokeWidth={2} />
                )}
              </button>
            </div>
          </form>
          <p className="text-center text-[10px] text-zinc-400">
            MahaRERA Mitra may make mistakes. Verify critical compliance
            requirements with a qualified legal advisor.
          </p>
        </div>
      </div>
    </>
  );
}

/* ─────────────────────────── Message components ─────────────────────────── */

function UserMessage({ content }: { content: string }) {
  return (
    <div className="mb-6 flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-none bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-100 shadow-sm">
        {content}
      </div>
    </div>
  );
}

function AssistantMessage({
  content,
  citations,
}: {
  content: string;
  citations?: SourceCitation[];
}) {
  return (
    <div className="mb-8 flex items-start gap-3">
      <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 shadow-sm ring-1 ring-amber-600/20">
        <Bot className="h-4 w-4 text-white" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
          MahaRERA Mitra
        </p>
        <div className="rounded-2xl rounded-tl-none border border-zinc-200/80 bg-white p-6 shadow-sm">
          <MessageContent content={content} />
          {content && <CitationZone citations={citations} />}
        </div>
      </div>
    </div>
  );
}

/* ──────────────────────────── Empty / welcome ────────────────────────────── */

function EmptyState({
  onSampleClick,
}: {
  onSampleClick: (text: string) => void;
}) {
  const samples: { label: string; prompt: string }[] = [
    {
      label: "Penalty for diverting escrow funds",
      prompt:
        "What is the penalty for diverting escrow funds in a RERA-registered project? Cite the relevant section.",
    },
    {
      label: "Review Section 11 promoter duties",
      prompt:
        "Summarize the key obligations of a promoter under Section 11 of the RERA Act 2016.",
    },
    {
      label: "Quarterly update requirements",
      prompt:
        "What are the quarterly project update requirements for MahaRERA-registered projects, and what's the penalty for missing them?",
    },
    {
      label: "Refund obligations on delayed possession",
      prompt:
        "Explain a promoter's refund obligations under Section 18 when possession is delayed beyond the agreement date.",
    },
  ];
  return (
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col items-center justify-center px-6 pb-32 text-center">
      <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-900 shadow-sm ring-1 ring-zinc-800">
        <Scale className="h-6 w-6 text-amber-500" strokeWidth={1.75} />
      </div>
      <h2 className="text-xl font-semibold tracking-tight text-zinc-900">
        MahaRERA-Mitra
      </h2>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-zinc-500">
        Ask questions about the RERA Act 2016, MahaRERA circulars, and
        regulatory obligations.
      </p>
      <div className="mt-8 grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
        {samples.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onSampleClick(s.prompt)}
            className="cursor-pointer rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-left text-sm text-zinc-700 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-amber-500/40"
          >
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────── Markdown + entity rendering ─────────────────────── */

type Block =
  | { kind: "h2"; text: string }
  | { kind: "h3"; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "entities"; entries: { label: string; value: string }[] }
  | { kind: "p"; text: string }
  | { kind: "blank" };

const ENTITY_LABELS = new Set([
  "licensor",
  "licensee",
  "promoter",
  "allottee",
  "developer",
  "builder",
  "owner",
  "purchaser",
  "buyer",
  "seller",
  "project name",
  "project",
  "rera number",
  "rera registration",
  "rera registration number",
  "maharera registration",
  "maharera registration number",
  "registration number",
  "registration no",
  "possession",
  "possession date",
  "date of possession",
  "consideration",
  "total consideration",
  "sale consideration",
  "carpet area",
  "built-up area",
  "tower",
  "flat",
  "unit",
  "apartment",
  "wing",
  "floor",
]);

function tryParseEntityLine(line: string): { label: string; value: string } | null {
  // Match patterns like:
  //   **Label:** value
  //   - **Label:** value
  //   * **Label:** value
  //   Label: value
  const cleaned = line.trim().replace(/^[-*]\s+/, "");
  const m =
    cleaned.match(/^\*\*([^*:]{1,40}):\*\*\s*(.+)$/) ||
    cleaned.match(/^([A-Z][A-Za-z][A-Za-z0-9 _/-]{0,40}):\s+(.+)$/);
  if (!m) return null;
  const label = m[1].trim();
  const value = m[2].trim();
  if (!ENTITY_LABELS.has(label.toLowerCase())) return null;
  if (value.length > 200) return null; // long sentences aren't entity values
  return { label, value };
}

function parseBlocks(content: string): Block[] {
  const lines = content.split("\n");
  const blocks: Block[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Blank line
    if (!line.trim()) {
      blocks.push({ kind: "blank" });
      i++;
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      blocks.push({ kind: "h3", text: line.slice(4) });
      i++;
      continue;
    }
    if (line.startsWith("## ")) {
      blocks.push({ kind: "h2", text: line.slice(3) });
      i++;
      continue;
    }

    // Try entity group (consecutive entity lines)
    const entityEntries: { label: string; value: string }[] = [];
    let j = i;
    while (j < lines.length) {
      const entity = tryParseEntityLine(lines[j]);
      if (!entity) break;
      entityEntries.push(entity);
      j++;
    }
    if (entityEntries.length >= 2) {
      blocks.push({ kind: "entities", entries: entityEntries });
      i = j;
      continue;
    }

    // Bullet list (consecutive `-` or `*` lines)
    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }

    // Default paragraph
    blocks.push({ kind: "p", text: line });
    i++;
  }

  return blocks;
}

function MessageContent({ content }: { content: string }) {
  if (!content) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-zinc-400">
        <Loader2 className="h-3 w-3 animate-spin" />
        Thinking…
      </span>
    );
  }

  const blocks = parseBlocks(content);

  return (
    <div className="space-y-2 text-sm leading-relaxed text-zinc-700">
      {blocks.map((block, i) => {
        switch (block.kind) {
          case "h2":
            return (
              <h2
                key={i}
                className="mt-4 text-base font-semibold tracking-tight text-zinc-900 first:mt-0"
              >
                {renderInline(block.text)}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={i}
                className="mt-3 text-sm font-semibold tracking-tight text-zinc-900 first:mt-0"
              >
                {renderInline(block.text)}
              </h3>
            );
          case "ul":
            return (
              <ul key={i} className="ml-1 space-y-1">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2">
                    <span className="mt-2 inline-block h-1 w-1 shrink-0 rounded-full bg-zinc-400" />
                    <span>{renderInline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case "entities":
            return <EntityGrid key={i} entries={block.entries} />;
          case "blank":
            return <div key={i} className="h-1" />;
          case "p":
            return <p key={i}>{renderInline(block.text)}</p>;
        }
      })}
    </div>
  );
}

function EntityGrid({
  entries,
}: {
  entries: { label: string; value: string }[];
}) {
  return (
    <div className="my-3 grid grid-cols-1 gap-3 md:grid-cols-2">
      {entries.map((entry, i) => (
        <div
          key={i}
          className="rounded-xl border border-zinc-200/60 bg-zinc-50 p-3"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600">
            {entry.label}
          </p>
          <p className="mt-1 text-sm font-medium text-zinc-900">
            {renderInline(entry.value)}
          </p>
        </div>
      ))}
    </div>
  );
}

function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-zinc-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

/* ─────────────────────────────── Citations ─────────────────────────────── */

const SOURCE_TYPE_META: Record<
  string,
  { label: string; icon: typeof FileText; classes: string }
> = {
  circular: {
    label: "Circular",
    icon: FileText,
    classes: "bg-blue-50 text-blue-700 ring-blue-100",
  },
  act: {
    label: "RERA Act",
    icon: BookOpen,
    classes: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  },
  "user-upload": {
    label: "Uploaded",
    icon: Upload,
    classes: "bg-amber-50 text-amber-700 ring-amber-100",
  },
};

function CitationZone({ citations }: { citations?: SourceCitation[] }) {
  if (!citations || citations.length === 0) {
    return (
      <div className="mt-5 flex items-center gap-1.5 border-t border-zinc-100 pt-3 text-[10px] text-zinc-400">
        <Scale className="h-3 w-3" />
        <span>No matching knowledge-base sources — response from base model</span>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-zinc-100 pt-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Scale className="h-3 w-3 text-amber-600" strokeWidth={2} />
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-500">
          Sources &amp; Citations · {citations.length}
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
              className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ring-1 ${meta.classes}`}
              title={`${meta.label}: ${c.title} (relevance ${c.similarity.toFixed(2)})`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="font-medium">{meta.label}</span>
              <span className="opacity-50">·</span>
              <span className="max-w-[220px] truncate">{c.title}</span>
              <span className="ml-1 rounded-sm bg-white/70 px-1 py-0.5 font-mono text-[10px] opacity-80">
                {(c.similarity * 100).toFixed(0)}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
