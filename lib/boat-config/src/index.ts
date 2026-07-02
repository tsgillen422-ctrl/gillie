// Single source of truth for boat types and boat artwork.
// Consumed by the web app (map markers + settings preview), the mobile app,
// and the API server (validation). To add a new boat type, add an entry to
// BOAT_TYPES and its artwork to BOAT_SVGS below — no app code changes needed.
//
// Glossy emoji style: each colored surface gets a bright top sheen and a darker
// shaded waterline so the hull reads as a rounded, dimensional object instead of
// a flat shape. Windshields/windows use a glassy cyan gradient with a reflection.
// The base color uses currentColor so the user's chosen boat color flows through
// without injecting any user data into the markup; the sheen/shade overlays are
// pure white/black gradients, so they work for any color.

const INK = "#27323a"; // soft cartoon outline color

// Reusable per-boat gradient defs. `id` is prefixed per boat type so multiple
// SVGs on the page never resolve each other's gradients. The definitions are
// identical across instances of the same type, so a shared id is safe.
const shadeDefs = (id: string) => `<defs>
    <linearGradient id="${id}-g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.6"/>
      <stop offset="0.45" stop-color="#ffffff" stop-opacity="0.08"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="${id}-s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0.4" stop-color="#000000" stop-opacity="0"/>
      <stop offset="1" stop-color="#000000" stop-opacity="0.36"/>
    </linearGradient>
    <linearGradient id="${id}-gl" x1="0" y1="0" x2="0.25" y2="1">
      <stop offset="0" stop-color="#e2f8ff"/>
      <stop offset="0.55" stop-color="#8ad6ef"/>
      <stop offset="1" stop-color="#46b7e0"/>
    </linearGradient>
  </defs>`;

// Performance boat: pointed bow, swept windshield, racing stripe.
const SB_HULL =
  "M5 22 H47 C54 22 60 25 62 28.5 C62.6 29.7 61.8 31 60.2 31.6 L52 35 C50.5 35.6 49 36 47 36 H15 C12.5 36 10.8 35.2 9.3 33.6 L4.5 28.5 C3.2 27.1 3.3 23.4 5 22 Z";
export const SPEEDBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("sb")}
  <ellipse cx="32" cy="37.8" rx="27" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <path d="${SB_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${SB_HULL}" fill="url(#sb-g)"/>
  <path d="${SB_HULL}" fill="url(#sb-s)"/>
  <rect x="10" y="23.6" width="34" height="3.2" rx="1.6" fill="#ffffff" opacity="0.92"/>
  <path d="M9 32 C12 33.8 16 34.6 20 34.6 H44 C47 34.6 49.5 34 52 32.8 L53.6 32 C49 32.6 12 32.6 9 32 Z" fill="#001a2b" opacity="0.32"/>
  <path d="M34 13.5 C36.5 13.5 38.5 14.5 40 16.2 L45 22 H31 V16.5 C31 14.7 32 13.5 34 13.5 Z" fill="url(#sb-gl)" stroke="${INK}" stroke-width="2.1" stroke-linejoin="round"/>
  <path d="M33.6 15.4 L37.6 19.6 H34 Z" fill="#ffffff" opacity="0.85"/>
</svg>`;

// Bass boat: deep-V hull, center console with a windshield, and two rods
// angled off the stern with fishing lines.
const FB_HULL =
  "M5 24 H49 C55 24 60 26.5 62 29.5 C62.7 30.6 61.9 31.9 60.4 32.5 L52 36 C50.5 36.6 49 37 47 37 H14 C11.5 37 9.8 36.2 8.3 34.6 L4 29.5 C2.8 28.1 3.2 25.3 5 24 Z";
export const FISHINGBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("fb")}
  <ellipse cx="32" cy="38.4" rx="27" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <path d="M44 24 L40 9" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M40 9 C46 11 49 15 50.5 20" stroke="#001a2b" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/>
  <path d="M47 24 L52 10" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
  <path d="M52 10 C57 12.5 59.5 16.5 60.5 21" stroke="#001a2b" stroke-width="0.9" stroke-linecap="round" opacity="0.55"/>
  <path d="${FB_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${FB_HULL}" fill="url(#fb-g)"/>
  <path d="${FB_HULL}" fill="url(#fb-s)"/>
  <rect x="10" y="25.6" width="34" height="3" rx="1.5" fill="#ffffff" opacity="0.9"/>
  <path d="M9 33 C12 34.8 16 35.6 20 35.6 H44 C47 35.6 49.5 35 52 33.8 L53.6 33 C49 33.6 12 33.6 9 33 Z" fill="#001a2b" opacity="0.3"/>
  <rect x="24" y="16" width="13" height="9" rx="2" fill="currentColor" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <rect x="24" y="16" width="13" height="9" rx="2" fill="url(#fb-g)"/>
  <rect x="24" y="16" width="13" height="9" rx="2" fill="url(#fb-s)"/>
  <path d="M25 16 C25 13.6 27 12 29.5 12 H33 L36.5 16 Z" fill="url(#fb-gl)" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <path d="M27 15.4 L29.6 12.6 H31.4 L28.8 15.4 Z" fill="#ffffff" opacity="0.75"/>
</svg>`;

// Wake boat: sporty hull with a wakeboard tower arching over the cockpit.
const WK_HULL =
  "M6 23 H46 C53 23 59 25.5 61.5 29 C62.2 30.1 61.4 31.4 59.8 32 L52 35.2 C50.5 35.8 49 36.2 47 36.2 H15 C12.5 36.2 10.8 35.4 9.3 33.8 L5 29 C3.8 27.6 4.2 24.3 6 23 Z";
export const WAKEBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("wk")}
  <ellipse cx="32" cy="38" rx="27" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <path d="M18 23 C20 12 30 7 40 7.5" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
  <path d="M46 23 C46 15 44 10 40 7.5" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" fill="none"/>
  <circle cx="40" cy="7.5" r="2.6" fill="currentColor" stroke="${INK}" stroke-width="1.6"/>
  <path d="${WK_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${WK_HULL}" fill="url(#wk-g)"/>
  <path d="${WK_HULL}" fill="url(#wk-s)"/>
  <rect x="11" y="24.6" width="33" height="3" rx="1.5" fill="#ffffff" opacity="0.92"/>
  <path d="M10 32.4 C13 34.2 17 35 21 35 H44 C47 35 49.5 34.4 52 33.2 L53.4 32.4 C49 33 13 33 10 32.4 Z" fill="#001a2b" opacity="0.3"/>
  <path d="M28 16.5 C30.5 16.5 32.5 17.4 34 19 L37.5 23 H25 V19.2 C25 17.6 26 16.5 28 16.5 Z" fill="url(#wk-gl)" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M27.6 18.2 L30.8 21.4 H27.8 Z" fill="#ffffff" opacity="0.85"/>
</svg>`;

// Pontoon: flat deck on two tubes with a sun canopy.
export const PONTOON_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("pn")}
  <ellipse cx="32" cy="38.6" rx="26" ry="2.8" fill="#0b2f4a" opacity="0.22"/>
  <rect x="7" y="29" width="50" height="7" rx="3.5" fill="currentColor" stroke="${INK}" stroke-width="2.4"/>
  <rect x="7" y="29" width="50" height="7" rx="3.5" fill="url(#pn-g)"/>
  <rect x="7" y="29" width="50" height="7" rx="3.5" fill="url(#pn-s)"/>
  <rect x="6" y="21" width="52" height="8" rx="2.5" fill="currentColor" stroke="${INK}" stroke-width="2.4"/>
  <rect x="6" y="21" width="52" height="8" rx="2.5" fill="url(#pn-g)"/>
  <rect x="6" y="21" width="52" height="8" rx="2.5" fill="url(#pn-s)"/>
  <rect x="9" y="22.8" width="46" height="2.6" rx="1.3" fill="#ffffff" opacity="0.88"/>
  <rect x="13" y="6.5" width="38" height="5.5" rx="2.7" fill="#ffffff" stroke="${INK}" stroke-width="2"/>
  <rect x="13" y="6.5" width="38" height="5.5" rx="2.7" fill="url(#pn-s)" opacity="0.45"/>
  <rect x="15.2" y="11.5" width="2.6" height="10.5" rx="1.3" fill="${INK}"/>
  <rect x="46.2" y="11.5" width="2.6" height="10.5" rx="1.3" fill="${INK}"/>
</svg>`;

// Cabin cruiser: mid-size hull with an enclosed cabin and glassy windshield.
const CB_HULL =
  "M5 25 H50 C56 25 60.5 27 62 29.8 C62.6 31 61.8 32.2 60.2 32.8 L52 36 C50.5 36.6 49 37 47 37 H15 C12.5 37 10.8 36.2 9.3 34.6 L4.6 30 C3.4 28.6 3.5 26.3 5 25 Z";
export const CABINCRUISER_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("cb")}
  <ellipse cx="32" cy="38.4" rx="27" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <path d="M17 25 V16.5 C17 14.5 18.4 13 20.5 13 H36 C38.5 13 40.5 14 42 15.8 L49.5 25 Z" fill="#ffffff" stroke="${INK}" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M17 25 V16.5 C17 14.5 18.4 13 20.5 13 H36 C38.5 13 40.5 14 42 15.8 L49.5 25 Z" fill="url(#cb-s)" opacity="0.35"/>
  <path d="M36.5 15.5 C37.6 15.9 38.6 16.6 39.4 17.6 L44 23 H35 V16.8 C35 16.1 35.6 15.5 36.5 15.5 Z" fill="url(#cb-gl)" stroke="${INK}" stroke-width="1.8" stroke-linejoin="round"/>
  <rect x="20.5" y="16.5" width="4.6" height="3.4" rx="1.4" fill="url(#cb-gl)" stroke="${INK}" stroke-width="1.3"/>
  <rect x="27.5" y="16.5" width="4.6" height="3.4" rx="1.4" fill="url(#cb-gl)" stroke="${INK}" stroke-width="1.3"/>
  <path d="${CB_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${CB_HULL}" fill="url(#cb-g)"/>
  <path d="${CB_HULL}" fill="url(#cb-s)"/>
  <rect x="10" y="26.6" width="40" height="3" rx="1.5" fill="#ffffff" opacity="0.9"/>
  <path d="M10 33.4 C13 35.2 17 36 21 36 H44 C47 36 49.5 35.4 52 34.2 L53.4 33.4 C49 34 13 34 10 33.4 Z" fill="#001a2b" opacity="0.3"/>
</svg>`;

// Center console: open deep-V hull with a slim console and T-top.
const CT_HULL =
  "M5 24 H48 C54.5 24 60 26.5 62 29.8 C62.6 30.9 61.8 32.2 60.2 32.8 L52 36 C50.5 36.6 49 37 47 37 H14 C11.5 37 9.8 36.2 8.3 34.6 L4.2 30 C3 28.6 3.3 25.3 5 24 Z";
export const CENTERCONSOLE_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("ct")}
  <ellipse cx="32" cy="38.4" rx="27" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <rect x="22.5" y="8" width="17" height="3" rx="1.5" fill="currentColor" stroke="${INK}" stroke-width="1.6"/>
  <rect x="22.5" y="8" width="17" height="3" rx="1.5" fill="url(#ct-s)" opacity="0.4"/>
  <rect x="25" y="11" width="2.2" height="7" rx="1.1" fill="${INK}"/>
  <rect x="34.8" y="11" width="2.2" height="7" rx="1.1" fill="${INK}"/>
  <rect x="26" y="17.5" width="10" height="6.5" rx="1.8" fill="currentColor" stroke="${INK}" stroke-width="1.9" stroke-linejoin="round"/>
  <rect x="26" y="17.5" width="10" height="6.5" rx="1.8" fill="url(#ct-g)"/>
  <rect x="26" y="17.5" width="10" height="6.5" rx="1.8" fill="url(#ct-s)"/>
  <path d="M27 17.5 C27 15.9 28.2 14.8 30 14.8 H32.5 L35 17.5 Z" fill="url(#ct-gl)" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
  <path d="${CT_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${CT_HULL}" fill="url(#ct-g)"/>
  <path d="${CT_HULL}" fill="url(#ct-s)"/>
  <rect x="10" y="25.6" width="36" height="3" rx="1.5" fill="#ffffff" opacity="0.9"/>
  <path d="M9 33 C12 34.8 16 35.6 20 35.6 H44 C47 35.6 49.5 35 52 33.8 L53.6 33 C49 33.6 12 33.6 9 33 Z" fill="#001a2b" opacity="0.3"/>
</svg>`;

// Jon boat: flat-bottom utility hull with squared bow, bench seats, and a
// small tiller outboard.
const JB_HULL =
  "M8 24 C7 24 6.2 24.8 6.4 25.8 L8 32.5 C8.5 34.5 10.2 35.5 12.5 35.5 H50 C52.5 35.5 54.4 34.4 55 32.5 L57.6 25.8 C57.9 24.8 57.1 24 56 24 Z";
export const JONBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("jb")}
  <ellipse cx="32" cy="37.6" rx="26" ry="2.8" fill="#0b2f4a" opacity="0.22"/>
  <rect x="53" y="15.5" width="4" height="7" rx="1.6" fill="${INK}"/>
  <rect x="53.8" y="21" width="2.4" height="7.5" rx="1.2" fill="${INK}"/>
  <path d="M50 15 L58 17.5" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
  <path d="${JB_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${JB_HULL}" fill="url(#jb-g)"/>
  <path d="${JB_HULL}" fill="url(#jb-s)"/>
  <rect x="9.5" y="25.6" width="45" height="2.8" rx="1.4" fill="#ffffff" opacity="0.9"/>
  <rect x="16" y="28.6" width="4.5" height="5" rx="1.2" fill="#001a2b" opacity="0.35"/>
  <rect x="30" y="28.6" width="4.5" height="5" rx="1.2" fill="#001a2b" opacity="0.35"/>
  <path d="M10 32.4 C14 34.2 20 34.8 26 34.8 H44 C48 34.8 51 34.2 53.5 32.8 C48 33.6 14 33.4 10 32.4 Z" fill="#001a2b" opacity="0.28"/>
</svg>`;

// Houseboat: wide barge hull carrying a boxy cabin with windows, a flat sun
// deck, and a stern railing.
const HB_HULL =
  "M6 28 H58 L55 34 C54.2 35.6 52.5 36.5 50 36.5 H14 C11.5 36.5 9.8 35.6 9 34 Z";
export const HOUSEBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("hb")}
  <ellipse cx="32" cy="38.8" rx="27" ry="2.8" fill="#0b2f4a" opacity="0.22"/>
  <rect x="12" y="8" width="40" height="3" rx="1.5" fill="currentColor" stroke="${INK}" stroke-width="1.6"/>
  <rect x="12" y="8" width="40" height="3" rx="1.5" fill="url(#hb-s)" opacity="0.4"/>
  <rect x="14.5" y="4.5" width="2" height="4" rx="1" fill="${INK}"/>
  <rect x="24.5" y="4.5" width="2" height="4" rx="1" fill="${INK}"/>
  <rect x="34.5" y="4.5" width="2" height="4" rx="1" fill="${INK}"/>
  <rect x="44.5" y="4.5" width="2" height="4" rx="1" fill="${INK}"/>
  <rect x="12" y="4" width="40" height="1.8" rx="0.9" fill="${INK}"/>
  <rect x="11" y="11" width="42" height="17" rx="2.4" fill="#ffffff" stroke="${INK}" stroke-width="2.2"/>
  <rect x="11" y="11" width="42" height="17" rx="2.4" fill="url(#hb-s)" opacity="0.35"/>
  <rect x="14.5" y="14.5" width="7" height="6" rx="1.6" fill="url(#hb-gl)" stroke="${INK}" stroke-width="1.4"/>
  <rect x="25" y="14.5" width="7" height="6" rx="1.6" fill="url(#hb-gl)" stroke="${INK}" stroke-width="1.4"/>
  <rect x="35.5" y="14.5" width="7" height="6" rx="1.6" fill="url(#hb-gl)" stroke="${INK}" stroke-width="1.4"/>
  <rect x="45.5" y="14.5" width="4.5" height="11" rx="1.6" fill="currentColor" stroke="${INK}" stroke-width="1.6"/>
  <rect x="45.5" y="14.5" width="4.5" height="11" rx="1.6" fill="url(#hb-s)" opacity="0.4"/>
  <path d="${HB_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${HB_HULL}" fill="url(#hb-g)"/>
  <path d="${HB_HULL}" fill="url(#hb-s)"/>
  <rect x="9" y="29.4" width="46" height="2.6" rx="1.3" fill="#ffffff" opacity="0.9"/>
  <path d="M10 34 C14 35.6 20 36 26 36 H44 C48 36 51 35.4 53.5 34.4 C48 35 14 35 10 34 Z" fill="#001a2b" opacity="0.28"/>
</svg>`;

// Sailboat: hull with a tall mainsail and jib.
const SL_HULL =
  "M10 27 H54 L48 34 C46.7 35.6 45 36 43 36 H21 C19 36 17.3 35.4 16 34 Z";
export const SAILBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("sl")}
  <ellipse cx="32" cy="37.5" rx="24" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <rect x="31" y="4.5" width="2.6" height="23.5" rx="1.3" fill="${INK}"/>
  <path d="M35 6 C44.5 11 47.5 18 47.5 25 L35 25 Z" fill="#ffffff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M35 6 C44.5 11 47.5 18 47.5 25 L35 25 Z" fill="url(#sl-s)" opacity="0.4"/>
  <path d="M29 9 L29 25 L18 25 C21 18.5 25 13 29 9 Z" fill="#ffffff" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M29 9 L29 25 L18 25 C21 18.5 25 13 29 9 Z" fill="url(#sl-s)" opacity="0.32"/>
  <path d="${SL_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${SL_HULL}" fill="url(#sl-g)"/>
  <path d="${SL_HULL}" fill="url(#sl-s)"/>
  <rect x="13" y="27.4" width="38" height="2.6" rx="1.3" fill="#ffffff" opacity="0.9"/>
  <path d="M16 33 H48 C46.7 34.6 45 35 43 35 H21 C19 35 17.3 34.6 16 33 Z" fill="#001a2b" opacity="0.28"/>
</svg>`;

// Kayak: slim hull pointed at both ends with a paddle.
const KY_HULL = "M4 26 C14 21 50 21 60 26 C50 31 14 31 4 26 Z";
export const KAYAK_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("ky")}
  <ellipse cx="32" cy="33.5" rx="27" ry="2.6" fill="#0b2f4a" opacity="0.22"/>
  <path d="${KY_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${KY_HULL}" fill="url(#ky-g)"/>
  <path d="${KY_HULL}" fill="url(#ky-s)"/>
  <ellipse cx="32" cy="25" rx="6.5" ry="2.3" fill="#001a2b" opacity="0.5"/>
  <path d="M8 27.4 C18 29.4 46 29.4 56 27.4 C46 29 18 29 8 27.4 Z" fill="#001a2b" opacity="0.26"/>
  <rect x="18" y="12.6" width="28" height="2.8" rx="1.4" fill="#b07636" stroke="${INK}" stroke-width="1.3"/>
  <rect x="18" y="12.6" width="28" height="1.2" rx="0.6" fill="#ffffff" opacity="0.4"/>
</svg>`;

// Canoe: open hull with upswept pointed ends, bench thwarts, and a single
// vertical paddle.
const CN_HULL =
  "M4 21.5 C5 26.5 12 31 32 31 C52 31 59 26.5 60 21.5 C60.4 20.3 59.2 19.6 58 20.2 C52 23.2 42 24.5 32 24.5 C22 24.5 12 23.2 6 20.2 C4.8 19.6 3.6 20.3 4 21.5 Z";
export const CANOE_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("cn")}
  <ellipse cx="32" cy="34" rx="26" ry="2.6" fill="#0b2f4a" opacity="0.22"/>
  <rect x="41" y="4" width="2.4" height="17" rx="1.2" fill="#b07636" stroke="${INK}" stroke-width="1.1"/>
  <path d="M40 20 C40 24 44.4 24 44.4 20 L44.4 17.5 L40 17.5 Z" fill="#b07636" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="${CN_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${CN_HULL}" fill="url(#cn-g)"/>
  <path d="${CN_HULL}" fill="url(#cn-s)"/>
  <path d="M10 24.4 C17 26.6 24 27.4 32 27.4 C40 27.4 47 26.6 54 24.4 C47 26 17 26 10 24.4 Z" fill="#001a2b" opacity="0.32"/>
  <rect x="18" y="23.6" width="8" height="2" rx="1" fill="#001a2b" opacity="0.4"/>
  <rect x="30" y="24.2" width="8" height="2" rx="1" fill="#001a2b" opacity="0.4"/>
</svg>`;

// Paddle board (SUP): long flat board with a center grip and standing paddle.
const PB_BOARD =
  "M4 27 C10 23.8 54 23.8 60 27 C54 30.2 10 30.2 4 27 Z";
export const PADDLEBOARD_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("pb")}
  <ellipse cx="32" cy="33" rx="27" ry="2.4" fill="#0b2f4a" opacity="0.22"/>
  <rect x="38" y="5" width="2.4" height="20" rx="1.2" fill="#b07636" stroke="${INK}" stroke-width="1.1"/>
  <rect x="35.8" y="4" width="7" height="2.6" rx="1.3" fill="#b07636" stroke="${INK}" stroke-width="1.1"/>
  <path d="M37.4 25 C37.4 29.5 41.6 29.5 41.6 25 L41.6 22.5 L37.4 22.5 Z" fill="#b07636" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="${PB_BOARD}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${PB_BOARD}" fill="url(#pb-g)"/>
  <path d="${PB_BOARD}" fill="url(#pb-s)"/>
  <rect x="14" y="25.4" width="24" height="2" rx="1" fill="#ffffff" opacity="0.9"/>
  <ellipse cx="26" cy="27" rx="3" ry="1.1" fill="#001a2b" opacity="0.4"/>
  <path d="M8 28.2 C16 29.8 48 29.8 56 28.2 C48 29.4 16 29.4 8 28.2 Z" fill="#001a2b" opacity="0.26"/>
</svg>`;

// Jet ski: small sporty personal watercraft with handlebars.
const JS_HULL =
  "M7 27 C12 22 24 20 34 20 C48 20 56 23 59 27 C57 32 50 34 38 34 H18 C12 34 8 31 7 27 Z";
export const JETSKI_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("js")}
  <ellipse cx="32" cy="35.5" rx="24" ry="3" fill="#0b2f4a" opacity="0.22"/>
  <path d="${JS_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${JS_HULL}" fill="url(#js-g)"/>
  <path d="${JS_HULL}" fill="url(#js-s)"/>
  <rect x="11" y="24.8" width="40" height="2.8" rx="1.4" fill="#ffffff" opacity="0.9"/>
  <path d="M10 30 C16 32.6 48 32.6 54 30 C46 32 18 32 10 30 Z" fill="#001a2b" opacity="0.26"/>
  <path d="M26 19.5 C29 15.5 36 15.5 39 18.5 L39 22 H26 Z" fill="${INK}"/>
  <rect x="15" y="14.2" width="12" height="2.6" rx="1.3" fill="${INK}"/>
  <rect x="24" y="15.4" width="2.6" height="5" rx="1.3" fill="${INK}"/>
</svg>`;

// Yacht: larger cruiser with a two-level cabin and round portholes.
const YC_HULL =
  "M5 26 H59 L52 34 C50.6 35.5 49 36 46 36 H18 C15 36 13.4 35.4 12 34 L5 26 Z";
export const YACHT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  ${shadeDefs("yc")}
  <ellipse cx="32" cy="37.5" rx="27" ry="3.2" fill="#0b2f4a" opacity="0.22"/>
  <rect x="20" y="9.5" width="18" height="7.5" rx="2" fill="currentColor" stroke="${INK}" stroke-width="2"/>
  <rect x="20" y="9.5" width="18" height="7.5" rx="2" fill="url(#yc-g)"/>
  <rect x="20" y="9.5" width="18" height="7.5" rx="2" fill="url(#yc-s)"/>
  <rect x="13" y="16.5" width="34" height="9.5" rx="2.4" fill="#ffffff" stroke="${INK}" stroke-width="2"/>
  <rect x="13" y="16.5" width="34" height="9.5" rx="2.4" fill="url(#yc-s)" opacity="0.4"/>
  <circle cx="18.6" cy="21.4" r="2" fill="url(#yc-gl)" stroke="${INK}" stroke-width="1"/>
  <circle cx="25.2" cy="21.4" r="2" fill="url(#yc-gl)" stroke="${INK}" stroke-width="1"/>
  <circle cx="34.8" cy="21.4" r="2" fill="url(#yc-gl)" stroke="${INK}" stroke-width="1"/>
  <circle cx="41.4" cy="21.4" r="2" fill="url(#yc-gl)" stroke="${INK}" stroke-width="1"/>
  <path d="${YC_HULL}" fill="currentColor" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>
  <path d="${YC_HULL}" fill="url(#yc-g)"/>
  <path d="${YC_HULL}" fill="url(#yc-s)"/>
  <rect x="10" y="26.6" width="44" height="2.8" rx="1.4" fill="#ffffff" opacity="0.9"/>
  <path d="M12 32.6 H52 C50.6 34 49 34.5 46 34.5 H18 C15 34.5 13.4 34 12 32.6 Z" fill="#001a2b" opacity="0.28"/>
</svg>`;

// Pennant flag accessory — uses currentColor (the boat color), no user data.
export const FLAG_SVG = `<svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2.2" y="0" width="2.4" height="24" rx="1.2" fill="${INK}"/>
  <path d="M4.6 1.5 H16.5 L12.8 5 L16.5 8.5 H4.6 Z" fill="currentColor" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M4.6 2.4 H14 L12 4.2 H4.6 Z" fill="#ffffff" opacity="0.3"/>
</svg>`;

export type BoatTypeDef = {
  /** Stored value — never change existing values (users' saved boats reference them). */
  value: string;
  label: string;
  desc: string;
};

// The boat catalog. Order controls display order in pickers.
// NOTE: 'speedboat' and 'fishing' keep their original stored values (existing
// users' boats reference them) but are labeled Performance Boat / Bass Boat.
export const BOAT_TYPES: BoatTypeDef[] = [
  { value: "speedboat", label: "Performance Boat", desc: "Built for speed" },
  { value: "fishing", label: "Bass Boat", desc: "Reel them in" },
  { value: "wake", label: "Wake Boat", desc: "Surf's up" },
  { value: "pontoon", label: "Pontoon", desc: "Relaxed cruiser" },
  { value: "cabincruiser", label: "Cabin Cruiser", desc: "Overnight ready" },
  { value: "centerconsole", label: "Center Console", desc: "Open & versatile" },
  { value: "jonboat", label: "Jon Boat", desc: "Simple & steady" },
  { value: "houseboat", label: "Houseboat", desc: "Home on the water" },
  { value: "sailboat", label: "Sailboat", desc: "Wind powered" },
  { value: "kayak", label: "Kayak", desc: "Paddle solo" },
  { value: "canoe", label: "Canoe", desc: "Classic paddler" },
  { value: "paddleboard", label: "Paddle Board", desc: "Stand-up SUP" },
  { value: "jetski", label: "Jet Ski", desc: "Quick & nimble" },
  { value: "yacht", label: "Yacht", desc: "Luxury cruiser" },
];

export const BOAT_TYPE_VALUES: string[] = BOAT_TYPES.map((t) => t.value);

export const BOAT_SVGS: Record<string, string> = {
  speedboat: SPEEDBOAT_SVG,
  fishing: FISHINGBOAT_SVG,
  wake: WAKEBOAT_SVG,
  pontoon: PONTOON_SVG,
  cabincruiser: CABINCRUISER_SVG,
  centerconsole: CENTERCONSOLE_SVG,
  jonboat: JONBOAT_SVG,
  houseboat: HOUSEBOAT_SVG,
  sailboat: SAILBOAT_SVG,
  kayak: KAYAK_SVG,
  canoe: CANOE_SVG,
  paddleboard: PADDLEBOARD_SVG,
  jetski: JETSKI_SVG,
  yacht: YACHT_SVG,
};

export function boatSvgFor(type?: string | null): string {
  return (type && BOAT_SVGS[type]) || SPEEDBOAT_SVG;
}

export function boatLabelFor(type?: string | null): string {
  const t = type && BOAT_TYPES.find((b) => b.value === type);
  return t ? t.label : BOAT_TYPES[0].label;
}

// ---------------------------------------------------------------------------
// Boat brands / manufacturers.
// Purely optional, purely cosmetic: users can pick one of these suggestions or
// type any brand name freely — the stored value is plain text, so this list is
// only used to power pickers/autocomplete. Add new brands here; no other app
// code needs to change. Keep alphabetical.
// ---------------------------------------------------------------------------
export const BOAT_BRANDS: string[] = [
  "Alumacraft",
  "Avalon",
  "Axis",
  "Bass Cat",
  "Bayliner",
  "Bennington",
  "Bentley Pontoons",
  "Berkshire",
  "Boston Whaler",
  "Carver",
  "Centurion",
  "Chaparral",
  "Cobalt",
  "Correct Craft",
  "Crest",
  "Crestliner",
  "Crownline",
  "Donzi",
  "Formula",
  "Fountain",
  "Four Winns",
  "Gibson",
  "Glastron",
  "Grady-White",
  "Harris",
  "Heyday",
  "Hobie",
  "Key West",
  "Landau",
  "Larson",
  "Lowe",
  "Lund",
  "Malibu",
  "Manitou",
  "MasterCraft",
  "Monterey",
  "Moomba",
  "Nautique",
  "Nitro",
  "Old Town",
  "Phoenix",
  "Premier",
  "Princecraft",
  "Ranger",
  "Regal",
  "Rinker",
  "Sea-Doo",
  "Sea Hunt",
  "Sea Ray",
  "Skeeter",
  "Smoker Craft",
  "South Bay",
  "Starcraft",
  "Stingray",
  "Sun Tracker",
  "Supra",
  "Sylvan",
  "Tahoe",
  "Tige",
  "Tracker",
  "Triton",
  "Vexus",
  "Xpress",
  "Yamaha",
];

/** Max stored length for a boat brand (free-text allowed). */
export const BOAT_BRAND_MAX_LENGTH = 40;
