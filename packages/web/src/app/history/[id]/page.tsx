"use client";

import { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getHistoryDetail, type HistoryDetail } from "@/lib/api";
import { stageLabel } from "@/lib/constants";
import { renderMarkdown } from "@/lib/markdown";

export default function HistoryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [detail, setDetail] = useState<HistoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("summary");

  useEffect(() => {
    getHistoryDetail(id)
      .then((d) => {
        setDetail(d);
        setActiveTab("summary");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-text-dim font-mono uppercase tracking-wider">
        LOADING DATA...
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="magi-frame border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 font-mono">
        <span className="font-bold">[ERROR]</span> {error ?? "TARGET NOT FOUND"}
      </div>
    );
  }

  const tabs = [
    { key: "summary", label: "SUMMARY" },
    ...detail.stageLogs.map((sl) => ({
      key: sl.stage,
      label: stageLabel(sl.stage).toUpperCase(),
    })),
  ];

  const activeContent =
    activeTab === "summary"
      ? detail.summary
      : detail.stageLogs.find((sl) => sl.stage === activeTab)?.content ?? "";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href="/history"
          className="text-xs text-text-dim hover:text-accent transition-colors font-mono uppercase tracking-wider"
        >
          &lt;&lt; SYSTEM LOG
        </Link>
        <h1 className="text-xl font-mono font-bold">{detail.task}</h1>
        <p className="text-xs text-text-dim font-mono uppercase tracking-wider">
          {detail.startedAt
            ? new Date(detail.startedAt).toLocaleString("ja-JP")
            : "—"}
          {detail.completedAt && (
            <>
              {" >> "}
              {new Date(detail.completedAt).toLocaleString("ja-JP")}
            </>
          )}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-3 py-2 text-xs font-mono font-bold uppercase tracking-wider whitespace-nowrap transition-colors ${
              activeTab === tab.key
                ? "border-b-2 border-accent text-accent magi-glow"
                : "text-text-dim hover:text-text-primary"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <ContentPanel content={activeContent} />
    </div>
  );
}

function ContentPanel({ content }: { content: string }) {
  const rendered = useMemo(() => renderMarkdown(content), [content]);

  if (!content) {
    return (
      <div className="py-10 text-center text-text-dim text-sm font-mono uppercase tracking-wider">
        NO DATA AVAILABLE
      </div>
    );
  }

  return (
    <div className="magi-frame bg-surface p-4 max-h-[calc(100vh-320px)] overflow-y-auto overflow-x-hidden scrollbar-hidden">
      <div className="text-sm leading-relaxed text-text-primary font-mono">
        {rendered}
      </div>
    </div>
  );
}
