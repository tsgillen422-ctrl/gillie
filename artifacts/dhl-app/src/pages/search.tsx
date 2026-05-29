import React from "react";
import { Link } from "wouter";
import { useSearch } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { UserAvatar } from "@/components/UserAvatar";
import { Search as SearchIcon, MapPin, Navigation, FileText, Calendar } from "lucide-react";

function pinEmoji(type: string) {
  switch (type) {
    case "fishing_spot": return "🎣";
    case "marina": return "⛵";
    case "waterfall": return "💧";
    case "cliff": return "🏔️";
    case "campsite": return "🏕️";
    case "hazard": return "⚠️";
    default: return "📍";
  }
}

export function SearchPage() {
  const [term, setTerm] = React.useState("");
  const [debounced, setDebounced] = React.useState("");

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  const enabled = debounced.length >= 2;
  const { data, isLoading } = useSearch(
    { q: debounced },
    { query: { enabled } }
  );

  const hasResults =
    data && (data.users.length > 0 || data.pins.length > 0 || data.posts.length > 0);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border bg-card shadow-sm sticky top-0 z-10 space-y-3">
        <h1 className="text-2xl font-bold text-primary">Search</h1>
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            autoFocus
            placeholder="Search people, spots, and posts..."
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="pl-9 bg-muted border-none"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {!enabled ? (
          <div className="text-center py-16 text-muted-foreground">
            <SearchIcon className="w-12 h-12 mx-auto mb-4 text-muted" />
            <p className="text-sm">Type at least 2 characters to search.</p>
          </div>
        ) : isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)
        ) : !hasResults ? (
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-sm">No results for "{debounced}".</p>
          </div>
        ) : (
          <>
            {data!.users.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">People</h2>
                {data!.users.map((u) => (
                  <Link key={u.id} href={`/profile/${u.id}`}>
                    <Card className="hover-elevate border-border/50">
                      <CardContent className="p-3 flex items-center gap-3">
                        <UserAvatar name={u.displayName} username={u.username} avatarUrl={u.avatarUrl} className="w-10 h-10" />
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm truncate">{u.displayName}</h3>
                          <p className="text-xs text-muted-foreground truncate">@{u.username}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </section>
            )}

            {data!.pins.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Spots</h2>
                {data!.pins.map((p) => (
                  <Link key={p.id} href={`/map?lat=${p.lat}&lng=${p.lng}`}>
                    <Card className="hover-elevate border-border/50">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl shrink-0">{pinEmoji(p.type)}</div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm truncate">{p.title}</h3>
                          {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                        </div>
                        <Navigation className="w-4 h-4 text-primary shrink-0" />
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </section>
            )}

            {data!.posts.length > 0 && (
              <section className="space-y-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Posts & Events</h2>
                {data!.posts.map((p) => (
                  <Link key={p.id} href="/feed">
                    <Card className="hover-elevate border-border/50">
                      <CardContent className="p-3 flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          {p.postType === "event" ? <Calendar className="w-5 h-5 text-primary" /> : <FileText className="w-5 h-5 text-primary" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm truncate">{p.title}</h3>
                          {p.content && <p className="text-xs text-muted-foreground truncate">{p.content}</p>}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
