import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";
import fishing from "./assets/fishing.jpg";

export function Frame13() {
  const catches = [
    { species: "Smallmouth Bass", weight: "5.2 lb", angler: "Jake D." },
    { species: "Largemouth Bass", weight: "7.8 lb", angler: "Sara R." },
    { species: "Walleye", weight: "4.1 lb", angler: "Mike T." },
    { species: "Striped Bass", weight: "11.3 lb", angler: "Chris B." },
  ];
  return (
    <AppStoreFrame bgClass="bg-gradient-7">
      <Caption
        line1="BROWSE THE"
        line2="DAY'S CATCHES"
        accentWord="CATCHES"
        subline="A live feed of the biggest catches from across the lake."
        accentColor="gold"
      />
      <DeviceMockup activeTab="Feed">
        <div className="app-header">
          <div className="app-header-title">Catches</div>
        </div>
        <div style={{ padding: "40px", background: "#f8fafc", minHeight: "100%" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "32px" }}>
            {catches.map((c, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: "40px", overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.06)" }}>
                <div style={{ position: "relative", height: "320px" }}>
                  <img src={fishing} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                  <div style={{ position: "absolute", top: "24px", right: "24px", background: "rgba(15,23,42,0.85)", color: "#f59e0b", padding: "12px 28px", borderRadius: "999px", fontSize: "30px", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>{c.weight}</div>
                </div>
                <div style={{ padding: "32px" }}>
                  <div style={{ fontSize: "36px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>{c.species}</div>
                  <div style={{ fontSize: "28px", color: "#64748b", marginTop: "10px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <span>🎣</span> {c.angler}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
