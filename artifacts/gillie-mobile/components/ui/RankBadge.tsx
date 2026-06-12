import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { fonts } from "@/constants/fonts";

/**
 * Rank/tier badge mirroring the web app's illustrated rank window.
 * Palette shifts from sunrise (tier 1) to night (tier 5).
 */
const PALETTES: [string, string][] = [
  ["#fbbf24", "#f59e0b"], // 1 sunrise
  ["#38bdf8", "#0ea5e9"], // 2 morning
  ["#22d3ee", "#0891b2"], // 3 midday
  ["#fb7185", "#e11d48"], // 4 sunset
  ["#818cf8", "#312e81"], // 5 night
];

export default function RankBadge({
  tier = 1,
  title,
  size = 56,
}: {
  tier?: number;
  title?: string;
  size?: number;
}) {
  const idx = Math.min(Math.max(tier, 1), 5) - 1;
  const colors = PALETTES[idx];
  return (
    <View style={styles.row}>
      <LinearGradient
        colors={colors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.badge,
          { width: size, height: size, borderRadius: size / 2 },
        ]}
      >
        <Ionicons name="trophy" size={size * 0.38} color="#fff" />
        <Text style={styles.tier}>{tier}</Text>
      </LinearGradient>
      {title && (
        <View>
          <Text style={[styles.rankLabel, { color: colors[1] }]}>RANK {tier}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  badge: { alignItems: "center", justifyContent: "center" },
  tier: {
    position: "absolute",
    bottom: 4,
    right: 6,
    color: "#fff",
    fontFamily: fonts.displayBold,
    fontSize: 11,
  },
  rankLabel: { fontFamily: fonts.sansBold, fontSize: 11, letterSpacing: 1 },
  title: { fontFamily: fonts.displayBold, fontSize: 16, color: "#0f1d24" },
});
