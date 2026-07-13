import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useGetMe,
  useCheckInLocation,
  useCheckOutLocation,
  useSetLakeStatus,
  getGetMeQueryKey,
  getGetFriendLocationsQueryKey,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { MapPin, Loader2, Clock, Users, ShieldCheck, Ghost, Ship, Eye } from "lucide-react";
import { useLake } from "@/lib/lake-context";

// How long the sharing window lasts without any app activity before the user
// auto-ghosts. Mirrors the server (PASSIVE_WINDOW_HOURS); using the app slides
// the window forward, so sharing continues seamlessly for active users.
const SHARE_WINDOW_HOURS = 24;

// Custom icon for the map's quick Ghost control: a ghost driving a boat
// (ghost with wavy bottom at a helm wheel, on a hull). Drawn lucide-style so
// it matches the other map control icons.
function GhostBoatIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M4.6 16.5V7.9a3.9 3.9 0 0 1 7.8 0v8.6l-1.95-1.5-1.95 1.5-1.95-1.5-1.95 1.5z" />
      <circle cx="7.1" cy="8.1" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="9.8" cy="8.1" r="0.7" fill="currentColor" stroke="none" />
      <circle cx="17.6" cy="13.6" r="2.4" />
      <path d="M17.6 11.2v4.8M15.2 13.6h4.8" />
      <path d="M17.6 16v1.5" />
      <path d="M1.5 17.5h21l-1.8 2.8a2.2 2.2 0 0 1-1.84 1H5.14a2.2 2.2 0 0 1-1.84-1L1.5 17.5z" />
    </svg>
  );
}

// Quick live-status options. Friends see this next to your boat on the map.
const LAKE_STATUSES = [
  "Out on the Water",
  "Fishing 🎣",
  "Cruising 🚤",
  "At the Sandbar 🏖️",
  "Docked for Lunch 🍔",
  "Sunset Ride 🌅",
];

/**
 * Apple 5.1.2 location sharing control (Snapchat-style passive sharing).
 * Sharing starts only after the user reads and confirms an explicit consent
 * dialog. Once on, their position updates while they use the app, their marker
 * stays visible with a "last seen" time when the app is closed, and they
 * auto-ghost after 24 hours away. Ghost Mode hides them instantly, anytime.
 * Variants: "card" (Settings — full opt-in/consent flow + Ghost Mode) and
 * "map-ghost" (map controls — a small one-tap Go Ghost icon shown only while
 * sharing is active; opting IN always happens via Settings' consent screen).
 */
export function CheckInControl({ variant = "card" }: { variant?: "card" | "map-ghost" }) {
  const { data: me } = useGetMe();
  const { lakeId } = useLake();
  const qc = useQueryClient();
  const checkIn = useCheckInLocation();
  const checkOut = useCheckOutLocation();
  const setLakeStatusMutation = useSetLakeStatus();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const [selectedBoatId, setSelectedBoatId] = useState<number | null>(null);
  const [lakeStatus, setLakeStatus] = useState<string | null>(null);

  const fleet: any[] = (me as any)?.fleet ?? [];
  // A previously selected boat may have been deleted in Settings — only honor
  // the selection while it still exists in the fleet, otherwise fall back to
  // the primary boat.
  const validSelectedId = fleet.some((b) => b.id === selectedBoatId) ? selectedBoatId : null;
  const defaultBoatId = fleet.length > 0 ? (fleet.find((b) => b.isPrimary) ?? fleet[0]).id : null;
  const effectiveBoatId = validSelectedId ?? defaultBoatId;
  // The opt-in is what the user controls; the sharing window renews itself
  // whenever they use the app, so "opted in" is the state we present.
  const isSharing = !!me?.shareLocation || !!me?.isSharingLocation;

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    qc.invalidateQueries({ queryKey: getGetFriendLocationsQueryKey() });
  };

  const performOptIn = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    const boatId = effectiveBoatId ?? undefined;
    // The geolocation `timeout` option doesn't tick while a permission prompt
    // is unanswered, so an ignored prompt would leave the dialog stuck on
    // "Locating…" forever. This hard timer guarantees the UI recovers.
    let settled = false;
    const failsafe = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      setLocating(false);
      toast.error("Couldn't get your location. Check location permissions and try again.");
    }, 20000);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(failsafe);
        checkIn.mutate(
          {
            data: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              durationHours: SHARE_WINDOW_HOURS,
              lakeId,
              ...(boatId ? { boatId } : {}),
            },
          },
          {
            onSuccess: () => {
              // Best-effort: publish the chosen live status alongside the opt-in.
              if (lakeStatus) {
                setLakeStatusMutation.mutate(
                  { data: { lakeStatus } },
                  { onSettled: () => invalidate() },
                );
              }
              invalidate();
              toast.success("You're on the map — approved friends can see you.");
            },
            onError: () => toast.error("Couldn't turn on sharing. Please try again."),
            onSettled: () => {
              setLocating(false);
              setConfirmOpen(false);
            },
          }
        );
      },
      () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(failsafe);
        setLocating(false);
        setConfirmOpen(false);
        toast.error("Location permission is needed to appear on the map.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const performGhost = () => {
    checkOut.mutate(undefined, {
      onSuccess: () => {
        invalidate();
        toast.success("Ghost Mode is on — you're hidden from the map.");
      },
      onError: () => toast.error("Couldn't turn on Ghost Mode. Please try again."),
    });
  };

  const confirmDialog = (
    <Dialog open={confirmOpen} onOpenChange={(o) => !locating && setConfirmOpen(o)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Share your location?
          </DialogTitle>
          <DialogDescription>
            Here's exactly how location sharing works:
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 text-sm text-foreground">
          <li className="flex gap-2.5">
            <Users className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>Only friends you've approved can see your boat on the lake map. It's never public.</span>
          </li>
          <li className="flex gap-2.5">
            <Eye className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>Your position updates while the app is open. When you close it, friends see your last location with a "last seen" time.</span>
          </li>
          <li className="flex gap-2.5">
            <Clock className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>If you don't open the app for {SHARE_WINDOW_HOURS} hours, you disappear from the map automatically.</span>
          </li>
          <li className="flex gap-2.5">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>Stop sharing any time by turning Location Sharing off in Settings, or use Ghost Mode to immediately remove your boat from the map.</span>
          </li>
        </ul>
        {fleet.length > 1 && (
          <div className="space-y-2">
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Ship className="h-4 w-4 text-primary" /> Which boat are you taking out?
            </p>
            <div className="flex flex-wrap gap-1.5">
              {fleet.map((b) => {
                const active = effectiveBoatId === b.id;
                return (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setSelectedBoatId(b.id)}
                    disabled={locating}
                    className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                    data-testid={`button-checkin-boat-${b.id}`}
                  >
                    <span className="inline-block w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: b.color || "#0ea5e9" }} />
                    {b.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div className="space-y-2">
          <p className="text-sm font-semibold">What are you up to? <span className="font-normal text-muted-foreground">(optional)</span></p>
          <div className="flex flex-wrap gap-1.5">
            {LAKE_STATUSES.map((s) => {
              const active = lakeStatus === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setLakeStatus(active ? null : s)}
                  disabled={locating}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${active ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                  data-testid={`button-lake-status-${s}`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={locating} data-testid="button-share-cancel">
            Not Now
          </Button>
          <Button onClick={performOptIn} disabled={locating} data-testid="button-share-confirm">
            {locating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Locating…
              </>
            ) : (
              "Share My Location"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (variant === "map-ghost") {
    // Quick privacy control for the map: visible only while sharing is
    // active, one tap goes Ghost instantly. Turning sharing back ON is done
    // from Settings (behind the consent screen), keeping the map clean.
    if (!isSharing) return null;
    return (
      <Button
        size="icon"
        className="h-10 w-10 rounded-full shadow-md bg-card text-foreground border border-border hover:bg-muted relative"
        onClick={performGhost}
        disabled={checkOut.isPending}
        aria-label="Go Ghost — hide my location"
        data-testid="button-ghost-mode"
      >
        {checkOut.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <GhostBoatIcon className="!h-6 !w-6" />
        )}
        <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500 border border-card" />
        </span>
      </Button>
    );
  }

  // Card variant (Settings)
  return (
    <>
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div
            className={`p-2 rounded-full ${
              isSharing ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
            }`}
          >
            {isSharing ? <MapPin className="w-5 h-5" /> : <Ghost className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground leading-tight">
              {isSharing ? "You're on the map" : "Ghost Mode — you're hidden"}
            </p>
            <p className="text-sm text-muted-foreground leading-tight">
              {isSharing
                ? "Visible to approved friends · updates while you use the app"
                : "Your boat is hidden from the map"}
            </p>
          </div>
        </div>

        {isSharing ? (
          <Button
            variant="secondary"
            className="w-full"
            onClick={performGhost}
            disabled={checkOut.isPending}
            data-testid="button-ghost-mode"
          >
            {checkOut.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Ghost className="h-4 w-4 mr-2" />
            )}
            Turn On Ghost Mode
          </Button>
        ) : (
          <Button className="w-full" onClick={() => setConfirmOpen(true)} data-testid="button-share-location">
            <MapPin className="h-4 w-4 mr-2" /> Share My Location
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Sharing is optional and only visible to approved friends. Stop sharing any time by
          turning Location Sharing off, or use Ghost Mode to immediately remove your boat from
          the map.
        </p>
      </div>
      {confirmDialog}
    </>
  );
}
