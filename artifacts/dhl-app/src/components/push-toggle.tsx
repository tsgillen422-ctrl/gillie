import React from "react";
import { Button } from "@/components/ui/button";
import { Bell, BellOff, BellRing } from "lucide-react";
import { toast } from "sonner";
import {
  isPushSupported,
  isPushEnabled,
  enablePush,
  disablePush,
} from "@/lib/push";

export function PushToggle() {
  const [supported, setSupported] = React.useState(false);
  const [enabled, setEnabled] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    const s = isPushSupported();
    setSupported(s);
    if (s) {
      isPushEnabled()
        .then(setEnabled)
        .catch(() => {});
    }
  }, []);

  if (!supported) return null;

  const handleEnable = async () => {
    setBusy(true);
    try {
      await enablePush();
      setEnabled(true);
      toast.success("Push alerts on — you'll be notified even when the app is closed.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg === "denied") {
        toast.error("Notifications are blocked. Enable them in your browser settings.");
      } else {
        toast.error("Couldn't enable push alerts.");
      }
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setBusy(true);
    try {
      await disablePush();
      setEnabled(false);
      toast.success("Push alerts turned off.");
    } catch {
      toast.error("Couldn't turn off push alerts.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-4 border-b border-border bg-card flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="shrink-0 p-2 bg-primary/10 rounded-full">
          {enabled ? (
            <BellRing className="w-5 h-5 text-primary" />
          ) : (
            <Bell className="w-5 h-5 text-muted-foreground" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Push notifications</p>
          <p className="text-xs text-muted-foreground">
            {enabled
              ? "On for this device."
              : "Get alerts on this device, even when the app is closed."}
          </p>
        </div>
      </div>
      {enabled ? (
        <Button
          variant="outline"
          size="sm"
          disabled={busy}
          onClick={handleDisable}
          className="shrink-0"
        >
          <BellOff className="w-4 h-4 mr-1" /> Turn off
        </Button>
      ) : (
        <Button size="sm" disabled={busy} onClick={handleEnable} className="shrink-0">
          Enable
        </Button>
      )}
    </div>
  );
}
