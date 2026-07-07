import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { lakeById, isValidLakeId, type Lake } from "@workspace/lake-config";

/** Lakes the user has recently browsed (most recent first), for the selector.
 * Keyed per user so account switches on a shared device don't mix histories. */
const recentsKey = (userId: string | number | null | undefined) =>
  `gillie:recentLakeIds${userId != null ? `:${userId}` : ""}`;
const MAX_RECENTS = 5;

type LakeContextValue = {
  /** The lake the user is currently browsing. */
  lakeId: number;
  lake: Lake;
  setLakeId: (id: number) => void;
  /** The user's home lake (from their account), or null if unset. */
  primaryLakeId: number | null;
  /** Recently browsed lake ids, most recent first (excludes the current lake). */
  recentLakeIds: number[];
};

const LakeContext = createContext<LakeContextValue | null>(null);

function readRecents(key: string): number[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isValidLakeId).slice(0, MAX_RECENTS);
  } catch {
    return [];
  }
}

function writeRecents(key: string, ids: number[]) {
  try {
    localStorage.setItem(key, JSON.stringify(ids.slice(0, MAX_RECENTS)));
  } catch {
    // localStorage unavailable (private mode) — recents are session-only.
  }
}

/**
 * Provides the currently-selected lake. The app always opens to the user's
 * primary (home) lake; browsing another lake lasts for the session and is
 * remembered in the Recent Lakes list.
 */
export function LakeProvider({
  primaryLakeId,
  userId,
  children,
}: {
  primaryLakeId: number | null | undefined;
  userId?: string | number | null;
  children: ReactNode;
}) {
  const homeId = isValidLakeId(primaryLakeId ?? undefined) ? (primaryLakeId as number) : null;
  const storageKey = recentsKey(userId);
  const [lakeId, setLakeIdState] = useState<number>(() => lakeById(homeId).id);
  const [recentLakeIds, setRecentLakeIds] = useState<number[]>(() => readRecents(storageKey));

  const setLakeId = useCallback((id: number) => {
    const valid = lakeById(id).id;
    setLakeIdState((prev) => {
      if (prev !== valid) {
        // Remember the lake we're leaving so it shows up under Recent Lakes.
        setRecentLakeIds((old) => {
          const next = [prev, ...old.filter((x) => x !== prev && x !== valid)].slice(0, MAX_RECENTS);
          writeRecents(storageKey, next);
          return next;
        });
      }
      return valid;
    });
  }, [storageKey]);

  const value = useMemo<LakeContextValue>(
    () => ({
      lakeId,
      lake: lakeById(lakeId),
      setLakeId,
      primaryLakeId: homeId,
      recentLakeIds: recentLakeIds.filter((id) => id !== lakeId),
    }),
    [lakeId, setLakeId, homeId, recentLakeIds],
  );

  return <LakeContext.Provider value={value}>{children}</LakeContext.Provider>;
}

export function useLake(): LakeContextValue {
  const ctx = useContext(LakeContext);
  if (!ctx) throw new Error("useLake must be used inside <LakeProvider>");
  return ctx;
}
