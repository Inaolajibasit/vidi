"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  markAccountAttentionSeen,
  type AccountAttentionKind,
} from "./account-attention-actions";

export function AttentionSeenMarker({
  entityIds,
  kind,
}: {
  entityIds: string[];
  kind: AccountAttentionKind;
}) {
  const router = useRouter();
  const entityKey = entityIds.join(",");

  useEffect(() => {
    const ids = entityKey ? entityKey.split(",") : [];
    if (!ids.length) return;

    void markAccountAttentionSeen(kind, ids).then((updated) => {
      if (updated) router.refresh();
    });
  }, [entityKey, kind, router]);

  return null;
}
