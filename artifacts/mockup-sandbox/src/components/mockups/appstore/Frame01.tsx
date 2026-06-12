import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";
import appMap from "./assets/app-map.jpg";

export function Frame01() {
  return (
    <AppStoreFrame bgClass="bg-gradient-1">
      <Caption 
        line1="SEE YOUR CREW"
        line2="ON THE WATER"
        accentWord="CREW"
        subline="Live map of friends, boats, and hot spots on Dale Hollow."
      />
      <DeviceMockup activeTab="Map" darkMode>
        <div style={{ position: "absolute", inset: 0, background: "#0b1220" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "150px", background: "#0b1220", zIndex: 5 }} />
          <img src={appMap} style={{ position: "absolute", top: "150px", left: 0, right: 0, bottom: 0, width: "100%", height: "calc(100% - 150px)", objectFit: "cover", objectPosition: "top" }} alt="Map" />
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
