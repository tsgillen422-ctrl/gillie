import React from "react";

export const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@700&family=Outfit:wght@400;500;600;700;800;900&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
  
  .appstore-frame {
    width: 1290px;
    height: 2796px;
    position: relative;
    overflow: hidden;
    background: #020617;
    font-family: 'Plus Jakarta Sans', sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  
  .bg-gradient-1 { background: radial-gradient(circle at 50% 0%, #0f172a 0%, #020617 100%); }
  .bg-gradient-2 { background: linear-gradient(135deg, #0f172a 0%, #020617 100%); }
  .bg-gradient-3 { background: radial-gradient(circle at 100% 100%, #0ea5e920 0%, #020617 100%); }
  .bg-gradient-4 { background: linear-gradient(180deg, #0ea5e915 0%, #020617 100%); }
  .bg-gradient-5 { background: radial-gradient(circle at 0% 0%, #1e293b 0%, #020617 100%); }
  .bg-gradient-6 { background: linear-gradient(45deg, #020617 0%, #0ea5e920 100%); }
  .bg-gradient-7 { background: radial-gradient(circle at 50% 50%, #0f172a 0%, #020617 100%); }
  .bg-gradient-8 { background: linear-gradient(to bottom, #020617, #0f172a); }

  .bg-photo {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0.4;
  }

  .caption-block {
    position: absolute;
    top: 6%;
    left: 80px;
    right: 80px;
    text-align: center;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .caption-headline {
    font-family: 'Outfit', sans-serif;
    font-size: 100px;
    font-weight: 800;
    color: #ffffff;
    line-height: 1.05;
    margin: 0;
    text-transform: uppercase;
    letter-spacing: -2px;
    text-shadow: 0 10px 30px rgba(0,0,0,0.5);
  }

  .caption-accent { color: #f59e0b; }
  .caption-blue { color: #0ea5e9; }

  .caption-rule {
    width: 140px;
    height: 14px;
    background: #f59e0b;
    border-radius: 7px;
    margin: 36px 0;
    box-shadow: 0 4px 10px rgba(245, 158, 11, 0.4);
  }

  .caption-subline {
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-size: 46px;
    font-weight: 500;
    color: #e2e8f0;
    line-height: 1.4;
    margin: 0;
    max-width: 1000px;
    text-shadow: 0 4px 12px rgba(0,0,0,0.4);
  }

  .device-mockup {
    position: absolute;
    top: 700px;
    left: 50%;
    transform: translateX(-50%);
    width: 1080px;
    height: 2096px;
    box-sizing: border-box;
    background: #f8fafc;
    border-radius: 120px;
    border: 24px solid #1e293b;
    box-shadow: 0 80px 160px rgba(0,0,0,0.8), inset 0 0 0 12px #000000;
    overflow: hidden;
    z-index: 20;
    display: flex;
    flex-direction: column;
  }

  .dynamic-island {
    position: absolute;
    top: 40px;
    left: 50%;
    transform: translateX(-50%);
    width: 340px;
    height: 90px;
    background: #000000;
    border-radius: 45px;
    z-index: 100;
  }

  .status-bar {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 150px;
    padding: 0 95px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    z-index: 90;
    font-family: 'Plus Jakarta Sans', sans-serif;
    font-weight: 700;
    font-size: 40px;
    color: #000000;
    padding-top: 25px;
  }

  .status-bar.dark-mode { color: #ffffff; }

  .status-icons { display: flex; gap: 18px; align-items: center; font-size: 36px; }

  .app-content {
    flex: 1;
    position: relative;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    background: #f8fafc;
  }

  .app-header {
    padding: 180px 50px 40px;
    background: #fff;
    border-bottom: 2px solid #e2e8f0;
  }
  
  .app-header-title {
    font-size: 64px;
    font-weight: 800;
    color: #0f172a;
    font-family: 'Outfit', sans-serif;
  }

  .bottom-tab-bar {
    height: 240px;
    background: #ffffff;
    border-top: 2px solid #e2e8f0;
    display: flex;
    justify-content: space-around;
    align-items: center;
    padding: 0 60px 40px;
    z-index: 80;
  }

  .bottom-tab-bar.dark-mode {
    background: #0f172a;
    border-top: 2px solid #1e293b;
  }

  .tab-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    color: #94a3b8;
  }

  .tab-item.active { color: #0ea5e9; }
  .tab-icon { font-size: 64px; line-height: 1; }
  .tab-label { font-size: 28px; font-weight: 700; }
  
  .card {
    background: #fff;
    border-radius: 40px;
    padding: 40px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.04);
  }
`;

export function AppStoreFrame({ 
  children, 
  bgClass = "bg-gradient-1",
  bgPhoto,
  scrim = true
}: { 
  children: React.ReactNode;
  bgClass?: string;
  bgPhoto?: string;
  scrim?: boolean;
}) {
  return (
    <div className={`appstore-frame ${bgClass}`}>
      <style>{STYLES}</style>
      {bgPhoto && <img src={bgPhoto} className="bg-photo" alt="" />}
      {bgPhoto && scrim && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(2,6,23,0.9) 0%, rgba(2,6,23,0.4) 50%, rgba(2,6,23,0.9) 100%)' }} />}
      {children}
    </div>
  );
}

export function Caption({
  line1,
  line2,
  accentWord,
  subline,
  accentColor = "gold"
}: {
  line1: string;
  line2: string;
  accentWord?: string;
  subline: string;
  accentColor?: "gold" | "blue";
}) {
  const renderLine = (line: string) => {
    if (!accentWord) return line;
    const parts = line.split(accentWord);
    if (parts.length === 1) return line;
    const accentClass = accentColor === "gold" ? "caption-accent" : "caption-blue";
    return <>{parts[0]}<span className={accentClass}>{accentWord}</span>{parts[1]}</>;
  };

  return (
    <div className="caption-block">
      <h1 className="caption-headline">{renderLine(line1)}<br/>{renderLine(line2)}</h1>
      <div className="caption-rule" />
      <p className="caption-subline">{subline}</p>
    </div>
  );
}

export function DeviceMockup({
  children,
  activeTab = "Map",
  darkMode = false,
  hideTabs = false
}: {
  children: React.ReactNode;
  activeTab?: string;
  darkMode?: boolean;
  hideTabs?: boolean;
}) {
  return (
    <div className="device-mockup">
      <div className="dynamic-island" />
      <div className={`status-bar ${darkMode ? 'dark-mode' : ''}`}>
        <span>9:41</span>
        <div className="status-icons">
          <span>📶</span>
          <span>5G</span>
          <span>🔋</span>
        </div>
      </div>
      <div className="app-content">{children}</div>
      {!hideTabs && (
        <div className={`bottom-tab-bar ${darkMode ? 'dark-mode' : ''}`}>
          <TabItem icon="🗺️" label="Map" active={activeTab === "Map"} />
          <TabItem icon="📱" label="Feed" active={activeTab === "Feed"} />
          <TabItem icon="💬" label="Messages" active={activeTab === "Messages"} />
          <TabItem icon="👤" label="Profile" active={activeTab === "Profile"} />
        </div>
      )}
    </div>
  );
}

function TabItem({ icon, label, active }: { icon: string; label: string; active: boolean }) {
  return (
    <div className={`tab-item ${active ? 'active' : ''}`}>
      <span className="tab-icon" style={{ filter: active ? "grayscale(0)" : "grayscale(1) opacity(0.5)" }}>{icon}</span>
      <span className="tab-label">{label}</span>
    </div>
  );
}

// Hosts a REAL screenshot of the live app inside the device. A solid strip at the
// top hosts the iOS status bar; the capture (which includes the app's own header
// and bottom nav) fills the rest at its native aspect ratio.
export function RealScreen({
  src,
  strip = "#ffffff",
  alt = "",
}: {
  src: string;
  strip?: string;
  alt?: string;
}) {
  return (
    <div style={{ position: "absolute", inset: 0, background: strip }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "150px", background: strip, zIndex: 5 }} />
      <img
        src={src}
        style={{
          position: "absolute",
          top: "150px",
          left: 0,
          right: 0,
          bottom: 0,
          width: "100%",
          height: "calc(100% - 150px)",
          objectFit: "cover",
          objectPosition: "top",
        }}
        alt={alt}
      />
    </div>
  );
}
