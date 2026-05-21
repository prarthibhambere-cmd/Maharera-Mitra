"use client";

import { useState, useCallback, useRef } from "react";
import { Upload, FileText, X, CheckCircle2 } from "lucide-react";

interface FileUploadZoneProps {
  onFileSelect: (file: File) => void;
  activeFile: File | null;
  onClear: () => void;
}

export default function FileUploadZone({
  onFileSelect,
  activeFile,
  onClear,
}: FileUploadZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragIn = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragOut = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragging(false);

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        if (file.type === "application/pdf") {
          onFileSelect(file);
        }
      }
    },
    [onFileSelect]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect]
  );

  if (activeFile) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 backdrop-blur-md">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/10">
          <CheckCircle2 className="h-4 w-4 text-amber-600" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-zinc-900">
            {activeFile.name}
          </p>
          <p className="text-[11px] text-zinc-500">
            {(activeFile.size / 1024).toFixed(0)} KB · Ready for analysis
          </p>
        </div>
        <button
          onClick={onClear}
          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-amber-100 hover:text-zinc-700"
          aria-label="Remove uploaded file"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragIn}
      onDragLeave={handleDragOut}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`group flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-4 backdrop-blur-md transition-all ${
        isDragging
          ? "border-amber-400 bg-amber-50/80"
          : "border-zinc-300 bg-white/80 hover:border-zinc-400 hover:bg-white"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileInput}
        className="hidden"
      />
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          isDragging
            ? "bg-amber-500/15 text-amber-600"
            : "bg-zinc-100 text-zinc-400 group-hover:text-zinc-600"
        }`}
      >
        {isDragging ? (
          <FileText className="h-4 w-4" strokeWidth={2} />
        ) : (
          <Upload className="h-4 w-4" strokeWidth={2} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-800">
          {isDragging
            ? "Drop your PDF here"
            : "Upload documents for reference"}
        </p>
        <p className="mt-0.5 text-[11px] text-zinc-500">
          Drag &amp; drop a PDF, or{" "}
          <span className="font-medium text-amber-600 underline-offset-2 group-hover:underline">
            click to browse
          </span>
        </p>
      </div>
    </div>
  );
}
