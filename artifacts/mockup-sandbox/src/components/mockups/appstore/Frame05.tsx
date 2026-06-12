import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";
import tieUp from "./assets/tie-up.jpg";

export function Frame05() {
  return (
    <AppStoreFrame bgClass="bg-gradient-5">
      <Caption 
        line1="PLAN THE"
        line2="NEXT TIE-UP"
        accentWord="TIE-UP"
        subline="Group chats to rally your crew on the water."
        accentColor="gold"
      />
      <DeviceMockup activeTab="Messages">
        <div style={{ background: "#fff", display: "flex", alignItems: "flex-end", padding: "150px 40px 30px", borderBottom: "2px solid #e2e8f0" }}>
           <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
             <div style={{ fontSize: "40px", color: "#0ea5e9" }}>‹</div>
             <div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "#f59e0b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px" }}>🍻</div>
             <div>
               <div style={{ color: "#0f172a", fontSize: "42px", fontWeight: 800 }}>Weekend Tie-Up</div>
               <div style={{ color: "#64748b", fontSize: "28px", fontWeight: 600 }}>4 Members</div>
             </div>
           </div>
        </div>
        
        <div style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "30px", background: "#f8fafc", flex: 1, overflow: "hidden" }}>
          <div style={{ alignSelf: "center", background: "#e2e8f0", padding: "12px 30px", borderRadius: "999px", fontSize: "24px", color: "#64748b", fontWeight: 600, marginBottom: "20px" }}>Today 10:42 AM</div>
          
          <div style={{ display: "flex", gap: "20px", maxWidth: "80%" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#0ea5e9", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "32px", fontWeight: 700 }}>JS</div>
            <div style={{ background: "#e2e8f0", padding: "30px", borderRadius: "30px 30px 30px 0", fontSize: "32px", color: "#0f172a", lineHeight: 1.4 }}>
              Where is everyone heading? We're near Sunset.
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px", maxWidth: "80%" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#f97316", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "32px", fontWeight: 700 }}>MA</div>
            <div style={{ background: "#e2e8f0", padding: "30px", borderRadius: "30px 30px 30px 0", fontSize: "32px", color: "#0f172a", lineHeight: 1.4 }}>
              Just anchored in Party Cove! The water is perfect.
              <img src={tieUp} style={{ width: "100%", height: "240px", objectFit: "cover", borderRadius: "20px", marginTop: "20px" }} alt="Tie up" />
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px", maxWidth: "80%", alignSelf: "flex-end", flexDirection: "row-reverse" }}>
            <div style={{ background: "#0ea5e9", padding: "30px", borderRadius: "30px 30px 0 30px", fontSize: "32px", color: "#fff", lineHeight: 1.4 }}>
              Nice! We're on our way. Drop a pin!
            </div>
          </div>

          <div style={{ display: "flex", gap: "20px", maxWidth: "80%" }}>
            <div style={{ width: "80px", height: "80px", borderRadius: "50%", background: "#f97316", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: "32px", fontWeight: 700 }}>MA</div>
            <div style={{ background: "#e2e8f0", padding: "20px", borderRadius: "30px 30px 30px 0", width: "400px" }}>
              <div style={{ height: "200px", background: "#cbd5e1", borderRadius: "20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "60px" }}>📍</div>
              <div style={{ fontSize: "28px", fontWeight: 700, marginTop: "16px", color: "#0f172a" }}>Shared Location</div>
              <div style={{ fontSize: "24px", color: "#0ea5e9", fontWeight: 600, marginTop: "8px" }}>Tap to view on map</div>
            </div>
          </div>
        </div>
        
        <div style={{ background: "#fff", padding: "30px 40px", borderTop: "2px solid #e2e8f0", display: "flex", alignItems: "center", gap: "30px" }}>
          <div style={{ width: "64px", height: "64px", borderRadius: "32px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px" }}>+</div>
          <div style={{ flex: 1, background: "#f1f5f9", height: "80px", borderRadius: "40px", display: "flex", alignItems: "center", padding: "0 30px", fontSize: "32px", color: "#94a3b8" }}>Message...</div>
          <div style={{ width: "64px", height: "64px", borderRadius: "32px", background: "#0ea5e9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "32px", color: "#fff" }}>↑</div>
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
