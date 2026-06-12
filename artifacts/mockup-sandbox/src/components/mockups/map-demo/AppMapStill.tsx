// Static, no-WebGL still of the real Gillie map screen for use as a phone-screen
// asset in the promo video. Uses the same Esri World Imagery basemap the live app
// renders (fetched as a static raster), with the app's real chrome (search pill,
// right-side control stack, Lake Activity card) and the app's avatar-boat + pin
// markers placed over the water. Screenshot this at a phone-portrait viewport.

import satUrl from "./dhl-sat.png";

const SAT = satUrl;

type Occ = { initials: string; color: string };

function Avatar({ o, mini }: { o: Occ; mini?: boolean }) {
  return (
    <div className={`snap-avatar${mini ? " mini" : ""}`} style={{ borderColor: o.color }}>
      <div className="snap-initials" style={{ background: o.color }}>{o.initials}</div>
      {!mini && <i className="snap-online" />}
    </div>
  );
}

function Boat({ left, top, occ, noBoat }: { left: string; top: string; occ: Occ[]; noBoat?: boolean }) {
  const crew = occ.length > 1;
  return (
    <div className={`snap-marker${crew ? " crew" : ""}`} style={{ left, top }}>
      <div className="snap-bob">
        {crew ? (
          <div className="crew-avatars">
            {occ.slice(0, 3).map((o, i) => <Avatar key={i} o={o} mini />)}
            {occ.length > 3 && <div className="crew-more">+{occ.length - 3}</div>}
            <i className="snap-online crew-online" />
          </div>
        ) : (
          <Avatar o={occ[0]} />
        )}
        {!noBoat && <div className="snap-boat">🚤</div>}
      </div>
      {crew && <div className="crew-label">{occ.length} aboard</div>}
    </div>
  );
}

function PinCluster({ left, top, emoji, label }: { left: string; top: string; emoji: string; label: string }) {
  return (
    <div className="lake-pin" style={{ left, top }}>
      <div className="cluster-row">
        <div className="pin-cluster cluster-sm"><span className="pin-cluster-emoji">{emoji}</span></div>
        <div className="place-title cluster-label">{label}</div>
      </div>
    </div>
  );
}

function PinSingle({ left, top, emoji, label }: { left: string; top: string; emoji: string; label: string }) {
  return (
    <div className="lake-pin" style={{ left, top }}>
      <div className="place-row">
        <div className="place-badge tier-high"><span className="place-badge-emoji">{emoji}</span></div>
        <div className="place-title" style={{ color: "#fff" }}>{label}</div>
      </div>
    </div>
  );
}

export function AppMapStill() {
  return (
    <div className="screen">
      <style>{CSS}</style>
      <img className="sat" src={SAT} alt="Dale Hollow Lake" />
      <div className="water-tint" />

      {/* ---- avatar-boat markers over the water ---- */}
      <Boat left="40%" top="36%" occ={[{ initials: "JS", color: "#0ea5e9" }, { initials: "MA", color: "#f97316" }, { initials: "PR", color: "#a855f7" }, { initials: "DA", color: "#22c55e" }]} />
      <Boat left="70%" top="17%" occ={[{ initials: "SA", color: "#0ea5e9" }]} />
      <Boat left="74%" top="33%" occ={[{ initials: "TA", color: "#f97316" }]} />
      <Boat left="13%" top="40%" occ={[{ initials: "WA", color: "#22c55e" }]} />
      <Boat left="31%" top="52%" occ={[{ initials: "LU", color: "#ec4899" }]} noBoat />

      {/* ---- place pins ---- */}
      <PinCluster left="46%" top="30%" emoji="🎣" label="3 fishing spots" />

      {/* ---- app chrome: search pill ---- */}
      <div className="search-pill">
        <span className="search-ico">🔍</span>
        <span className="search-txt">Search the lake</span>
      </div>

      {/* ---- app chrome: right control stack ---- */}
      <div className="ctrl-stack">
        <button className="ctrl-btn">
          <span style={{ fontSize: 18 }}>⚓</span>
          <span className="ctrl-badge">12</span>
        </button>
        <button className="ctrl-btn">🔥</button>
        <button className="ctrl-btn fab">＋</button>
        <div className="zoom-pill">
          <span>＋</span>
          <span className="zoom-div" />
          <span>－</span>
          <span className="zoom-div" />
          <span style={{ fontSize: 15 }}>◎</span>
        </div>
      </div>

      {/* ---- app chrome: lake activity card ---- */}
      <div className="activity-card">
        <div className="ac-head"><span>🔥</span> Lake Activity</div>
        <div className="ac-bar" />
        <div className="ac-labels"><span>Quiet</span><span>Buzzing</span></div>
      </div>
    </div>
  );
}

const CSS = `
  .screen { position: relative; width: 100%; height: 100vh; overflow: hidden; background: #dbeafe;
    font-family: Inter, -apple-system, system-ui, sans-serif; }
  .sat { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .water-tint { position: absolute; inset: 0; background:
    radial-gradient(120% 80% at 50% 18%, rgba(2,132,199,0.04), rgba(2,6,23,0.10) 75%); pointer-events: none; }

  /* boat marker */
  .snap-marker { position: absolute; width: 56px; height: 64px; transform: translate(-50%, -100%); }
  .snap-bob { position: absolute; left: 50%; bottom: 0; transform: translateX(-50%);
    display: flex; flex-direction: column; align-items: center; }
  .snap-avatar { position: relative; width: 40px; height: 40px; border-radius: 50%; border: 3px solid #0284c7;
    background: #fff; box-shadow: 0 4px 9px rgba(0,0,0,0.32), 0 0 0 3px rgba(255,255,255,0.9); }
  .snap-initials { width: 100%; height: 100%; border-radius: 50%; display: flex; align-items: center;
    justify-content: center; color: #fff; font-weight: 700; font-size: 15px; }
  .snap-online { position: absolute; bottom: -1px; right: -1px; width: 11px; height: 11px; border-radius: 50%;
    background: #22c55e; border: 2px solid #fff; }
  .snap-boat { font-size: 22px; line-height: 1; margin-top: -4px; filter: drop-shadow(0 5px 5px rgba(11,58,91,0.30)); }

  .snap-marker.crew { width: 92px; }
  .crew-avatars { position: relative; display: flex; flex-direction: row; align-items: center; }
  .snap-avatar.mini { width: 30px; height: 30px; border-width: 2px; margin-left: -11px;
    box-shadow: 0 3px 7px rgba(0,0,0,0.32), 0 0 0 2px rgba(255,255,255,0.92); }
  .snap-avatar.mini:first-child { margin-left: 0; }
  .snap-avatar.mini .snap-initials { font-size: 12px; }
  .crew-more { margin-left: -9px; min-width: 26px; height: 26px; padding: 0 6px; border-radius: 999px;
    background: #0f2942; color: #fff; font-size: 12px; font-weight: 800; display: flex; align-items: center;
    justify-content: center; border: 2px solid #fff; box-shadow: 0 3px 7px rgba(0,0,0,0.3); }
  .crew-online { position: absolute; right: -2px; bottom: -2px; }
  .crew-label { position: absolute; left: 50%; bottom: -15px; transform: translateX(-50%); white-space: nowrap;
    font-size: 11px; font-weight: 800; color: #fff; background: rgba(8,25,40,0.85); padding: 1px 8px;
    border-radius: 999px; box-shadow: 0 2px 6px rgba(0,0,0,0.3); }

  /* pins */
  .lake-pin { position: absolute; transform: translate(-6px, -50%); }
  .cluster-row { display: flex; flex-direction: row; align-items: center; gap: 7px; }
  .pin-cluster { display: flex; align-items: center; justify-content: center; border-radius: 999px;
    background: linear-gradient(180deg, #ffffff 0%, #eaf6ff 100%); border: 2px solid #38bdf8;
    box-shadow: 0 6px 16px rgba(2,132,199,0.35); color: #0369a1; font-weight: 800; width: 36px; height: 36px; }
  .pin-cluster .pin-cluster-emoji { line-height: 1; font-size: 18px; }
  .place-row { display: flex; flex-direction: row; align-items: center; gap: 7px; }
  .place-badge { display: flex; align-items: center; justify-content: center; flex: none; background: #fff;
    border-radius: 999px; border: 2px solid rgba(255,255,255,0.95); width: 34px; height: 34px;
    box-shadow: 0 5px 13px rgba(0,0,0,0.28); }
  .place-badge-emoji { line-height: 1; font-size: 17px; }
  .place-title { font-size: 13px; font-weight: 800; white-space: nowrap;
    text-shadow: 0 1px 2px rgba(0,0,0,0.55), 0 0 4px rgba(0,0,0,0.45); }
  .cluster-label { color: #0369a1; text-shadow: none; }

  /* search pill */
  .search-pill { position: absolute; top: 16px; left: 16px; right: 70px; display: flex; align-items: center;
    gap: 9px; background: #fff; border: 1px solid #e5e7eb; border-radius: 999px; padding: 11px 16px;
    box-shadow: 0 6px 18px rgba(2,6,23,0.18); }
  .search-ico { font-size: 14px; opacity: 0.6; }
  .search-txt { font-size: 14px; color: #64748b; font-weight: 500; }

  /* right control stack */
  .ctrl-stack { position: absolute; top: 74px; right: 14px; display: flex; flex-direction: column;
    align-items: center; gap: 12px; }
  .ctrl-btn { position: relative; width: 44px; height: 44px; border-radius: 50%; border: 1px solid #e5e7eb;
    background: #fff; box-shadow: 0 4px 12px rgba(2,6,23,0.18); display: flex; align-items: center;
    justify-content: center; font-size: 19px; color: #0f172a; cursor: default; }
  .ctrl-btn.fab { background: hsl(40,68%,58%); color: #3a2a06; border-color: hsl(40,60%,50%); font-size: 24px; font-weight: 700; }
  .ctrl-badge { position: absolute; top: -4px; right: -4px; min-width: 19px; height: 19px; padding: 0 4px;
    border-radius: 999px; background: #10b981; color: #fff; font-size: 11px; font-weight: 800;
    display: flex; align-items: center; justify-content: center; }
  .zoom-pill { display: flex; flex-direction: column; align-items: center; background: #fff; border: 1px solid #e5e7eb;
    border-radius: 999px; box-shadow: 0 4px 12px rgba(2,6,23,0.18); padding: 8px 0; width: 44px;
    color: #0f172a; font-size: 18px; gap: 6px; }
  .zoom-div { width: 22px; height: 1px; background: #e5e7eb; }

  /* lake activity card */
  .activity-card { position: absolute; bottom: 18px; left: 16px; background: rgba(255,255,255,0.95);
    backdrop-filter: blur(8px); border: 1px solid #e5e7eb; border-radius: 18px; padding: 12px 14px;
    box-shadow: 0 8px 24px rgba(2,6,23,0.22); }
  .ac-head { display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 700; color: #0f172a; }
  .ac-bar { width: 150px; height: 8px; border-radius: 999px; margin-top: 8px;
    background: linear-gradient(90deg, #38bdf8, #f59e0b, #ef4444); }
  .ac-labels { display: flex; justify-content: space-between; font-size: 10px; color: #64748b; margin-top: 4px; }
`;
