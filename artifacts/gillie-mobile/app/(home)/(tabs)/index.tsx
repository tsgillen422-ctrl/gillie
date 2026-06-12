import React from "react";
import { View } from "react-native";

import LiveMap from "@/components/LiveMap";
import { AppHeader } from "@/components/AppHeader";

export default function MapScreen() {
  return (
    <View style={{ flex: 1 }}>
      <LiveMap />
      <AppHeader floating />
    </View>
  );
}
