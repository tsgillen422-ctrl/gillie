---
name: Mobile teal-gradient nuance (match web per-component)
description: When matching gillie-mobile to dhl-app, "remove teal gradients" is wrong globally — it's per-component. Some web surfaces ARE bold teal.
---

"Make mobile match web" does NOT mean "remove all teal gradients." The web (dhl-app)
uses bold teal gradients in some places and subtle/none in others. Match each mobile
component to its specific web counterpart, not a blanket rule.

Known mappings (verify against web source before changing):
- Feed conditions/weather card → SUBTLE. Web ConditionsWidget uses a faint
  `from-sky-500/10 to-cyan-500/10` tint on a light card. Mobile must NOT use a bold
  solid teal banner here. (This was the long-standing "still teal" complaint.)
- Profile hero (cover area) → BOLD TEAL. Web profile.tsx renders
  `h-52 bg-gradient-to-br from-primary via-secondary to-primary/60` with a
  `from-black/35 ... to-black/15` overlay, identity card overlapping it. When the user
  has no coverUrl, the web STILL shows this teal gradient (not white). Mobile ProfileHero
  must render the same teal LinearGradient fallback + dark overlay, NOT a plain white /
  low-opacity tint.

**Why:** A subagent was told "no bold teal gradient banners" globally and made the profile
hero plain white, which made the profile look blank/off vs web. The user reads the white
profile top as "doesn't match." The instruction was over-applied.

**How to apply:** Before de-gradienting or adding a gradient on any mobile screen, open the
matching dhl-app component and copy ITS treatment for that specific surface.
