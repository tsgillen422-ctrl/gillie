import React from "react";
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from "react-native";
import { useGetCatches } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CatchesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { data: catches, isLoading } = useGetCatches();

  if (isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlatList
        data={catches}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.title, { color: colors.foreground }]}>{item.species}</Text>
            {item.weight && <Text style={{ color: colors.mutedForeground, fontFamily: fonts.sans }}>{item.weight} lbs</Text>}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  card: { padding: 16, borderWidth: 1, borderRadius: 12, marginBottom: 12 },
  title: { fontFamily: fonts.displaySemibold, fontSize: 18, marginBottom: 4 },
});
