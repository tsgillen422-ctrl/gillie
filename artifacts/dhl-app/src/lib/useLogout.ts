import { useClerk } from "@clerk/react";
import { useCheckOutLocation } from "@workspace/api-client-react";

/**
 * Logout helper that ends any active location check-in before signing out, so
 * location sharing never persists across a logout (Apple Guideline 5.1.2).
 * The checkout is best-effort — we always proceed to sign out.
 */
export function useLogout() {
  const { signOut } = useClerk();
  const checkOut = useCheckOutLocation();

  return async (redirectUrl: string) => {
    try {
      await checkOut.mutateAsync(undefined);
    } catch {
      // Ignore — still sign the user out even if checkout fails.
    }
    signOut({ redirectUrl });
  };
}
