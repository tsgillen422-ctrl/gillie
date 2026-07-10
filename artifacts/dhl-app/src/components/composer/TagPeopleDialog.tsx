import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/UserAvatar";
import { Check, Store } from "lucide-react";
import { searchUsers, useGetBusinesses, getGetBusinessesQueryKey } from "@workspace/api-client-react";
import type { User } from "@workspace/api-client-react";

export type TagSelection = {
  users: { id: number; displayName: string }[];
  businesses: { id: number; name: string }[];
};

export function TagPeopleDialog({
  open,
  onOpenChange,
  value,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  value: TagSelection;
  onConfirm: (selection: TagSelection) => void;
}) {
  const [query, setQuery] = React.useState("");
  const [userResults, setUserResults] = React.useState<User[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selUsers, setSelUsers] = React.useState<TagSelection["users"]>(value.users);
  const [selBiz, setSelBiz] = React.useState<TagSelection["businesses"]>(value.businesses);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: businesses = [] } = useGetBusinesses(undefined, {
    query: { queryKey: getGetBusinessesQueryKey(), enabled: open },
  });
  const approvedBusinesses = React.useMemo(
    () => businesses.filter((b) => b.status === "approved"),
    [businesses],
  );

  React.useEffect(() => {
    if (open) {
      setSelUsers(value.users);
      setSelBiz(value.businesses);
      setQuery("");
      setUserResults([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setUserResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const users = await searchUsers({ q: query.trim() });
        setUserResults(users.slice(0, 8));
      } catch {
        setUserResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const matchedBusinesses = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [] as typeof approvedBusinesses;
    return approvedBusinesses
      .filter((b) => b.businessName.toLowerCase().includes(q))
      .slice(0, 6);
  }, [query, approvedBusinesses]);

  const toggleUser = (u: User) => {
    setSelUsers((prev) =>
      prev.some((x) => x.id === u.id)
        ? prev.filter((x) => x.id !== u.id)
        : [...prev, { id: u.id, displayName: u.displayName || u.username || "user" }],
    );
  };

  const toggleBiz = (id: number, name: string) => {
    setSelBiz((prev) =>
      prev.some((x) => x.id === id) ? prev.filter((x) => x.id !== id) : [...prev, { id, name }],
    );
  };

  const confirm = () => {
    onConfirm({ users: selUsers, businesses: selBiz });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Tag people</DialogTitle>
          <DialogDescription>Search for friends and businesses to tag.</DialogDescription>
        </DialogHeader>
        <Input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search people or businesses…"
          data-testid="input-tag-search"
        />
        {(selUsers.length > 0 || selBiz.length > 0) && (
          <div className="flex flex-wrap gap-1.5">
            {selUsers.map((u) => (
              <button
                key={`u-${u.id}`}
                type="button"
                onClick={() => setSelUsers((prev) => prev.filter((x) => x.id !== u.id))}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
              >
                {u.displayName} <Check className="h-3 w-3" />
              </button>
            ))}
            {selBiz.map((b) => (
              <button
                key={`b-${b.id}`}
                type="button"
                onClick={() => setSelBiz((prev) => prev.filter((x) => x.id !== b.id))}
                className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2.5 py-1 text-xs font-medium text-teal-600 dark:text-teal-400"
              >
                <Store className="h-3 w-3" /> {b.name} <Check className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {loading && userResults.length === 0 && (
            <div className="px-2 py-2 text-sm text-muted-foreground">Searching…</div>
          )}
          {userResults.map((u) => {
            const checked = selUsers.some((x) => x.id === u.id);
            return (
              <button
                key={`ur-${u.id}`}
                type="button"
                onClick={() => toggleUser(u)}
                data-testid={`tag-user-${u.id}`}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover-elevate active:scale-[0.99]"
              >
                <UserAvatar
                  name={u.displayName || u.username || "User"}
                  username={u.username || ""}
                  avatarUrl={u.avatarUrl}
                  className="h-9 w-9"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {u.displayName || u.username}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">@{u.username}</span>
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {checked && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
          {matchedBusinesses.map((b) => {
            const checked = selBiz.some((x) => x.id === b.id);
            return (
              <button
                key={`br-${b.id}`}
                type="button"
                onClick={() => toggleBiz(b.id, b.businessName)}
                data-testid={`tag-business-${b.id}`}
                className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition hover-elevate active:scale-[0.99]"
              >
                {b.logoUrl ? (
                  <img src={b.logoUrl} alt="" className="h-9 w-9 rounded-full object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-500/10">
                    <Store className="h-4 w-4 text-teal-500" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{b.businessName}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {b.businessType}
                  </span>
                </span>
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    checked ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {checked && <Check className="h-3.5 w-3.5" />}
                </span>
              </button>
            );
          })}
          {!loading && query.trim() && userResults.length === 0 && matchedBusinesses.length === 0 && (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">No matches.</div>
          )}
        </div>
        <DialogFooter>
          <Button type="button" onClick={confirm} data-testid="button-confirm-tags">
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
