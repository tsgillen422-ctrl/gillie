import { Ban } from "lucide-react";
import { Link } from "wouter";
import { useLogout } from "@/lib/useLogout";
import { Button } from "@/components/ui/button";

export function SuspendedGate() {
  const logout = useLogout();
  const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-background">
      <div className="mx-auto flex h-full w-full max-w-lg flex-col items-center justify-center px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] text-center">
        <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <Ban className="h-8 w-8 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Account suspended</h1>
        <p className="mt-3 text-muted-foreground">
          Your account has been suspended for violating our Community Guidelines.
          You can't use Gillie while your account is suspended.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          If you believe this was a mistake, contact us and we'll review it.
        </p>
        <div className="mt-7 w-full space-y-2.5">
          <Button asChild className="w-full" size="lg">
            <Link href="/support">Contact support</Link>
          </Button>
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={() => logout(basePath || "/")}
          >
            Sign out
          </Button>
          <Link
            href="/community-guidelines"
            className="block pt-1 text-sm text-muted-foreground underline"
          >
            Review Community Guidelines
          </Link>
        </div>
      </div>
    </div>
  );
}
