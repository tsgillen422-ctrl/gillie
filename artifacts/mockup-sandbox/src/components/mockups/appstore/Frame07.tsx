import React from "react";
import { AppStoreFrame, Caption, DeviceMockup, RealScreen } from "./_shared";
import appProfile from "./assets/app-profile.png";

export function Frame07() {
  return (
    <AppStoreFrame bgClass="bg-gradient-7">
      <Caption
        line1="EARN YOUR"
        line2="BOATER RANK"
        accentWord="RANK"
        subline="Collect badges and level up as you explore the lake."
        accentColor="gold"
      />
      <DeviceMockup hideTabs>
        <RealScreen src={appProfile} strip="#ffffff" alt="Profile and badges" />
      </DeviceMockup>
    </AppStoreFrame>
  );
}
