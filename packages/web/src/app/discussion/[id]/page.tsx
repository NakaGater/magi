"use client";

import { use } from "react";
import { DiscussionLive } from "@/components/DiscussionLive";

export default function DiscussionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-bold">Discussion</h1>
        <span className="text-sm font-mono text-text-dim">{id}</span>
      </div>
      <DiscussionLive taskId={id} />
    </div>
  );
}
