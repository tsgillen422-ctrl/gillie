import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  useGetMe,
  useCheckInLocation,
  useCheckOutLocation,
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
import { MapPin, MapPinOff, Loader2, Clock, Users, ShieldCheck, X } from "lucide-react";

// How long a check-in lasts. Mirrors the server default (CHECKIN_DEFAULT_HOURS)
// so the confirmation copy matches reality.
const CHECKIN_HOURS = 6;

function remainingLabel(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return null;
  const mins = Math.round(ms / 60000);
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}m left` : `${h}h left`;
  }
  return `${Math.max(1, mins)}m left`;
}

/**
 * Apple 5.1.2 manual location sharing control. The user must explicitly confirm
 * a check-in before their location is published, can stop at any time, and the
 * check-in auto-expires. Shared by the map (compact) and Settings (card).
 */
export function CheckInControl({ variant = "card" }: { variant?: "card" | "compact" }) {
  const { data: me } = useGetMe();
  const qc = useQueryClient();
  const checkIn = useCheckInLocation();
  const checkOut = useCheckOutLocation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  // Re-render every 30s so the "time left" label stays current.
  const [, setTick] = useState(0);

  const isSharing = !!me?.isSharingLocation;
  const remaining = remainingLabel(me?.locationSharingExpiresAt);

  useEffect(() => {
    if (!isSharing) return;
    const id = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [isSharing]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
    qc.invalidateQueries({ queryKey: getGetFriendLocationsQueryKey() });
  };

  const performCheckIn = () => {
    if (!navigator.geolocation) {
      toast.error("Location isn't available on this device.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        checkIn.mutate(
          { data: { lat: pos.coords.latitude, lng: pos.coords.longitude } },
          {
            onSuccess: () => {
              invalidate();
              toast.success("Checked in — approved friends can see you on the map.");
            },
            onError: () => toast.error("Couldn't check in. Please try again."),
            onSettled: () => {
              setLocating(false);
              setConfirmOpen(false);
            },
          }
        );
      },
      () => {
        setLocating(false);
        setConfirmOpen(false);
        toast.error("Location permission is needed to check in.");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    );
  };

  const performCheckOut = () => {
    checkOut.mutate(undefined, {
      onSuccess: () => {
        invalidate();
        toast.success("You've stopped sharing your location.");
      },
      onError: () => toast.error("Couldn't stop sharing. Please try again."),
    });
  };

  const confirmDialog = (
    <Dialog open={confirmOpen} onOpenChange={(o) => !locating && setConfirmOpen(o)}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Share My Location
          </DialogTitle>
          <DialogDescription>
            Before you check in, here's what happens:
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-3 text-sm text-foreground">
          <li className="flex gap-2.5">
            <Users className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>Your live location will be visible to approved friends on the map.</span>
          </li>
          <li className="flex gap-2.5">
            <Clock className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>Sharing automatically ends after {CHECKIN_HOURS} hours, or when you close the app.</span>
          </li>
          <li className="flex gap-2.5">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <span>Sharing is optional. You can stop at any time, and you'll need to check in again each time you want to share.</span>
          </li>
        </ul>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={locating}>
            Cancel
          </Button>
          <Button onClick={performCheckIn} disabled={locating}>
            {locating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Locating…
              </>
            ) : (
              "Check In"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (variant === "compact") {
    return (
      <>
        {isSharing ? (
          <div className="flex items-center gap-2 rounded-full bg-card/95 backdrop-blur shadow-lg border border-border pl-3 pr-1.5 py-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Sharing{remaining ? ` · ${remaining}` : ""}
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="h-7 rounded-full px-3 text-xs"
              onClick={performCheckOut}
              disabled={checkOut.isPending}
            >
              <X className="h-3.5 w-3.5 mr-1" /> Stop
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            className="rounded-full shadow-lg h-9 px-4"
            onClick={() => setConfirmOpen(true)}
          >
            <MapPin className="h-4 w-4 mr-1.5" /> Check In
          </Button>
        )}
        {confirmDialog}
      </>
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
            {isSharing ? <MapPin className="w-5 h-5" /> : <MapPinOff className="w-5 h-5" />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-foreground leading-tight">
              {isSharing ? "Checked in — sharing location" : "Not sharing location"}
            </p>
            <p className="text-sm text-muted-foreground leading-tight">
              {isSharing
                ? remaining
                  ? `Visible to approved friends · ${remaining}`
                  : "Visible to approved friends"
                : "Your boat is hidden from the map"}
            </p>
          </div>
        </div>

        {isSharing ? (
          <Button
            variant="destructive"
            className="w-full"
            onClick={performCheckOut}
            disabled={checkOut.isPending}
          >
            {checkOut.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <MapPinOff className="h-4 w-4 mr-2" />
            )}
            Stop Sharing Location
          </Button>
        ) : (
          <Button className="w-full" onClick={() => setConfirmOpen(true)}>
            <MapPin className="h-4 w-4 mr-2" /> Check In / Share My Location
          </Button>
        )}

        <p className="text-xs text-muted-foreground">
          Your location is only shared when you check in. It's never shared automatically, and
          you'll need to check in again each time. Sharing ends automatically after {CHECKIN_HOURS}{" "}
          hours or when you close the app.
        </p>
      </div>
      {confirmDialog}
    </>
  );
}
