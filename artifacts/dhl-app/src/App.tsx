import { useEffect, useRef, useState, type FormEvent } from "react";
import { ClerkProvider, SignIn, SignUp, Show } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, Redirect, useLocation, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useClerk } from "@clerk/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppLayout } from "@/components/AppLayout";
import { Onboarding } from "@/components/Onboarding";
import { WaiverGate } from "@/components/WaiverGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetMe, useCheckOutLocation, getGetMeQueryKey } from "@workspace/api-client-react";
import { WAIVER_VERSION } from "@/lib/waiver";

import { LandingPage } from "@/pages/landing";
import { MapPage } from "@/pages/map";
import { FeedPage } from "@/pages/feed";
import { ExplorePage } from "@/pages/explore";
import { MessagesPage } from "@/pages/messages";
import { MessageThreadPage } from "@/pages/message-thread";
import { MessageSettingsPage } from "@/pages/message-settings";
import { FriendsPage } from "@/pages/friends";
import { PinsPage } from "@/pages/pins";
import { SettingsPage } from "@/pages/settings";
import { SettingsDetailPage } from "@/pages/settings-detail";
import { NotificationsPage } from "@/pages/notifications";
import { ProfilePage } from "@/pages/profile";
import { CatchesPage } from "@/pages/catches";
import { TieUpsPage } from "@/pages/tie-ups";
import { BoatsPage } from "@/pages/boats";
import { SearchPage } from "@/pages/search";
import { AdminPage } from "@/pages/admin";
import { PrivacyPolicyPage, CommunityGuidelinesPage, TermsOfServicePage } from "@/pages/legal";
import { TermsGate } from "@/components/TermsGate";
import { SuspendedGate } from "@/components/SuspendedGate";
import { TERMS_VERSION } from "@/lib/legal";
import { SupportPage } from "@/pages/support";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

// REQUIRED — copy verbatim. Resolves the key from window.location.hostname so the
// same build serves multiple Clerk custom domains.
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);

// REQUIRED — copy verbatim. Empty in dev, auto-set in prod.
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#0b7d9b",
    colorForeground: "#0f2730",
    colorMutedForeground: "#5a7480",
    colorDanger: "#dc2626",
    colorBackground: "#ffffff",
    colorInput: "#ffffff",
    colorInputForeground: "#0f2730",
    colorNeutral: "#c9dbe2",
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden shadow-xl border border-[#dbe7ec]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#0f2730] font-bold",
    headerSubtitle: "text-[#5a7480]",
    socialButtonsBlockButtonText: "text-[#0f2730] font-medium",
    formFieldLabel: "text-[#0f2730] font-medium",
    footerActionLink: "text-[#0b7d9b] font-semibold hover:text-[#0a6a83]",
    footerActionText: "text-[#5a7480]",
    dividerText: "text-[#5a7480]",
    identityPreviewEditButton: "text-[#0b7d9b]",
    formFieldSuccessText: "text-[#15803d]",
    alertText: "text-[#0f2730]",
    logoBox: "justify-center",
    logoImage: "h-12 w-12 rounded-xl",
    socialButtonsBlockButton: "border border-[#c9dbe2] hover:bg-[#f1f7f9]",
    // App Store submission: ALL third-party social login is hidden everywhere
    // (web + native) for this review build — only email login + the App Store
    // reviewer sign-in remain. Apple/Google will be re-enabled after approval.
    // NOTE: must be "!hidden" (display:none !important), not "hidden": Clerk
    // injects its own styles under the "clerk" CSS layer, and inside the iOS
    // webview a plain (layered) `hidden` utility loses to Clerk's display rule.
    // The !important form wins regardless of layer ordering. Hiding the whole
    // socialButtons container + the divider leaves a clean email-only form.
    socialButtons: "!hidden",
    socialButtonsBlockButton__apple: "!hidden",
    socialButtonsBlockButton__google: "!hidden",
    dividerRow: "!hidden",
    formButtonPrimary: "bg-[#0b7d9b] hover:bg-[#0a6a83] text-white font-semibold",
    formFieldInput: "bg-white border border-[#c9dbe2] text-[#0f2730]",
    footerAction: "text-[#5a7480]",
    dividerLine: "bg-[#dbe7ec]",
    alert: "bg-[#fef2f2] border border-[#fecaca]",
    otpCodeFieldInput: "border border-[#c9dbe2] text-[#0f2730]",
    main: "gap-5",
  },
};

// App Store reviewer login. Production Clerk forces an email "new device"
// verification code on password sign-ins (mailed to the reviewer's unreachable
// mailbox), which can't be disabled on a Replit-managed instance. This form
// verifies the reviewer password server-side and signs in via a Clerk ticket,
// which skips that email step. It only ever works for the single reviewer
// account — regular users sign in above as normal.
function ReviewerLogin() {
  const clerk = useClerk();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/reviewer/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password }),
      });
      if (!res.ok) throw new Error("login failed");
      const data = (await res.json()) as { token?: string };
      if (!data.token) throw new Error("no token");

      // Consume the Clerk sign-in token via the ticket strategy. @clerk/react v6
      // ships the signals API (useSignIn returns { signIn, errors, fetchStatus }
      // with no isLoaded/setActive), so we drive the CLASSIC resource directly
      // off the Clerk instance. The ticket strategy completes the sign-in without
      // the "new device" email code that the normal password flow triggers (and
      // which mails the reviewer's unreachable mailbox).
      const classicSignIn = clerk.client?.signIn;
      if (!classicSignIn) throw new Error("clerk not ready");
      const result = await classicSignIn.create({
        strategy: "ticket",
        ticket: data.token,
      });
      if (result.status === "complete" && result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
        window.location.assign(`${basePath}/`);
        return;
      }
      throw new Error(`unexpected sign-in status: ${result.status}`);
    } catch {
      setError("Sign-in failed. Check the password and try again.");
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        onClick={() => setOpen(true)}
        className="mt-6 w-full max-w-sm"
        data-testid="button-reviewer-login-toggle"
      >
        App Store reviewer sign-in
      </Button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-6 flex w-full max-w-sm flex-col gap-3 rounded-lg border border-border bg-card p-4"
    >
      <p className="text-sm font-medium text-foreground">App Store reviewer sign-in</p>
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Reviewer password"
        autoComplete="current-password"
        data-testid="input-reviewer-password"
      />
      {error ? (
        <p className="text-sm text-destructive" data-testid="text-reviewer-error">
          {error}
        </p>
      ) : null}
      <Button type="submit" disabled={loading} data-testid="button-reviewer-login">
        {loading ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      <ReviewerLogin />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

// Invalidate cached data when the signed-in user changes.
function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        qc.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, qc]);

  return null;
}

function AuthedApp() {
  const { data: me, isLoading, isError, refetch } = useGetMe();
  const qc = useQueryClient();
  const checkOut = useCheckOutLocation();

  // Apple 5.1.2: location sharing must not persist across a cold launch. If the
  // account is still flagged as sharing when the app first loads, end that
  // check-in once so the user starts each session "Not sharing".
  const coldLaunchCheckedRef = useRef(false);
  useEffect(() => {
    if (coldLaunchCheckedRef.current) return;
    if (!me) return;
    // Nothing to clear — mark done so we don't keep checking.
    if (!me.isSharingLocation) {
      coldLaunchCheckedRef.current = true;
      return;
    }
    if (checkOut.isPending) return;
    // Fail safe: only mark the one-shot guard once checkout actually succeeds.
    // If it fails, leave the flag unset so a later /me refresh retries rather
    // than leaving the user silently "sharing" for the whole session.
    checkOut.mutate(undefined, {
      onSuccess: () => {
        coldLaunchCheckedRef.current = true;
        qc.invalidateQueries({ queryKey: getGetMeQueryKey() });
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  if (isLoading) {
    return <div className="flex min-h-[100dvh] items-center justify-center bg-background text-muted-foreground">Loading…</div>;
  }

  // Fail closed: never expose the app unless we successfully loaded the account.
  if (isError || !me) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <p className="text-muted-foreground">We couldn't load your account. Please check your connection and try again.</p>
        <Button onClick={() => refetch()}>Try again</Button>
      </div>
    );
  }

  // Suspended (banned) users are ejected: show a terminal suspension screen
  // instead of the app. The API also blocks their requests server-side.
  if (me.isSuspended) {
    return <SuspendedGate />;
  }

  if (me.waiverVersion !== WAIVER_VERSION) {
    return <WaiverGate />;
  }

  if (me.termsVersion !== TERMS_VERSION) {
    return <TermsGate />;
  }

  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={MapPage} />
        <Route path="/map" component={MapPage} />
        <Route path="/feed" component={FeedPage} />
        <Route path="/explore" component={ExplorePage} />
        <Route path="/messages" component={MessagesPage} />
        <Route path="/messages/:id/settings" component={MessageSettingsPage} />
        <Route path="/messages/:id" component={MessageThreadPage} />
        <Route path="/friends" component={FriendsPage} />
        <Route path="/pins" component={PinsPage} />
        <Route path="/catches" component={CatchesPage} />
        <Route path="/tie-ups" component={TieUpsPage} />
        <Route path="/boats" component={BoatsPage} />
        <Route path="/search" component={SearchPage} />
        <Route path="/notifications" component={NotificationsPage} />
        <Route path="/settings/:section" component={SettingsDetailPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/admin" component={AdminPage} />
        <Route path="/profile/:userId" component={ProfilePage} />
        <Route component={NotFound} />
      </Switch>
      <Onboarding />
    </AppLayout>
  );
}

function GatedRoutes() {
  return (
    <>
      <Show when="signed-in">
        <AuthedApp />
      </Show>
      <Show when="signed-out">
        <LandingPage />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to get back on the water",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Join the Gillie community",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <Switch>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            {/* Public pages — reachable without signing in so App Store
                reviewers and users can read help and policies directly. */}
            <Route path="/support" component={SupportPage} />
            <Route path="/privacy-policy" component={PrivacyPolicyPage} />
            <Route path="/community-guidelines" component={CommunityGuidelinesPage} />
            <Route path="/terms" component={TermsOfServicePage} />
            <Route component={GatedRoutes} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </ThemeProvider>
  );
}

export default App;
