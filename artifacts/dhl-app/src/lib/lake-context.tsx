import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { lakeById, isValidLakeId, type Lake } from "@workspace/lake-config";

const STORAGE_KEY = "gillie:selectedLakeId";

type LakeContextValue = {
  /** The lake the user is currently browsing. */
  lakeId: number;
  lake: Lake;
  setLakeId: (id: number) => void;
};

const LakeContext = createContext<LakeContextValue | null>(null);

function readStoredLakeId(): number | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const n = Number(raw);
    return isValidLakeId(n) ? n : null;
  } catch {
    return null;
  }
}

/**
 * Provides the currently-selected lake. The initial selection is the last
 * lake the user browsed on this device (localStorage), falling back to their
 * primary (home) lake from the account.
 */
export function LakeProvider({ primaryLakeId, children }: { primaryLakeId: number | null | undefined; children: ReactNode }) {
  const [lakeId, setLakeIdState] = useState<number>(() => {
    const stored = readStoredLakeId();
    if (stored != null) return stored;
    return lakeById(primaryLakeId ?? null).id;
  });

  const setLakeId = useCallback((id: number) => {
    const valid = lakeById(id).id;
    setLakeIdState(valid);
    try {
      localStorage.setItem(STORAGE_KEY, String(valid));
    } catch {
      // localStorage unavailable (private mode) — selection is session-only.
    }
  }, []);

  const value = useMemo<LakeContextValue>(
    () => ({ lakeId, lake: lakeById(lakeId), setLakeId }),
    [lakeId, setLakeId],
  );

  return <LakeContext.Provider value={value}>{children}</LakeContext.Provider>;
}

export function useLake(): LakeContextValue {
  const ctx = useContext(LakeContext);
  if (!ctx) throw new Error("useLake must be used inside <LakeProvider>");
  return ctx;
}
