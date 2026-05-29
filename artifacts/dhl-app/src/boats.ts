// Shared boat artwork used by both the map markers and the settings preview.
// All SVGs use currentColor for the hull so no user data is injected into HTML;
// depth is created by layering translucent white (highlights) and black (shadows)
// over the base color so the look adapts to any boat color without gradient IDs.

// Sporty speedboat: pointed bow, swept windshield, racing stripe.
export const SPEEDBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="37" rx="27" ry="3.1" fill="#0b3a5b" opacity="0.18"/>
  <path d="M5 22 H47 C54 22 60 25 62 28.5 C62.6 29.7 61.8 31 60.2 31.6 L52 35 C50.5 35.6 49 36 47 36 H15 C12.5 36 10.8 35.2 9.3 33.6 L4.5 28.5 C3.2 27.1 3.3 23.4 5 22 Z" fill="currentColor" stroke="#ffffff" stroke-width="2.4" stroke-linejoin="round"/>
  <path d="M8 23 H47 C52.5 23 57.5 25.3 60 28 H9.5 C8.2 26.5 7.6 24.3 8 23 Z" fill="#ffffff" opacity="0.20"/>
  <path d="M9 32.6 C11 34 13 35 16 35 H46 C48.5 35 50 34.6 52 33.7 L53.6 33 C49 33.3 12 33.3 9 32.6 Z" fill="#000000" opacity="0.16"/>
  <path d="M34 14 C36.5 14 38.5 15 40 16.6 L45 22 H31 V17 C31 15.2 32 14 34 14 Z" fill="#cdeeff" stroke="#ffffff" stroke-width="2" stroke-linejoin="round"/>
  <path d="M34 16 L38 20 H34.5 Z" fill="#ffffff" opacity="0.75"/>
  <rect x="11" y="24" width="33" height="3" rx="1.5" fill="#ffffff" opacity="0.5"/>
  <ellipse cx="16" cy="25.4" rx="6" ry="1.6" fill="#ffffff" opacity="0.45"/>
</svg>`;

// Pontoon: flat deck on two tubes with a sun canopy.
export const PONTOON_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="38" rx="26" ry="2.9" fill="#0b3a5b" opacity="0.18"/>
  <rect x="7" y="29" width="50" height="7" rx="3.5" fill="currentColor" stroke="#ffffff" stroke-width="2.2"/>
  <rect x="9.5" y="30.2" width="45" height="2" rx="1" fill="#ffffff" opacity="0.25"/>
  <rect x="9.5" y="34.2" width="45" height="1.5" rx="0.75" fill="#000000" opacity="0.15"/>
  <rect x="6" y="21" width="52" height="8" rx="2.5" fill="currentColor" stroke="#ffffff" stroke-width="2.2"/>
  <rect x="8" y="22.2" width="48" height="2.2" rx="1.1" fill="#ffffff" opacity="0.22"/>
  <rect x="13" y="7" width="38" height="5" rx="2.5" fill="#ffffff" opacity="0.95"/>
  <rect x="13" y="7" width="38" height="2" rx="1" fill="#ffffff"/>
  <rect x="15" y="11" width="2.4" height="11" rx="1.2" fill="#ffffff" opacity="0.7"/>
  <rect x="46.6" y="11" width="2.4" height="11" rx="1.2" fill="#ffffff" opacity="0.7"/>
</svg>`;

// Sailboat: hull with a tall mainsail and jib.
export const SAILBOAT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="37.5" rx="24" ry="3" fill="#0b3a5b" opacity="0.18"/>
  <rect x="31" y="5" width="2.4" height="23" rx="1.2" fill="#e8edf2"/>
  <path d="M35 6 C44.5 11 47.5 18 47.5 25 L35 25 Z" fill="#ffffff" stroke="#ffffff" stroke-width="1.4" stroke-linejoin="round"/>
  <path d="M35 9 C41 13 43.4 18.5 43.8 24 L35 24 Z" fill="#cfe0ee" opacity="0.7"/>
  <path d="M29 9 L29 25 L18 25 C21 18.5 25 13 29 9 Z" fill="#ffffff" opacity="0.9"/>
  <path d="M10 27 H54 L48 34 C46.7 35.6 45 36 43 36 H21 C19 36 17.3 35.4 16 34 Z" fill="currentColor" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M13 28 H51 L49 30.6 H15 Z" fill="#ffffff" opacity="0.2"/>
  <path d="M16 33 H48 C46.7 34.6 45 35 43 35 H21 C19 35 17.3 34.6 16 33 Z" fill="#000000" opacity="0.15"/>
</svg>`;

// Kayak: slim hull pointed at both ends with a paddle.
export const KAYAK_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="33.5" rx="27" ry="2.6" fill="#0b3a5b" opacity="0.18"/>
  <path d="M4 26 C14 21 50 21 60 26 C50 31 14 31 4 26 Z" fill="currentColor" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M10 24.5 C20 22.2 44 22.2 54 24.5 C46 26 18 26 10 24.5 Z" fill="#ffffff" opacity="0.2"/>
  <path d="M8 27.6 C18 29.8 46 29.8 56 27.6 C46 29.4 18 29.4 8 27.6 Z" fill="#000000" opacity="0.13"/>
  <ellipse cx="32" cy="25.4" rx="6.5" ry="2.6" fill="#000000" opacity="0.2"/>
  <rect x="18" y="13.5" width="28" height="2.6" rx="1.3" fill="#e8edf2" stroke="#ffffff" stroke-width="0.6"/>
</svg>`;

// Jet ski: small sporty personal watercraft with handlebars.
export const JETSKI_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="35.5" rx="24" ry="3" fill="#0b3a5b" opacity="0.18"/>
  <path d="M7 27 C12 22 24 20 34 20 C48 20 56 23 59 27 C57 32 50 34 38 34 H18 C12 34 8 31 7 27 Z" fill="currentColor" stroke="#ffffff" stroke-width="2.2" stroke-linejoin="round"/>
  <path d="M12 24 C20 21.6 44 22 53 25 C44 24 20 24 12 24 Z" fill="#ffffff" opacity="0.22"/>
  <path d="M10 30 C16 33 48 33 54 30 C46 32 18 32 10 30 Z" fill="#000000" opacity="0.14"/>
  <path d="M26 20 C29 16 36 16 39 19 L39 22 H26 Z" fill="#1f2937" opacity="0.35"/>
  <rect x="16" y="15" width="11" height="2.4" rx="1.2" fill="#e8edf2"/>
  <rect x="24" y="16" width="2.4" height="5" rx="1.2" fill="#cfd8e0"/>
</svg>`;

// Yacht: larger cruiser with a two-level cabin and windows.
export const YACHT_SVG = `<svg width="58" height="38" viewBox="0 0 64 42" fill="none" xmlns="http://www.w3.org/2000/svg">
  <ellipse cx="32" cy="37.5" rx="27" ry="3.2" fill="#0b3a5b" opacity="0.18"/>
  <rect x="20" y="10" width="18" height="7" rx="2" fill="currentColor" stroke="#ffffff" stroke-width="1.6"/>
  <rect x="22" y="11.5" width="14" height="2" rx="1" fill="#ffffff" opacity="0.3"/>
  <rect x="13" y="17" width="34" height="9" rx="2.2" fill="#ffffff" opacity="0.95"/>
  <rect x="13" y="17" width="34" height="3" rx="1.5" fill="#ffffff"/>
  <rect x="16" y="20.5" width="4" height="3.2" rx="0.8" fill="currentColor" opacity="0.55"/>
  <rect x="22" y="20.5" width="4" height="3.2" rx="0.8" fill="currentColor" opacity="0.55"/>
  <rect x="34" y="20.5" width="4" height="3.2" rx="0.8" fill="currentColor" opacity="0.55"/>
  <rect x="40" y="20.5" width="4" height="3.2" rx="0.8" fill="currentColor" opacity="0.55"/>
  <path d="M5 26 H59 L52 34 C50.6 35.5 49 36 46 36 H18 C15 36 13.4 35.4 12 34 L5 26 Z" fill="currentColor" stroke="#ffffff" stroke-width="2.3" stroke-linejoin="round"/>
  <path d="M9 27 H56 L53 30 H11 Z" fill="#ffffff" opacity="0.18"/>
  <path d="M12 32.6 H52 C50.6 34 49 34.5 46 34.5 H18 C15 34.5 13.4 34 12 32.6 Z" fill="#000000" opacity="0.16"/>
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
  <rect x="2.2" y="0" width="2.2" height="24" rx="1.1" fill="#cbd5e1"/>
  <rect x="2.2" y="0" width="1" height="24" rx="0.5" fill="#ffffff" opacity="0.7"/>
  <path d="M4.4 1.5 H16.5 L12.8 5 L16.5 8.5 H4.4 Z" fill="currentColor" stroke="#ffffff" stroke-width="1.1" stroke-linejoin="round"/>
  <path d="M4.4 2.4 H14 L12 4.2 H4.4 Z" fill="#ffffff" opacity="0.25"/>
</svg>`;
