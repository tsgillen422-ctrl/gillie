import React from "react";
import { AppStoreFrame, Caption, DeviceMockup, RealScreen } from "./_shared";
import appMessages from "./assets/app-messages.png";

export function Frame11() {
  return (
    <AppStoreFrame bgClass="bg-gradient-2">
      <Caption
        line1="MESSAGE YOUR"
        line2="WHOLE CREW"
        accentWord="CREW"
        subline="Direct messages and group chats keep everyone in sync."
        accentColor="blue"
      />
      <DeviceMockup hideTabs>
        <RealScreen src={appMessages} strip="#ffffff" alt="Messages" />
      </DeviceMockup>
    </AppStoreFrame>
  );
}
