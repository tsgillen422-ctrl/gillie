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

  if (!isNativePlatform()) return null;

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const { identityToken, email, fullName } = await signInWithAppleNative();

      const res = await fetch("/api/auth/apple-native", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identityToken, email, fullName }),
      });
      if (!res.ok) throw new Error("apple sign-in failed");
      const data = (await res.json()) as { token?: string };
      if (!data.token) throw new Error("no token");

      // Drive the classic Clerk signIn resource directly (the v6 signals API
      // returned by useSignIn has no setActive). The ticket strategy completes
      // the sign-in and sets the first-party Clerk session cookie.
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
    } catch (err) {
      if (err instanceof AppleSignInCancelled) {
        setLoading(false);
        return;
      }
      setError("Apple sign-in failed. Please try again.");
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
          className="text-center text-sm text-destructive"
          data-testid="text-apple-native-error"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
