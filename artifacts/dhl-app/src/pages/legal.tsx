import { Link } from "wouter";
import { useAuth } from "@clerk/react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PrivacyPolicyBody,
  CommunityGuidelinesBody,
  TermsOfServiceBody,
} from "@/lib/legal";

function LegalPageShell({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  // These pages are reachable both from in-app Settings (signed in) and from
  // the public Support page (signed out). Send the back button somewhere that
  // exists for the viewer instead of a gated /settings dead-end.
  const { isSignedIn } = useAuth();
  const backHref = isSignedIn ? "/settings" : "/support";
  return (
    <div className="flex flex-col h-full bg-muted/20 overflow-y-auto">
      <div
        className="px-4 pb-4 border-b border-border bg-card shadow-sm sticky top-0 z-10 flex items-center gap-3"
        style={{ paddingTop: "max(env(safe-area-inset-top), 1rem)" }}
      >
        <Link href={backHref}>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Back"
            className="h-11 w-11 shrink-0"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <h1 className="text-2xl font-bold text-primary">{title}</h1>
      </div>

      <div className="p-5 max-w-md mx-auto w-full pb-20">{children}</div>
    </div>
  );
}

export function PrivacyPolicyPage() {
  return (
    <LegalPageShell title="Privacy Policy">
      <PrivacyPolicyBody />
    </LegalPageShell>
  );
}

export function CommunityGuidelinesPage() {
  return (
    <LegalPageShell title="Community Guidelines">
      <CommunityGuidelinesBody />
    </LegalPageShell>
  );
}

export function TermsOfServicePage() {
  return (
    <LegalPageShell title="Terms of Service">
      <TermsOfServiceBody />
    </LegalPageShell>
  );
}
