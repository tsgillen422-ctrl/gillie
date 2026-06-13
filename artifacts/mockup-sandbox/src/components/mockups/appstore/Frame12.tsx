import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";

export function Frame12() {
  const people = [
    { initials: "JD", name: "Jake Daniels", meta: "3 mutual friends", color: "#0ea5e9", following: false },
    { initials: "SR", name: "Sara Reed", meta: "On the water now", color: "#f59e0b", following: true },
    { initials: "MT", name: "Mike Turner", meta: "5 mutual friends", color: "#10b981", following: false },
    { initials: "CB", name: "Chris Boone", meta: "12 catches logged", color: "#ef4444", following: false },
  ];
  return (
    <AppStoreFrame bgClass="bg-gradient-5">
      <Caption
        line1="FIND YOUR"
        line2="PEOPLE"
        accentWord="PEOPLE"
        subline="Discover nearby boaters, follow friends, and grow your crew."
        accentColor="gold"
      />
      <DeviceMockup activeTab="Map">
        <div className="app-header">
          <div className="app-header-title">Boater Network</div>
        </div>
        <div style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "32px", background: "#f8fafc", minHeight: "100%" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "20px", background: "#fff", borderRadius: "999px", padding: "32px 40px", boxShadow: "0 10px 40px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "44px" }}>🔍</span>
            <span style={{ fontSize: "36px", color: "#94a3b8", fontWeight: 500 }}>Search boaters…</span>
          </div>
          {people.map((p) => (
            <div key={p.name} className="card" style={{ display: "flex", alignItems: "center", gap: "28px", padding: "36px 40px" }}>
              <div style={{ width: "110px", height: "110px", borderRadius: "55px", background: p.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "44px", fontWeight: 800, fontFamily: "'Outfit', sans-serif", flexShrink: 0 }}>{p.initials}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: "40px", fontWeight: 800, color: "#0f172a", fontFamily: "'Outfit', sans-serif" }}>{p.name}</div>
                <div style={{ fontSize: "28px", color: "#64748b", marginTop: "8px" }}>{p.meta}</div>
              </div>
              <div style={{ padding: "20px 44px", borderRadius: "999px", fontSize: "32px", fontWeight: 800, fontFamily: "'Outfit', sans-serif", flexShrink: 0, ...(p.following ? { background: "#e2e8f0", color: "#475569" } : { background: "#0ea5e9", color: "#fff" }) }}>{p.following ? "Following" : "Follow"}</div>
            </div>
          ))}
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
