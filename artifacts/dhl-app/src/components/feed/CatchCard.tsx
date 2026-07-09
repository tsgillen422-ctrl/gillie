import React from "react";
import { useLocation } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { resolveImageSrc } from "@/lib/assets";
import { Card, CardContent } from "@/components/ui/card";
import { UserAvatar } from "@/components/UserAvatar";
import { Scale, Fish, Anchor } from "lucide-react";
import { ClickableImage } from "@/components/ClickableImage";

export function CatchCard({ catchData, href }: { catchData: any; href?: string }) {
  const [, navigate] = useLocation();
  if (!catchData) return null;

  // Tapping the card (outside the zoomable photo, which stops propagation)
  // deep-links to the catch on the Catches page.
  const clickable = Boolean(href);

  return (
    <Card
      onClick={clickable ? () => navigate(href!) : undefined}
      onKeyDown={
        clickable
          ? (e: React.KeyboardEvent) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                navigate(href!);
              }
            }
          : undefined
      }
      role={clickable ? "link" : undefined}
      aria-label={clickable ? `View ${catchData.species || "catch"} by ${catchData.user?.displayName || "angler"}` : undefined}
      tabIndex={clickable ? 0 : undefined}
      data-testid={clickable ? `card-catch-${catchData.id}` : undefined}
      className={`mb-4 overflow-hidden rounded-2xl border-none shadow-soft transition-all hover:shadow-soft-lg bg-card ${clickable ? "cursor-pointer active:scale-[0.99]" : ""}`}
    >
      <div className="flex flex-col">
        {/* Media Full Bleed */}
        {catchData.imageUrl ? (
          <div className="relative aspect-[4/5] w-full overflow-hidden bg-muted">
            <ClickableImage
              src={resolveImageSrc(catchData.imageUrl)}
              alt="Catch"
              className="h-full w-full object-cover"
            />
            {/* Overlay Gradient for Text */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            
            {/* Bottom Overlay Info */}
            <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
              <div className="flex items-center gap-2 mb-2">
                <Fish className="h-5 w-5 text-accent" />
                <span className="text-xl font-bold font-display tracking-tight drop-shadow-sm">
                  {catchData.species || "Unknown Species"}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium drop-shadow-sm">
                {catchData.weight && (
                  <div className="flex items-center gap-1.5">
                    <Scale className="h-4 w-4 opacity-80" />
                    <span>{catchData.weight} lbs</span>
                  </div>
                )}
                {catchData.length && (
                  <div className="flex items-center gap-1.5">
                    <span className="opacity-80 leading-none text-base">📏</span>
                    <span>{catchData.length} in</span>
                  </div>
                )}
                {catchData.lure && (
                  <div className="flex items-center gap-1.5 bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-md">
                    <span>{catchData.lure}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 pb-0">
            <div className="flex items-center gap-2 mb-2">
              <Fish className="h-5 w-5 text-primary" />
              <span className="text-xl font-bold font-display">
                {catchData.species || "Unknown Species"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm font-medium text-muted-foreground">
              {catchData.weight && (
                <div className="flex items-center gap-1.5">
                  <Scale className="h-4 w-4" />
                  <span>{catchData.weight} lbs</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* User Info & Actions Footer */}
        <CardContent className="p-4 pt-3 border-t border-border/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar
                name={catchData.user?.displayName || "Angler"}
                username={catchData.user?.username || ""}
                avatarUrl={catchData.user?.avatarUrl}
                className="h-10 w-10 shrink-0 shadow-sm"
              />
              <div className="min-w-0 flex flex-col">
                <span className="text-sm font-semibold truncate text-foreground">
                  {catchData.user?.displayName || "Angler"}
                </span>
                <span className="text-[11px] text-muted-foreground font-medium">
                  {catchData.caughtAt ? formatDistanceToNow(new Date(catchData.caughtAt), { addSuffix: true }) : "Recently"}
                </span>
              </div>
            </div>
          </div>
          
          {catchData.notes && (
            <p className="mt-3 text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {catchData.notes}
            </p>
          )}
        </CardContent>
      </div>
    </Card>
  );
}
