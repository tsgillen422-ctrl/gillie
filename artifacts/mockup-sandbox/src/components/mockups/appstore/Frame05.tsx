import React from "react";
import { AppStoreFrame, Caption, DeviceMockup, RealScreen } from "./_shared";
import appTieups from "./assets/app-tieups.png";

export function Frame05() {
  return (
    <AppStoreFrame bgClass="bg-gradient-5">
      <Caption
        line1="PLAN THE"
        line2="NEXT TIE-UP"
        accentWord="TIE-UP"
        subline="See who's rafting up, RSVP, and rally your crew."
        accentColor="gold"
      />
      <DeviceMockup hideTabs>
        <RealScreen src={appTieups} strip="#ffffff" alt="Tie-ups" />
      </DeviceMockup>
    </AppStoreFrame>
  );
}
