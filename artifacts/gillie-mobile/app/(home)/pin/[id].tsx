import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useGetPin, getGetPinQueryKey } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams } from "expo-router";

export default function PinScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  
  const { data: pin, isLoading } = useGetPin(Number(id), { query: { enabled: Number.isFinite(Number(id)), queryKey: getGetPinQueryKey(Number(id)) }});

  if (isLoading || !pin) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={{ padding: 24 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>{pin.title}</Text>
        <Text style={[styles.type, { color: colors.mutedForeground }]}>{pin.type}</Text>
        {pin.description && (
          <Text style={[styles.content, { color: colors.foreground, marginTop: 16 }]}>{pin.description}</Text>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 28, marginBottom: 4 },
  type: { fontFamily: fonts.sansMedium, fontSize: 16, textTransform: "uppercase" },
  content: { fontFamily: fonts.sans, fontSize: 16, lineHeight: 24 },
});
