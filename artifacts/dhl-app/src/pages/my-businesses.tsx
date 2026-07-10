import React from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Store, Plus, ChevronRight, BadgeCheck, Pencil, Megaphone } from "lucide-react";
import { useGetMyBusinesses } from "@workspace/api-client-react";
import type { Business } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function statusBadge(status: string) {
  if (status === "pending") return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending Review</Badge>;
  if (status === "rejected") return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">Not Approved</Badge>;
  return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><BadgeCheck className="w-3 h-3 mr-1" />Approved</Badge>;
}

export default function MyBusinessesPage() {
  const [, navigate] = useLocation();
  const { data: myBusinesses = [], isLoading } = useGetMyBusinesses({
    query: { queryKey: ["my-businesses"], retry: false },
  });
  const sorted = [...myBusinesses].sort((a, b) => a.id - b.id);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl p-4 pb-24 space-y-4">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => navigate("/businesses")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-display">My Businesses</h1>
            <p className="text-sm text-muted-foreground">Manage all the businesses you run on the lake</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Store className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="font-semibold">No businesses yet</p>
            <p className="text-sm text-muted-foreground">Run a lake business? Add it and get on the map.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sorted.map((b: Business) => (
              <div key={b.id} className="rounded-2xl border border-border bg-card p-3 space-y-3" data-testid={`card-my-business-${b.id}`}>
                <Link href={`/businesses/${b.id}`} className="flex items-center gap-3" data-testid={`link-my-business-${b.id}`}>
                  {b.logoUrl ? (
                    <img src={b.logoUrl} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  ) : b.photos.length > 0 ? (
                    <img src={b.photos[0]} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                      <Store className="w-6 h-6" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{b.businessName}</p>
                    <p className="text-sm text-muted-foreground truncate">{b.businessType}</p>
                    <div className="mt-1">{statusBadge(b.status)}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate(`/businesses/me/edit?id=${b.id}`)}
                    data-testid={`button-edit-business-${b.id}`}
                  >
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                  </Button>
                  {b.status === "approved" && (
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate(`/feed?compose=1&type=announcement&businessId=${b.id}`)}
                      data-testid={`button-post-as-business-${b.id}`}
                    >
                      <Megaphone className="w-3.5 h-3.5 mr-1.5" /> Post as this business
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <Button
          variant="outline"
          className="w-full border-dashed"
          onClick={() => navigate("/businesses/me/edit?new=1")}
          data-testid="button-add-business"
        >
          <Plus className="w-4 h-4 mr-2" /> Add another business
        </Button>
      </div>
    </div>
  );
}
