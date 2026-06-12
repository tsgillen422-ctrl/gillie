import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useGetUser, getGetUserQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

export default function UserScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const { data: user, isLoading } = useGetUser(Number(id), { query: { enabled: Number.isFinite(Number(id)), queryKey: getGetUserQueryKey(Number(id)) }});

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
        <Text style={[styles.title, { color: colors.foreground }]}>{user.displayName}</Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans, marginBottom: 16 }}>@{user.username}</Text>
        
        {user.bio && (
          <Text style={{ color: colors.foreground, fontFamily: fonts.sans, fontSize: 16 }}>{user.bio}</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 28, marginBottom: 4 },
});
