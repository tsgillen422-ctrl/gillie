import { useState } from "react";
import { useClerk } from "@clerk/react";
import {
  isNativePlatform,
  signInWithAppleNative,
  AppleSignInCancelled,
} from "@/lib/native-apple";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

// Native iOS "Sign in with Apple" button. Only renders inside the Capacitor app
// (returns null on the web — there is no web Apple login at all anymore, since
// the broken Clerk web Apple OAuth was removed; web offers Google + email only).
// It triggers Apple's native popup, sends the resulting identity token to our
// backend, and consumes the returned Clerk sign-in token via the ticket
// strategy — the same mechanism the reviewer login uses.
export function NativeAppleButton() {
  const clerk = useClerk();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string | null>(null);

  if (!isNativePlatform()) return null;

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    setDebug(null);

    // Accumulate every diagnostic the user asked to see, so we can render the
    // full picture on screen even when a later step throws.
    const d: string[] = [];
    const yn = (v: unknown) => (v ? "yes" : "no");
    try {
      // STAGE 1: Apple's native authorization popup.
      console.log("[apple-native] stage 1: requesting Apple authorization");
      const { identityToken, email, fullName, authorizationCode } =
        await signInWithAppleNative();
      d.push(`Apple popup: success`);
      d.push(`identityToken present: ${yn(identityToken)} (len ${identityToken.length})`);
      d.push(`authorizationCode present: ${yn(authorizationCode)}`);
      d.push(`email present: ${yn(email)}  fullName present: ${yn(fullName)}`);
      setDebug(d.join("\n"));
      console.log("[apple-native] stage 1 OK", {
        identityTokenLength: identityToken.length,
        hasAuthorizationCode: Boolean(authorizationCode),
        hasEmail: Boolean(email),
        hasFullName: Boolean(fullName),
      });

      // STAGE 2: hand the Apple identity token to our backend for verification.
      console.log("[apple-native] stage 2: POST /api/auth/apple-native");
      d.push(`backend endpoint called: POST /api/auth/apple-native`);
      setDebug(d.join("\n"));
      const res = await fetch("/api/auth/apple-native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identityToken, email, fullName, authorizationCode }),
      });

      // Read the raw body once so we can show the server's exact response even
      // when it isn't valid JSON.
      const rawBody = await res.text();
      let parsed: { token?: string; error?: string; stage?: string; detail?: string } = {};
      try {
        parsed = rawBody ? JSON.parse(rawBody) : {};
      } catch {
        // leave parsed empty; rawBody is shown below
      }
      // SECURITY: a successful response body contains the Clerk sign-in ticket
      // (an auth secret). Never render or log it. Error bodies carry only
      // {error, stage, detail} (no token), so those are safe to show in full.
      const safeBody = res.ok
        ? `OK (sign-in token received: ${yn(parsed.token)})`
        : rawBody
          ? rawBody.slice(0, 300)
          : "(empty)";
      d.push(`backend status: ${res.status}`);
      d.push(`backend response: ${safeBody}`);
      setDebug(d.join("\n"));
      console.log("[apple-native] stage 2 response", {
        status: res.status,
        ok: res.ok,
        hasToken: Boolean(parsed.token),
        body: res.ok ? "(redacted: contains sign-in token)" : rawBody.slice(0, 500),
      });

      if (!res.ok) {
        const serverStage = parsed.stage ? ` [${parsed.stage}]` : "";
        const serverDetail = parsed.detail
          ? `: ${parsed.detail}`
          : parsed.error
            ? `: ${parsed.error}`
            : rawBody
              ? `: ${rawBody.slice(0, 200)}`
              : "";
        throw new Error(
          `Backend rejected token (HTTP ${res.status})${serverStage}${serverDetail}`,
        );
      }
      if (!parsed.token) {
        throw new Error(
          `Backend returned no sign-in token (HTTP ${res.status}, body: ${rawBody.slice(0, 200)})`,
        );
      }

      // STAGE 3: consume the Clerk sign-in ticket. Drive the classic Clerk
      // signIn resource directly (the v6 signals API returned by useSignIn has
      // no setActive). The ticket strategy completes the sign-in and sets the
      // first-party Clerk session cookie.
      console.log("[apple-native] stage 3: consuming Clerk ticket");
      const classicSignIn = clerk.client?.signIn;
      if (!classicSignIn) throw new Error("Clerk client not ready for ticket sign-in");
      const result = await classicSignIn.create({
        strategy: "ticket",
        ticket: parsed.token,
      });
      console.log("[apple-native] stage 3 result", { status: result.status });
      if (result.status === "complete" && result.createdSessionId) {
        await clerk.setActive({ session: result.createdSessionId });
        window.location.assign(`${basePath}/`);
        return;
      }
      throw new Error(`Clerk ticket sign-in returned status: ${result.status}`);
    } catch (err) {
      if (err instanceof AppleSignInCancelled) {
        console.log("[apple-native] user cancelled the Apple sheet");
        setLoading(false);
        return;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.error("[apple-native] sign-in failed:", message);
      d.push(`FAILED: ${message}`);
      setDebug(d.join("\n"));
      setError(message);
      setLoading(false);
    }
  }

  return (
    <div className="mb-4 flex w-[440px] max-w-full flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        data-testid="button-apple-native"
        className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-black text-[15px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 384 512"
          className="h-[18px] w-[18px] fill-current"
        >
          <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
        </svg>
        {loading ? "Signing in…" : "Sign in with Apple"}
      </button>
      {error ? (
        <p
          className="max-h-40 select-text overflow-auto whitespace-pre-wrap break-words rounded-lg border border-destructive/40 bg-destructive/5 p-2 text-left text-xs text-destructive"
          data-testid="text-apple-native-error"
        >
          {error}
        </p>
      ) : null}
      {debug ? (
        <pre
          className="max-h-56 select-text overflow-auto whitespace-pre-wrap break-words rounded-lg border border-muted-foreground/30 bg-muted/40 p-2 text-left font-mono text-[11px] leading-snug text-muted-foreground"
          data-testid="text-apple-native-debug"
        >
          {debug}
        </pre>
      ) : null}
    </div>
  );
}
