// Shared boat artwork used by both the map markers and the settings preview.
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

// Sporty speedboat: pointed bow, swept windshield, racing stripe.
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

export const BOAT_SVGS: Record<string, string> = {
  speedboat: SPEEDBOAT_SVG,
  pontoon: PONTOON_SVG,
  sailboat: SAILBOAT_SVG,
  kayak: KAYAK_SVG,
  jetski: JETSKI_SVG,
  yacht: YACHT_SVG,
};

export function boatSvgFor(type?: string | null): string {
  return (type && BOAT_SVGS[type]) || SPEEDBOAT_SVG;
}

// Pennant flag accessory — uses currentColor (the boat color), no user data.
export const FLAG_SVG = `<svg width="20" height="24" viewBox="0 0 20 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect x="2.2" y="0" width="2.4" height="24" rx="1.2" fill="${INK}"/>
  <path d="M4.6 1.5 H16.5 L12.8 5 L16.5 8.5 H4.6 Z" fill="currentColor" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M4.6 2.4 H14 L12 4.2 H4.6 Z" fill="#ffffff" opacity="0.3"/>
</svg>`;
