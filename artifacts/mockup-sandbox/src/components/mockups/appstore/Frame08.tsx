import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";

export function Frame08() {
  return (
    <AppStoreFrame bgClass="bg-gradient-8">
      <Caption 
        line1="STAY SAFE"
        line2="OUT THERE"
        accentWord="SAFE"
        subline="Ghost Mode privacy and one-tap SOS when it counts."
        accentColor="gold"
      />
      <DeviceMockup activeTab="Map">
        <div className="app-header">
          <div className="app-header-title">Safety & Privacy</div>
        </div>
        <div style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "40px", background: "#f8fafc", minHeight: "100%" }}>
          
          <div className="card" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "40px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "40px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif", display: "flex", alignItems: "center", gap: "16px" }}>
                <span>👻</span> Ghost Mode
              </div>
              <div style={{ fontSize: "28px", color: "#64748b", marginTop: "12px", lineHeight: 1.4, paddingRight: "40px" }}>
                Hide your location from the map. You can still see others.
              </div>
            </div>
            <div style={{ width: "100px", height: "60px", background: "#10b981", borderRadius: "30px", position: "relative", flexShrink: 0 }}>
              <div style={{ width: "52px", height: "52px", background: "#fff", borderRadius: "26px", position: "absolute", top: "4px", right: "4px", boxShadow: "0 4px 8px rgba(0,0,0,0.1)" }} />
            </div>
          </div>

          <div className="card" style={{ background: "#fef2f2", border: "2px solid #fecaca", padding: "60px 40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div style={{ width: "160px", height: "160px", borderRadius: "80px", background: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "64px", fontWeight: 900, boxShadow: "0 20px 40px rgba(239, 68, 68, 0.3)", marginBottom: "40px" }}>
              SOS
            </div>
            <div style={{ fontSize: "48px", fontWeight: 800, color: "#991b1b", fontFamily: "'Outfit', sans-serif", marginBottom: "20px" }}>Emergency SOS</div>
            <p style={{ fontSize: "32px", color: "#b91c1c", lineHeight: 1.5, opacity: 0.9 }}>
              Instantly alert local authorities and your trusted contacts with your exact coordinates.
            </p>
          </div>

          <div className="card" style={{ padding: "40px" }}>
            <div style={{ fontSize: "36px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif", marginBottom: "30px" }}>Trusted Contacts</div>
            <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
              <div style={{ width: "80px", height: "80px", borderRadius: "40px", background: "#0ea5e9", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", fontWeight: 700 }}>EM</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "32px", fontWeight: 700, color: "#0f172a" }}>Emily Smith</div>
                <div style={{ fontSize: "28px", color: "#64748b" }}>Wife</div>
              </div>
              <div style={{ fontSize: "32px", color: "#cbd5e1" }}>✕</div>
            </div>
          </div>
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
