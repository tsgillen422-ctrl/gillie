import { useSignIn, useSSO } from "@clerk/expo";
import { Ionicons } from "@expo/vector-icons";
import * as AuthSession from "expo-auth-session";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Brand } from "@/components/Brand";
import { fonts } from "@/constants/fonts";
import { useColors } from "@/hooks/useColors";

WebBrowser.maybeCompleteAuthSession();

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signIn, errors, fetchStatus } = useSignIn();
  const { startSSOFlow } = useSSO();

  useEffect(() => {
    if (Platform.OS !== "android") return;
    void WebBrowser.warmUpAsync();
    return () => {
      void WebBrowser.coolDownAsync();
    };
  }, []);

  const [emailAddress, setEmailAddress] = React.useState("");
  const [password, setPassword] = React.useState("");

  const loading = fetchStatus === "fetching";

  const handleSubmit = async () => {
    if (Platform.OS !== "web") void Haptics.selectionAsync();
    const { error } = await signIn.password({
      emailAddress: emailAddress.trim(),
      password,
    });
    if (error) return;
    if (signIn.status !== "complete") return;
    try {
      await signIn.finalize({
        navigate: async ({ session }) => {
          if (session?.currentTask) return;
          router.replace("/");
        },
      });
    } catch (err) {
      console.error("Sign-in finalize failed", err);
    }
  };

  const handleGoogle = useCallback(async () => {
    try {
      const { createdSessionId, setActive } = await startSSOFlow({
        strategy: "oauth_google",
        redirectUrl: AuthSession.makeRedirectUri(),
      });
      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
        router.replace("/");
      }
    } catch (err) {
      console.error(JSON.stringify(err, null, 2));
    }
  }, [router, startSSOFlow]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <LinearGradient
        colors={[colors.primary, colors.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.hero, { paddingTop: insets.top + 48 }]}
      >
        <Brand size={56} color="#ffffff" />
        <Text style={styles.tagline}>Find your crew on the water.</Text>
      </LinearGradient>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[styles.heading, { color: colors.foreground }]}>
            Welcome back
          </Text>

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Email
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
            ]}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            placeholder="you@example.com"
            placeholderTextColor={colors.mutedForeground}
            value={emailAddress}
            onChangeText={setEmailAddress}
          />
          {errors?.fields?.identifier && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {errors.fields.identifier.message}
            </Text>
          )}

          <Text style={[styles.label, { color: colors.mutedForeground }]}>
            Password
          </Text>
          <TextInput
            style={[
              styles.input,
              { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.card },
            ]}
            secureTextEntry
            placeholder="••••••••"
            placeholderTextColor={colors.mutedForeground}
            value={password}
            onChangeText={setPassword}
          />
          {errors?.fields?.password && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {errors.fields.password.message}
            </Text>
          )}
          {errors?.global?.[0] && (
            <Text style={[styles.error, { color: colors.destructive }]}>
              {errors.global[0].message}
            </Text>
          )}

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: colors.primary, opacity: pressed || loading ? 0.85 : 1 },
              (!emailAddress || !password) && { opacity: 0.5 },
            ]}
            onPress={handleSubmit}
            disabled={!emailAddress || !password || loading}
          >
            {loading ? (
              <ActivityIndicator color={colors.primaryForeground} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.primaryForeground }]}>
                Sign in
              </Text>
            )}
          </Pressable>

          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>
              or
            </Text>
            <View style={[styles.divider, { backgroundColor: colors.border }]} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.googleButton,
              { borderColor: colors.border, backgroundColor: colors.card, opacity: pressed ? 0.85 : 1 },
            ]}
            onPress={handleGoogle}
          >
            <Ionicons name="logo-google" size={20} color={colors.foreground} />
            <Text style={[styles.googleText, { color: colors.foreground }]}>
              Continue with Google
            </Text>
          </Pressable>

          <View style={styles.footer}>
            <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans }}>
              New here?{" "}
            </Text>
            <Link href="/sign-up">
              <Text style={{ color: colors.primary, fontFamily: fonts.sansSemibold }}>
                Create an account
              </Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  hero: {
    paddingBottom: 40,
    paddingHorizontal: 24,
    alignItems: "center",
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  tagline: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 15,
    marginTop: 8,
    fontFamily: fonts.sansMedium,
  },
  form: { padding: 24, gap: 6, paddingBottom: 48 },
  heading: { fontSize: 26, fontFamily: fonts.display, marginBottom: 12 },
  label: { fontSize: 13, fontFamily: fonts.sansMedium, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    fontFamily: fonts.sans,
  },
  error: { fontSize: 12, fontFamily: fonts.sans, marginTop: 2 },
  button: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 18,
  },
  buttonText: { fontSize: 16, fontFamily: fonts.sansBold },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 20 },
  divider: { flex: 1, height: 1 },
  dividerText: { fontSize: 13, fontFamily: fonts.sans },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  googleText: { fontSize: 15, fontFamily: fonts.sansSemibold },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
});
