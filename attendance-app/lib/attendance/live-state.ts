export interface LiveEntry {
  rosterId: string;
  displayName: string;
  recordedAt: string;
}

export interface LiveSnapshot {
  sessionId: string;
  state: string;
  serverTime: string;
  checkinEndsAt: string;
  entries: LiveEntry[];
  total: number;
}

export interface LiveSnapshotReconciliation {
  snapshot: LiveSnapshot;
  newRosterIds: string[];
}

export function getRetryDelaySeconds(failureCount: number): number {
  const exponent = Math.max(0, Math.floor(failureCount) - 1);
  return Math.min(2 ** exponent, 5);
}

export function reconcileLiveSnapshot(
  previous: LiveSnapshot | null,
  incoming: LiveSnapshot,
): LiveSnapshotReconciliation {
  const previousRosterIds = new Set(
    previous?.entries.map(({ rosterId }) => rosterId) ?? [],
  );

  return {
    snapshot: incoming,
    newRosterIds: incoming.entries
      .filter(({ rosterId }) => !previousRosterIds.has(rosterId))
      .map(({ rosterId }) => rosterId),
  };
}
