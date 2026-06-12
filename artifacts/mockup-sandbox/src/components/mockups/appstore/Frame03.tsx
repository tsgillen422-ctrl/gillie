import React from "react";
import { AppStoreFrame, Caption, DeviceMockup, RealScreen } from "./_shared";
import appCatch from "./assets/app-catch.png";

export function Frame03() {
  return (
    <AppStoreFrame bgClass="bg-gradient-3">
      <Caption
        line1="LOG EVERY"
        line2="TROPHY CATCH"
        accentWord="TROPHY"
        subline="See and share the biggest catches on the lake."
        accentColor="gold"
      />
      <DeviceMockup hideTabs>
        <RealScreen src={appCatch} strip="#ffffff" alt="Catch log" />
      </DeviceMockup>
    </AppStoreFrame>
  );
}
