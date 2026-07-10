import React from "react";
import { Link } from "wouter";
import { Search, Store, ChevronRight, Plus, BadgeCheck, Users, Star } from "lucide-react";
import { useGetBusinesses, useGetMyBusinesses } from "@workspace/api-client-react";
import type { Business } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLake } from "@/lib/lake-context";

function statusBadge(status: string) {
  if (status === "pending") return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending Review</Badge>;
  if (status === "rejected") return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">Not Approved</Badge>;
  return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><BadgeCheck className="w-3 h-3 mr-1" />Approved</Badge>;
}

export default function BusinessesPage() {
  const { lakeId } = useLake();
  const [query, setQuery] = React.useState("");
  const { data: businesses = [], isLoading } = useGetBusinesses(
    { lakeId },
    { query: { queryKey: ["businesses", lakeId] } },
  );
  const { data: myBusinesses = [] } = useGetMyBusinesses({
    query: { queryKey: ["my-businesses"], retry: false },
  });
  const ownsAny = myBusinesses.length > 0;
  const notApproved = myBusinesses.filter((b: Business) => b.status !== "approved");

  const q = query.trim().toLowerCase();
  const filtered = q
    ? businesses.filter((b: Business) =>
        [b.businessName, b.businessType, b.description ?? "", b.serviceArea ?? ""]
          .some((f) => f.toLowerCase().includes(q)),
      )
    : businesses;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl p-4 pb-24 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-bold font-display">Businesses</h1>
            <p className="text-sm text-muted-foreground">Marinas, guides, rentals & more on the lake</p>
          </div>
          <Button asChild size="sm" variant={ownsAny ? "outline" : "default"} data-testid="button-my-business">
            <Link href={ownsAny ? "/my-businesses" : "/businesses/me/edit?new=1"}>
              {ownsAny ? <Store className="w-4 h-4 mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
              {ownsAny ? (myBusinesses.length > 1 ? "My Businesses" : "My Business") : "Add Yours"}
            </Link>
          </Button>
        </div>

        {notApproved.map((b: Business) => (
          <Link key={b.id} href={`/businesses/me/edit?id=${b.id}`} className="block">
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-center justify-between gap-2">
              <span>
                <span className="font-semibold">{b.businessName}</span>{" "}
                {b.status === "pending"
                  ? "is pending review. It will appear publicly once an admin approves it."
                  : "was not approved. Update your listing and resubmit."}
              </span>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </div>
          </Link>
        ))}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, type, or service…"
            className="pl-9 rounded-xl"
            data-testid="input-business-search"
          />
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading businesses…</p>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Store className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="font-semibold">{q ? "No businesses match your search" : "No businesses yet"}</p>
            <p className="text-sm text-muted-foreground">
              {q ? "Try a different name or service." : "Run a lake business? Add yours and get on the map."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((b: Business) => (
              <Link key={b.id} href={`/businesses/${b.id}`} className="block" data-testid={`card-business-${b.id}`}>
                <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 hover:bg-muted/50 transition-colors">
                  {b.logoUrl ? (
                    <img src={b.logoUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  ) : b.photos.length > 0 ? (
                    <img src={b.photos[0]} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Store className="w-6 h-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate flex items-center gap-1">
                      <span className="truncate">{b.businessName}</span>
                      {b.verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
                    </h3>
                    <p className="text-xs text-muted-foreground truncate">{b.businessType}</p>
                    <p className="text-xs text-muted-foreground truncate flex items-center gap-2 mt-0.5">
                      <span className="flex items-center gap-0.5">
                        <Users className="w-3 h-3 shrink-0" /> {b.followerCount ?? 0}
                      </span>
                      {(b.reviewCount ?? 0) > 0 && (
                        <span className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 shrink-0 fill-amber-400 text-amber-400" /> {(b.avgRating ?? 0).toFixed(1)}
                        </span>
                      )}
                      {b.serviceArea && <span className="truncate">{b.serviceArea}</span>}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
