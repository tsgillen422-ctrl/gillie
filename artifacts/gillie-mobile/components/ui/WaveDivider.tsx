import React from "react";
import { View } from "react-native";
import Svg, { Path } from "react-native-svg";

import { useColors } from "@/hooks/useColors";

/**
 * Subtle lake wave separator used between profile sections, mirroring the
 * web app's WaveDivider.
 */
export default function WaveDivider({
  color,
  height = 18,
}: {
  color?: string;
  height?: number;
}) {
  const colors = useColors();
  const fill = color ?? colors.primary;
  return (
    <View style={{ width: "100%", height, opacity: 0.18 }}>
      <Svg
        width="100%"
        height={height}
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
      >
        <Path
          d="M0 30 C 240 60, 480 0, 720 30 S 1200 60, 1440 30 L 1440 60 L 0 60 Z"
          fill={fill}
        />
      </Svg>
    </View>
  );
}
