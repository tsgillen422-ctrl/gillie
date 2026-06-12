import React from "react";
import { AppStoreFrame, Caption, DeviceMockup, RealScreen } from "./_shared";
import appPins from "./assets/app-pins.png";

export function Frame06() {
  return (
    <AppStoreFrame bgClass="bg-gradient-8">
      <Caption
        line1="DROP PINS FOR"
        line2="SPOTS & HAZARDS"
        accentWord="HAZARDS"
        subline="Mark fishing holes, marinas, and dangers for everyone."
        accentColor="gold"
      />
      <DeviceMockup hideTabs>
        <RealScreen src={appPins} strip="#ffffff" alt="Lake pins" />
      </DeviceMockup>
    </AppStoreFrame>
  );
}
