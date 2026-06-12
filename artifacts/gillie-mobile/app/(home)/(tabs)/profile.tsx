import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Pressable } from "react-native";
import { useGetMe } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useClerk } from "@clerk/expo";

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { signOut } = useClerk();
  const { data: user, isLoading } = useGetMe();

  if (isLoading || !user) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={{ padding: 24 }}>
        <Text style={[styles.name, { color: colors.foreground }]}>{user.displayName}</Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans, marginBottom: 16 }}>@{user.username}</Text>

        <Pressable
          style={[styles.button, { backgroundColor: colors.secondary }]}
          onPress={() => router.push("/settings")}
        >
          <Text style={[styles.buttonText, { color: colors.secondaryForeground }]}>Settings</Text>
        </Pressable>

        <Pressable
          style={[styles.button, { backgroundColor: colors.destructive, marginTop: 12 }]}
          onPress={async () => {
            await signOut();
            router.replace("/");
          }}
        >
          <Text style={[styles.buttonText, { color: colors.destructiveForeground }]}>Sign Out</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  name: { fontFamily: fonts.displayBold, fontSize: 24 },
  button: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  buttonText: {
    fontFamily: fonts.sansBold,
    fontSize: 16,
  },
});
