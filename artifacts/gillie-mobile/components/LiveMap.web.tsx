import React from "react";
import { View, StyleSheet, Text, ScrollView, Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useGetFriendLocations, useGetPins, useGetActiveHazards } from "@workspace/api-client-react";
import { useColors } from "@/hooks/useColors";
import { fonts } from "@/constants/fonts";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";

export default function LiveMapWeb() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: friendLocations } = useGetFriendLocations();
  const { data: pins } = useGetPins();
  const { data: hazards } = useGetActiveHazards();

  const onWater = (friendLocations ?? []).filter(locValid);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: insets.top + 20, paddingBottom: 120, gap: 20 }}
      >
        <View style={{ gap: 4 }}>
          <Text style={[styles.title, { color: colors.foreground }]}>Dale Hollow</Text>
          <Text style={[styles.subtitle, { color: colors.mutedForeground }]}>
            The live map runs in the Gillie app. Here's what's happening on the water right now.
          </Text>
        </View>

        <Pressable
          onPress={() => router.push("/conditions")}
          style={[styles.conditionsCard, { backgroundColor: colors.primary }]}
        >
          <Feather name="cloud" size={20} color={colors.primaryForeground} />
          <Text style={[styles.conditionsText, { color: colors.primaryForeground }]}>
            View lake conditions
          </Text>
          <Feather name="chevron-right" size={20} color={colors.primaryForeground} />
        </Pressable>

        <Section title="On the water" count={onWater.length} colors={colors}>
          {onWater.length === 0 ? (
            <Empty text="No friends out right now." colors={colors} />
          ) : (
            onWater.map((fl) => (
              <Pressable
                key={fl.userId}
                onPress={() => router.push(`/user/${fl.userId}`)}
                style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{fl.displayName}</Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            ))
          )}
        </Section>

        <Section title="Pins" count={pins?.length ?? 0} colors={colors}>
          {(pins ?? []).length === 0 ? (
            <Empty text="No pins yet." colors={colors} />
          ) : (
            (pins ?? []).map((pin) => (
              <Pressable
                key={pin.id}
                onPress={() => router.push(`/pin/${pin.id}`)}
                style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name="map-pin" size={18} color={colors.primary} />
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{pin.title}</Text>
                <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
              </Pressable>
            ))
          )}
        </Section>

        <Section title="Hazards" count={hazards?.length ?? 0} colors={colors}>
          {(hazards ?? []).length === 0 ? (
            <Empty text="No active hazards." colors={colors} />
          ) : (
            (hazards ?? []).map((hazard) => (
              <View
                key={hazard.id}
                style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <Feather name="alert-triangle" size={18} color={colors.destructive} />
                <Text style={[styles.rowTitle, { color: colors.foreground }]}>{hazard.title}</Text>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </View>
  );
}

function Section({
  title,
  count,
  colors,
  children,
}: {
  title: string;
  count: number;
  colors: ReturnType<typeof useColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: 10 }}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>{count}</Text>
      </View>
      <View style={{ gap: 8 }}>{children}</View>
    </View>
  );
}

function Empty({ text, colors }: { text: string; colors: ReturnType<typeof useColors> }) {
  return <Text style={[styles.empty, { color: colors.mutedForeground }]}>{text}</Text>;
}

function locValid(loc: any) {
  return loc && typeof loc.lat === "number" && typeof loc.lng === "number";
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontFamily: fonts.displayBold, fontSize: 30 },
  subtitle: { fontFamily: fonts.sans, fontSize: 14, lineHeight: 20 },
  conditionsCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
  },
  conditionsText: { flex: 1, fontFamily: fonts.sansSemibold, fontSize: 15 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontFamily: fonts.displaySemibold, fontSize: 18 },
  count: { fontFamily: fonts.sansMedium, fontSize: 14 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowTitle: { flex: 1, fontFamily: fonts.sansMedium, fontSize: 15 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  empty: { fontFamily: fonts.sans, fontSize: 14, paddingVertical: 8 },
});
