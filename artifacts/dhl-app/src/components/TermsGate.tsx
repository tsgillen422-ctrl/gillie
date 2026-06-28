import React from "react";
import { Capacitor } from "@capacitor/core";
import { Link } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { useAcceptTerms, getGetMeQueryKey } from "@workspace/api-client-react";
import { FileText, Lock, ShieldCheck, ChevronRight } from "lucide-react";
import { useLogout } from "@/lib/useLogout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { TERMS_VERSION } from "@/lib/legal";

const DOCS = [
  { href: "/terms", label: "Terms of Service", icon: FileText },
  { href: "/privacy-policy", label: "Privacy Policy", icon: Lock },
  { href: "/community-guidelines", label: "Community Guidelines", icon: ShieldCheck },
] as const;

export function TermsGate() {
  const acceptTerms = useAcceptTerms();
  const qc = useQueryClient();
  const logout = useLogout();
  const { toast } = useToast();
  const [agreed, setAgreed] = React.useState(false);
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  const handleAgree = () => {
    if (!agreed) return;
    acceptTerms.mutate(
      { data: { version: TERMS_VERSION } },
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
          <h1 className="text-2xl font-bold text-primary">Before you get started</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Please review and agree to the documents below to use Gillie.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-border bg-card p-2">
          <ul className="divide-y divide-border">
            {DOCS.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <Link
                  href={href}
                  className="flex items-center justify-between gap-3 rounded-lg p-3 transition hover:bg-muted/60"
                  data-testid={`terms-gate-link-${href.replace(/\//g, "")}`}
                >
                  <span className="flex items-center gap-3">
                    <span className="rounded-full bg-primary/10 p-2 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-semibold">{label}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="shrink-0 space-y-3 pt-4">
          <label
            htmlFor="terms-agree"
            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4"
          >
            <Checkbox
              id="terms-agree"
              checked={agreed}
              onCheckedChange={(v) => setAgreed(v === true)}
              className="mt-0.5"
              data-testid="checkbox-terms-agree"
            />
            <span className="text-sm leading-relaxed text-foreground">
              I agree to the Terms of Service, Privacy Policy, and Community
              Guidelines.
            </span>
          </label>

          <Button
            className="w-full"
            size="lg"
            onClick={handleAgree}
            disabled={!agreed || acceptTerms.isPending}
            data-testid="button-terms-agree"
          >
            {acceptTerms.isPending ? "Saving…" : "Agree & Continue"}
          </Button>
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleExit}
            disabled={acceptTerms.isPending}
            data-testid="button-terms-exit"
          >
            Exit App
          </Button>
        </div>
      </div>
    </div>
  );
}
