import React from "react";
import { AppStoreFrame, Caption, DeviceMockup } from "./_shared";
import fishing from "./assets/fishing.jpg";

export function Frame03() {
  return (
    <AppStoreFrame bgClass="bg-gradient-3">
      <Caption 
        line1="LOG EVERY"
        line2="TROPHY CATCH"
        accentWord="TROPHY"
        subline="Track species, weight, length, and your best spots."
        accentColor="gold"
      />
      <DeviceMockup activeTab="Profile">
        <div style={{ background: "#fff", display: "flex", alignItems: "flex-end", padding: "160px 40px 30px", borderBottom: "2px solid #e2e8f0" }}>
           <div style={{ color: "#0f172a", fontSize: "44px", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Catch Details</div>
        </div>
        <div style={{ padding: "40px", display: "flex", flexDirection: "column", gap: "40px", background: "#f8fafc", minHeight: "100%" }}>
          <div style={{ position: "relative", borderRadius: "40px", overflow: "hidden", boxShadow: "0 20px 50px rgba(0,0,0,0.1)" }}>
            <img src={fishing} style={{ width: "100%", height: "800px", objectFit: "cover" }} alt="Trophy" />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, #020617, transparent)", padding: "80px 40px 40px", color: "#fff" }}>
              <div style={{ fontSize: "56px", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>Largemouth Bass</div>
              <div style={{ fontSize: "32px", opacity: 0.9 }}>Oct 12, 2023 • 6:45 AM</div>
            </div>
          </div>
          
          <div style={{ display: "flex", gap: "20px" }}>
             <div className="card" style={{ flex: 1, padding: "30px", textAlign: "center", background: "#fff" }}>
               <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Weight</div>
               <div style={{ fontSize: "56px", color: "#0ea5e9", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>5.2<span style={{ fontSize: "32px" }}>lb</span></div>
             </div>
             <div className="card" style={{ flex: 1, padding: "30px", textAlign: "center", background: "#fff" }}>
               <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Length</div>
               <div style={{ fontSize: "56px", color: "#0ea5e9", fontWeight: 800, fontFamily: "'Outfit', sans-serif" }}>21<span style={{ fontSize: "32px" }}>in</span></div>
             </div>
          </div>

          <div className="card" style={{ padding: "40px" }}>
            <div style={{ fontSize: "32px", fontWeight: 700, color: "#0f172a", marginBottom: "30px" }}>Catch Info</div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                 <div style={{ width: "80px", height: "80px", borderRadius: "20px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px" }}>📍</div>
                 <div>
                   <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Location</div>
                   <div style={{ fontSize: "32px", color: "#0f172a", fontWeight: 700 }}>Obey River</div>
                 </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                 <div style={{ width: "80px", height: "80px", borderRadius: "20px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px" }}>🪝</div>
                 <div>
                   <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Lure</div>
                   <div style={{ fontSize: "32px", color: "#0f172a", fontWeight: 700 }}>Green Pumpkin Jig</div>
                 </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                 <div style={{ width: "80px", height: "80px", borderRadius: "20px", background: "#f1f5f9", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "36px" }}>🌤️</div>
                 <div>
                   <div style={{ fontSize: "28px", color: "#64748b", fontWeight: 600 }}>Weather</div>
                   <div style={{ fontSize: "32px", color: "#0f172a", fontWeight: 700 }}>Clear, 68°F</div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </DeviceMockup>
    </AppStoreFrame>
  );
}
