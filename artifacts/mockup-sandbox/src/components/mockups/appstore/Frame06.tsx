import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";

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
      <DeviceMockup activeTab="Map">
        <div style={{ position: "absolute", inset: 0, background: "#dbeafe" }}>
          {/* Faux map background */}
          <div style={{ width: "100%", height: "100%", background: "#0ea5e930", backgroundImage: "radial-gradient(#ffffff 2px, transparent 2px)", backgroundSize: "60px 60px" }} />
          
          {/* Pins on map */}
          <div style={{ position: "absolute", top: "30%", left: "20%", background: "#fff", border: "4px solid #3b82f6", borderRadius: "999px", padding: "16px 24px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 10px 20px rgba(0,0,0,0.15)" }}>
            <span style={{ fontSize: "40px" }}>🎣</span>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a" }}>Good Spot</span>
          </div>

          <div style={{ position: "absolute", top: "45%", left: "60%", background: "#fff", border: "4px solid #f43f5e", borderRadius: "999px", padding: "16px 24px", display: "flex", alignItems: "center", gap: "12px", boxShadow: "0 10px 20px rgba(0,0,0,0.15)" }}>
            <span style={{ fontSize: "40px" }}>⚠️</span>
            <span style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a" }}>Shallow</span>
          </div>
          
          {/* Selected Pin Card */}
          <div style={{ position: "absolute", bottom: "40px", left: "40px", right: "40px", background: "#fff", borderRadius: "40px", padding: "40px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "30px", marginBottom: "30px" }}>
              <div style={{ width: "100px", height: "100px", borderRadius: "30px", background: "#fef2f2", color: "#f43f5e", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "56px" }}>⚠️</div>
              <div>
                <div style={{ fontSize: "40px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>Submerged Tree</div>
                <div style={{ fontSize: "28px", color: "#64748b", marginTop: "8px" }}>Hazard • Added by Jake</div>
              </div>
            </div>
            <p style={{ fontSize: "32px", color: "#334155", lineHeight: 1.5, marginBottom: "30px" }}>
              Big log just under the surface here. Be careful coming into the cove.
            </p>
            <div style={{ display: "flex", gap: "20px" }}>
              <div style={{ flex: 1, background: "#f1f5f9", padding: "24px", borderRadius: "20px", textAlign: "center", fontSize: "32px", fontWeight: 700, color: "#0f172a" }}>👍 Helpful (12)</div>
              <div style={{ width: "80px", height: "80px", background: "#f1f5f9", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>↗️</div>
            </div>
          </div>
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
