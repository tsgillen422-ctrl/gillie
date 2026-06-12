import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";
import appMap from "./assets/app-map.jpg";

export function Frame04() {
  return (
    <AppStoreFrame bgClass="bg-gradient-1">
      <Caption 
        line1="KNOW BEFORE"
        line2="YOU GO"
        accentWord="BEFORE"
        subline="Live water temp, levels, wind, and fishing pressure."
        accentColor="blue"
      />
      <DeviceMockup activeTab="Map" darkMode>
        <div style={{ position: "absolute", inset: 0, background: "#0b1220" }}>
          <img src={appMap} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} alt="Map" />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, rgba(11,18,32,0.55) 0%, rgba(11,18,32,0.15) 30%, rgba(11,18,32,0.1) 100%)" }} />
        </div>
        
        {/* Conditions Drawer overlay */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "#ffffff", borderRadius: "60px 60px 0 0", padding: "60px 40px 40px", boxShadow: "0 -20px 80px rgba(0,0,0,0.2)" }}>
          <div style={{ width: "120px", height: "12px", background: "#e2e8f0", borderRadius: "6px", margin: "0 auto 40px" }} />
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "50px" }}>
            <div style={{ fontSize: "64px", fontWeight: 800, fontFamily: "'Outfit', sans-serif", color: "#0f172a" }}>Lake Conditions</div>
            <div style={{ background: "#ecfdf5", color: "#059669", padding: "16px 32px", borderRadius: "999px", fontSize: "28px", fontWeight: 800, display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "32px" }}>🟢</span> Good
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px", marginBottom: "30px" }}>
            <div className="card" style={{ background: "#f8fafc", padding: "40px", border: "2px solid #f1f5f9" }}>
              <div style={{ fontSize: "56px", marginBottom: "20px" }}>🌡️</div>
              <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Water Temp</div>
              <div style={{ fontSize: "56px", color: "#0f172a", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>68°F</div>
            </div>
            
            <div className="card" style={{ background: "#f8fafc", padding: "40px", border: "2px solid #f1f5f9" }}>
              <div style={{ fontSize: "56px", marginBottom: "20px" }}>🌊</div>
              <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Lake Level</div>
              <div style={{ fontSize: "56px", color: "#0ea5e9", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>651.2<span style={{ fontSize: "32px" }}>ft</span></div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "30px" }}>
            <div className="card" style={{ background: "#f8fafc", padding: "40px", border: "2px solid #f1f5f9" }}>
              <div style={{ fontSize: "56px", marginBottom: "20px" }}>💨</div>
              <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Wind</div>
              <div style={{ fontSize: "48px", color: "#0f172a", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>7 mph <span style={{ color: "#64748b", fontSize: "36px" }}>SW</span></div>
            </div>
            
            <div className="card" style={{ background: "#f8fafc", padding: "40px", border: "2px solid #f1f5f9" }}>
              <div style={{ fontSize: "56px", marginBottom: "20px" }}>🌕</div>
              <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Moon Phase</div>
              <div style={{ fontSize: "48px", color: "#0f172a", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Full Moon</div>
            </div>
          </div>
          
          <div style={{ height: "40px" }} />
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
