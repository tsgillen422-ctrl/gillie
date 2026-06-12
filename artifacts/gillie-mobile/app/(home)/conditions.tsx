import React from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { useGetConditions } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function ConditionsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: conditions, isLoading } = useGetConditions();

  if (isLoading || !conditions) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={{ padding: 24 }}>
        <Text style={[styles.title, { color: colors.foreground }]}>Lake Conditions</Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans, marginBottom: 16 }}>
          {conditions.weatherLabel} • {conditions.temperature}°F
        </Text>
        
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Water Temp</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{conditions.waterTemperature ?? "--"}°F</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Water Level</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{conditions.waterLevel ?? "--"} ft</Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>Wind</Text>
          <Text style={[styles.value, { color: colors.foreground }]}>{conditions.windSpeed} mph</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: { fontFamily: fonts.displayBold, fontSize: 28, marginBottom: 4 },
  card: { padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  label: { fontFamily: fonts.sansMedium, fontSize: 14, marginBottom: 4 },
  value: { fontFamily: fonts.displaySemibold, fontSize: 20 },
});
