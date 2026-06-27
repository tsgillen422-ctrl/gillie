import React from "react";
import { Capacitor } from "@capacitor/core";
import { useQueryClient } from "@tanstack/react-query";
import { useAcceptWaiver, getGetMeQueryKey } from "@workspace/api-client-react";
import { useLogout } from "@/lib/useLogout";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { WAIVER_VERSION, WaiverBody } from "@/lib/waiver";

export function WaiverGate() {
  const acceptWaiver = useAcceptWaiver();
  const qc = useQueryClient();
  const logout = useLogout();
  const { toast } = useToast();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleAgree = () => {
    acceptWaiver.mutate(
      { data: { version: WAIVER_VERSION } },
      {
        onSuccess: () => {
          qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
        },
        onError: () => {
          toast({
            title: "Couldn't save your agreement",
            description: "Please check your connection and try again.",
            variant: "destructive",
          });
        },
      },
    );
  };

  const handleExit = () => {
    if (Capacitor.isNativePlatform()) {
      const nav = navigator as unknown as { app?: { exitApp?: () => void } };
      if (nav.app?.exitApp) {
        nav.app.exitApp();
        return;
      }
    }
    logout(basePath || "/");
  };

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background">
      <div className="mx-auto flex h-full w-full max-w-lg flex-col px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div className="shrink-0 pb-4 text-center">
          <h1 className="text-2xl font-bold text-primary">Welcome to Gillie! 🎣</h1>
        </div>

        <ScrollArea className="min-h-0 flex-1 rounded-xl border border-border bg-card">
          <div className="p-5">
            <WaiverBody />
          </div>
        </ScrollArea>

        <div className="shrink-0 space-y-2.5 pt-4">
          <Button
            className="w-full"
            size="lg"
            onClick={handleAgree}
            disabled={acceptWaiver.isPending}
          >
            {acceptWaiver.isPending ? "Saving…" : "I Agree"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleExit}
            disabled={acceptWaiver.isPending}
          >
            Exit App
          </Button>
        </div>
      </div>
    </div>
  );
}
