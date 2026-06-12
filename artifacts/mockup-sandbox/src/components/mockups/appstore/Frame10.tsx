import React from "react";
import { AppStoreFrame } from "./_shared";
import friendsBoat from "./assets/friends-on-boat.png";
import appIcon from "./assets/app-icon.png";

export function Frame10() {
  return (
    <AppStoreFrame bgPhoto={friendsBoat} scrim={true}>
      <div style={{ 
        display: "flex", 
        flexDirection: "column", 
        alignItems: "center", 
        justifyContent: "center",
        height: "100%",
        zIndex: 50,
        position: "relative",
        padding: "0 80px",
        textAlign: "center"
      }}>
        <img src={appIcon} style={{ width: "360px", height: "360px", borderRadius: "80px", boxShadow: "0 40px 80px rgba(0,0,0,0.6)", marginBottom: "60px" }} alt="App Icon" />
        
        <h1 style={{ 
          fontFamily: "'Dancing Script', cursive", 
          fontSize: "240px", 
          color: "#ffffff", 
          margin: "0 0 20px 0",
          textShadow: "0 10px 40px rgba(0,0,0,0.5)",
          lineHeight: 1
        }}>
          Gillie
        </h1>
        
        <p style={{ 
          fontFamily: "'Outfit', sans-serif",
          fontSize: "72px", 
          color: "#f59e0b", 
          fontWeight: 800, 
          margin: "0 0 60px 0",
          textShadow: "0 4px 20px rgba(0,0,0,0.4)"
        }}>
          The lake, in your pocket.
        </p>
        
        <div style={{ 
          width: "160px", 
          height: "8px", 
          background: "#0ea5e9", 
          borderRadius: "4px", 
          marginBottom: "60px" 
        }} />
        
        <p style={{ 
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: "44px", 
          color: "#e2e8f0", 
          margin: 0,
          fontWeight: 600,
          textShadow: "0 4px 12px rgba(0,0,0,0.4)"
        }}>
          Find friends • Log catches • Stay safe
        </p>
      </div>
    </AppStoreFrame>
  );
}
