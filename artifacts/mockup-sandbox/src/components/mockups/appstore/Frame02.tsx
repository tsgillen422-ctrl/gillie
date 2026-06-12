import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";
import fishing from "./assets/fishing.jpg";

export function Frame02() {
  return (
    <AppStoreFrame bgClass="bg-gradient-2">
      <Caption 
        line1="SHARE YOUR"
        line2="LAKE LIFE"
        accentWord="LAKE LIFE"
        subline="Catches, reports, polls, and boat showcases."
        accentColor="blue"
      />
      <DeviceMockup activeTab="Feed">
        <div className="app-header">
          <div className="app-header-title">Community Feed</div>
        </div>
        <div style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "40px", background: "#f1f5f9", minHeight: "100%" }}>
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "30px" }}>
              <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", color: "#fff", fontWeight: 700 }}>JS</div>
              <div>
                <div style={{ fontSize: "36px", fontWeight: 800, color: "#0f172a" }}>Jake Smith</div>
                <div style={{ fontSize: "28px", color: "#64748b", marginTop: "4px" }}>Feeling Fishing 🎣 • 2h ago</div>
              </div>
            </div>
            <div style={{ fontSize: "32px", color: "#334155", marginBottom: "30px", lineHeight: 1.5 }}>
              Just pulled this beauty out of Obey River! 5.2lbs! Let's go!
            </div>
            <img src={fishing} style={{ width: "100%", height: "600px", objectFit: "cover", borderRadius: "24px", marginBottom: "30px" }} alt="Catch" />
            <div style={{ display: "flex", gap: "40px", fontSize: "32px", color: "#64748b", fontWeight: 600 }}>
              <span style={{ color: "#ef4444" }}>❤️ 42</span>
              <span>💬 12</span>
              <span>🔄 Share</span>
            </div>
          </div>
          
          <div className="card">
            <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "30px" }}>
              <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px", color: "#fff", fontWeight: 700 }}>AM</div>
              <div>
                <div style={{ fontSize: "36px", fontWeight: 800, color: "#0f172a" }}>Alex Miller</div>
                <div style={{ fontSize: "28px", color: "#64748b", marginTop: "4px" }}>Poll • 4h ago</div>
              </div>
            </div>
            <div style={{ fontSize: "32px", color: "#334155", marginBottom: "30px", fontWeight: 700 }}>
              Where's the best tie-up spot today?
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ position: "relative", height: "80px", background: "#f1f5f9", borderRadius: "20px", overflow: "hidden", display: "flex", alignItems: "center", padding: "0 30px" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "75%", background: "#0ea5e920" }} />
                <span style={{ position: "relative", zIndex: 1, fontSize: "30px", fontWeight: 600, color: "#0ea5e9" }}>Sunset Marina (75%)</span>
              </div>
              <div style={{ position: "relative", height: "80px", background: "#f1f5f9", borderRadius: "20px", overflow: "hidden", display: "flex", alignItems: "center", padding: "0 30px" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "25%", background: "#e2e8f0" }} />
                <span style={{ position: "relative", zIndex: 1, fontSize: "30px", fontWeight: 600, color: "#64748b" }}>Eagle Cove (25%)</span>
              </div>
            </div>
          </div>
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
