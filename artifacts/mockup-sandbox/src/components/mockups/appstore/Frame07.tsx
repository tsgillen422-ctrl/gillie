import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";

export function Frame07() {
  return (
    <AppStoreFrame bgClass="bg-gradient-7">
      <Caption 
        line1="EARN YOUR"
        line2="BOATER RANK"
        accentWord="RANK"
        subline="Level up with badges as you explore the lake."
        accentColor="gold"
      />
      <DeviceMockup activeTab="Profile">
        <div style={{ padding: "180px 40px 40px", background: "#f8fafc", minHeight: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "60px" }}>
            <div style={{ width: "240px", height: "240px", borderRadius: "120px", background: "#0ea5e9", border: "8px solid #fff", boxShadow: "0 20px 40px rgba(0,0,0,0.1)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "80px", color: "#fff", fontWeight: 800 }}>JS</div>
            <h2 style={{ fontSize: "56px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif", margin: "30px 0 10px" }}>Jake Smith</h2>
            <div style={{ background: "#f59e0b", color: "#fff", padding: "12px 30px", borderRadius: "999px", fontSize: "28px", fontWeight: 800 }}>Dale Hollow Adventurer</div>
          </div>
          
          <div style={{ display: "flex", gap: "20px", marginBottom: "60px" }}>
            <div className="card" style={{ flex: 1, textAlign: "center", padding: "30px" }}>
              <div style={{ fontSize: "64px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>14</div>
              <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Catches</div>
            </div>
            <div className="card" style={{ flex: 1, textAlign: "center", padding: "30px" }}>
              <div style={{ fontSize: "64px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>32</div>
              <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Pins</div>
            </div>
            <div className="card" style={{ flex: 1, textAlign: "center", padding: "30px" }}>
              <div style={{ fontSize: "64px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>8</div>
              <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Badges</div>
            </div>
          </div>
          
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px" }}>
            <h3 style={{ fontSize: "40px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>Badges</h3>
            <span style={{ fontSize: "32px", color: "#0ea5e9", fontWeight: 700 }}>See All</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}>
            {[
              { icon: "🎣", name: "First Catch", color: "#3b82f6" },
              { icon: "⚓", name: "Captain", color: "#f59e0b" },
              { icon: "🗺️", name: "Explorer", color: "#10b981" },
              { icon: "📸", name: "Photog", color: "#8b5cf6" },
              { icon: "🏆", name: "Trophy", color: "#ef4444" },
              { icon: "🔒", name: "Locked", color: "#cbd5e1", locked: true }
            ].map((badge, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: "30px", padding: "30px 20px", display: "flex", flexDirection: "column", alignItems: "center", gap: "20px", boxShadow: "0 10px 30px rgba(0,0,0,0.03)", filter: badge.locked ? "grayscale(1) opacity(0.6)" : "none" }}>
                <div style={{ width: "100px", height: "100px", borderRadius: "50%", background: `${badge.color}20`, border: `4px solid ${badge.color}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "48px" }}>{badge.icon}</div>
                <div style={{ fontSize: "24px", fontWeight: 700, color: "#0f172a" }}>{badge.name}</div>
              </div>
            ))}
          </div>
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
