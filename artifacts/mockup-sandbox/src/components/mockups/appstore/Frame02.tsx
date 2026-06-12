import React from "react";
import { AppStoreFrame, Caption, DeviceMockup, RealScreen } from "./_shared";
import appFeed from "./assets/app-feed.png";

export function Frame02() {
  return (
    <AppStoreFrame bgClass="bg-gradient-2">
      <Caption
        line1="OPEN TO YOUR"
        line2="WHOLE LAKE"
        accentWord="WHOLE LAKE"
        subline="Live conditions, lake activity, and your crew — front and center."
        accentColor="blue"
      />
      <DeviceMockup hideTabs>
        <RealScreen src={appFeed} strip="#ffffff" alt="Gillie home feed" />
      </DeviceMockup>
    </AppStoreFrame>
  );
}
