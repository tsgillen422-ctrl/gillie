import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useColors } from "@/hooks/useColors";

export default function SettingsScreen() {
  const colors = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background, padding: 24 }}>
      <Text style={{ color: colors.foreground, fontSize: 24 }}>Settings</Text>
    </View>
  );
}
