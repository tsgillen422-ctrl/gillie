import React from "react";
import { View, ViewStyle, StyleProp, Platform } from "react-native";

import { useColors } from "@/hooks/useColors";

/**
 * Rounded card with the web app's lake-tinted soft shadow.
 */
export default function SoftCard({
  children,
  style,
  padded = true,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
}) {
  const colors = useColors();
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          padding: padded ? 16 : 0,
          ...Platform.select({
            ios: {
              shadowColor: "#032333",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.1,
              shadowRadius: 16,
            },
            android: { elevation: 3 },
            default: {},
          }),
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
