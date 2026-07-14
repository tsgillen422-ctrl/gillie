import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Store, Plus, ChevronRight, BadgeCheck, Pencil, Megaphone, Palette, Trash2, UserCircle2 } from "lucide-react";
import { useGetMyBusinesses, useDeleteBusiness, getGetMyBusinessesQueryKey, getGetMyBusinessQueryKey, getGetBusinessesQueryKey } from "@workspace/api-client-react";
import type { Business } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function statusBadge(b: Business) {
  if (b.isSuspended) return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">Suspended</Badge>;
  if ((b as any).isHidden) return <Badge variant="secondary" className="bg-gray-100 text-gray-600 hover:bg-gray-100">Hidden</Badge>;
  if (b.status === "pending") return <Badge variant="secondary" className="bg-amber-100 text-amber-800 hover:bg-amber-100">Pending Review</Badge>;
  if (b.status === "rejected") return <Badge variant="secondary" className="bg-red-100 text-red-700 hover:bg-red-100">Not Approved</Badge>;
  return <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100"><BadgeCheck className="w-3 h-3 mr-1" />Approved</Badge>;
}

type PendingAction = { type: "delete" | "convert"; business: Business } | null;

export default function MyBusinessesPage() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const { data: myBusinesses = [], isLoading } = useGetMyBusinesses({
    query: { queryKey: ["my-businesses"], retry: false },
  });
  const sorted = [...myBusinesses].sort((a, b) => a.id - b.id);
  const deleteBiz = useDeleteBusiness();
  const [pending, setPending] = useState<PendingAction>(null);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetMyBusinessesQueryKey() });
    qc.invalidateQueries({ queryKey: getGetMyBusinessQueryKey() });
    qc.invalidateQueries({ queryKey: getGetBusinessesQueryKey() });
    qc.invalidateQueries({ queryKey: ["my-businesses"] });
    qc.invalidateQueries({ queryKey: ["businesses"] });
  };

  const handleConfirm = () => {
    if (!pending) return;
    deleteBiz.mutate({ businessId: pending.business.id }, {
      onSuccess: () => {
        invalidate();
        toast.success(
          pending.type === "convert"
            ? "Business profile removed. Your personal Gillie account is still active."
            : "Business profile permanently deleted."
        );
        setPending(null);
      },
      onError: () => toast.error("Couldn't remove that business. Please try again."),
    });
  };

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto w-full max-w-2xl p-4 pb-24 space-y-4">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => navigate("/settings")} data-testid="button-back">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold font-display">Business Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your lake businesses</p>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading…</p>
        ) : sorted.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <Store className="w-10 h-10 mx-auto text-muted-foreground/50" />
            <p className="font-semibold">No business yet</p>
            <p className="text-sm text-muted-foreground">Run a lake business? Add it and get on the map.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {sorted.map((b: Business) => (
              <div key={b.id} className="rounded-2xl border border-border bg-card overflow-hidden" data-testid={`card-my-business-${b.id}`}>
                <Link href={`/businesses/${b.id}`} className="flex items-center gap-3 p-3" data-testid={`link-my-business-${b.id}`}>
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
                    <div className="mt-1">{statusBadge(b)}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                </Link>

                {b.isSuspended && (
                  <div className="mx-3 mb-3 rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                    This business has been suspended by an admin and is not visible to others. Contact support for more information.
                  </div>
                )}

                <div className="border-t border-border">
                  <div className="flex gap-0 divide-x divide-border">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 rounded-none h-10 text-xs font-medium"
                      onClick={() => navigate(`/businesses/me/edit?id=${b.id}`)}
                      data-testid={`button-edit-business-${b.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1.5" /> Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 rounded-none h-10 text-xs font-medium"
                      onClick={() => navigate(`/businesses/customize?id=${b.id}`)}
                      data-testid={`button-customize-business-${b.id}`}
                    >
                      <Palette className="w-3.5 h-3.5 mr-1.5" /> Customize
                    </Button>
                    {b.status === "approved" && !b.isSuspended && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="flex-1 rounded-none h-10 text-xs font-medium"
                        onClick={() => navigate(`/feed?compose=1&type=announcement&businessId=${b.id}`)}
                        data-testid={`button-post-as-business-${b.id}`}
                      >
                        <Megaphone className="w-3.5 h-3.5 mr-1.5" /> Post
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-0 divide-x divide-border border-t border-border">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 rounded-none h-10 text-xs font-medium text-muted-foreground hover:text-foreground"
                      onClick={() => setPending({ type: "convert", business: b })}
                      data-testid={`button-convert-business-${b.id}`}
                    >
                      <UserCircle2 className="w-3.5 h-3.5 mr-1.5" /> Convert to Personal
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex-1 rounded-none h-10 text-xs font-medium text-destructive hover:text-destructive hover:bg-destructive/5"
                      onClick={() => setPending({ type: "delete", business: b })}
                      data-testid={`button-delete-business-${b.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Delete
                    </Button>
                  </div>
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

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !deleteBiz.isPending && setPending(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            {pending?.type === "convert" ? (
              <>
                <AlertDialogTitle>Convert to Personal Profile?</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{pending.business.businessName}</strong>'s business page, reviews, followers, and dock sign will be removed. Your personal Gillie account stays active and nothing else changes.
                </AlertDialogDescription>
              </>
            ) : (
              <>
                <AlertDialogTitle>Delete Business Profile?</AlertDialogTitle>
                <AlertDialogDescription>
                  <strong>{pending?.business.businessName}</strong>'s business page, reviews, followers, and dock sign will be permanently deleted. Your personal Gillie account will not be affected.
                </AlertDialogDescription>
              </>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteBiz.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirm}
              disabled={deleteBiz.isPending}
            >
              {deleteBiz.isPending ? "Removing…" : pending?.type === "convert" ? "Convert to Personal" : "Delete Business"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
