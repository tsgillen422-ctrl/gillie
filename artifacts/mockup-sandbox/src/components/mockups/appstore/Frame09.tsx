import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";

export function Frame09() {
  return (
    <AppStoreFrame bgClass="bg-gradient-1">
      <Caption 
        line1="SEE WHERE"
        line2="IT'S BUZZING"
        accentWord="BUZZING"
        subline="Real-time activity shows you where the lake is hopping."
        accentColor="gold"
      />
      <DeviceMockup activeTab="Map">
        <div style={{ position: "absolute", inset: 0, background: "#dbeafe" }}>
          <div style={{ width: "100%", height: "100%", background: "#0ea5e930", backgroundImage: "radial-gradient(#ffffff 2px, transparent 2px)", backgroundSize: "60px 60px" }} />
          
          {/* Heatmap blur blobs */}
          <div style={{ position: "absolute", top: "30%", left: "40%", width: "400px", height: "400px", background: "radial-gradient(circle, rgba(245,158,11,0.6) 0%, rgba(239,68,68,0.4) 40%, rgba(0,0,0,0) 70%)", filter: "blur(20px)", transform: "translate(-50%, -50%)" }} />
          
          <div style={{ position: "absolute", top: "60%", left: "70%", width: "300px", height: "300px", background: "radial-gradient(circle, rgba(245,158,11,0.4) 0%, rgba(0,0,0,0) 70%)", filter: "blur(15px)", transform: "translate(-50%, -50%)" }} />

          {/* Lake Activity Card */}
          <div style={{ position: "absolute", bottom: "40px", left: "40px", right: "40px", background: "rgba(255,255,255,0.95)", backdropFilter: "blur(20px)", borderRadius: "40px", padding: "40px", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "30px" }}>
              <span style={{ fontSize: "48px" }}>🔥</span>
              <span style={{ fontSize: "40px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>Lake Activity</span>
            </div>
            
            <div style={{ width: "100%", height: "24px", borderRadius: "12px", background: "linear-gradient(to right, #38bdf8, #10b981, #f59e0b, #ef4444)", marginBottom: "20px" }} />
            
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "28px", color: "#64748b", fontWeight: 700, textTransform: "uppercase" }}>
              <span>Quiet</span>
              <span style={{ color: "#ef4444" }}>Buzzing</span>
            </div>
          </div>
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
