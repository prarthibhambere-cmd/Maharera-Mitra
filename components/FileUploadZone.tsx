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
      <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 px-4 py-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-800">
            {activeFile.name}
          </p>
          <p className="text-xs text-slate-500">
            {(activeFile.size / 1024).toFixed(0)} KB &middot; Ready for
            analysis
          </p>
        </div>
        <button
          onClick={onClear}
          className="rounded-md p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
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
      className={`group cursor-pointer rounded-xl border-2 border-dashed px-6 py-5 text-center transition-all ${
        isDragging
          ? "border-slate-400 bg-slate-100"
          : "border-slate-200 bg-slate-50/50 hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf"
        onChange={handleFileInput}
        className="hidden"
      />
      <div className="flex flex-col items-center gap-2">
        {isDragging ? (
          <FileText className="h-8 w-8 text-slate-500" strokeWidth={1.5} />
        ) : (
          <Upload
            className="h-8 w-8 text-slate-300 group-hover:text-slate-400 transition-colors"
            strokeWidth={1.5}
          />
        )}
        <div>
          <p className="text-sm font-medium text-slate-600">
            {isDragging
              ? "Drop your PDF here"
              : "Upload Agreement for Sale or Layout Approval"}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            Drag &amp; drop a PDF or click to browse
          </p>
        </div>
      </div>
    </div>
  );
}
