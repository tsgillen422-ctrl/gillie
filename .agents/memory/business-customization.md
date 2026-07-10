---
name: Business profile customization
description: Social-style business page + owner customize flow — key alignment, theme color, and cleanup rules.
---

- Amenity/highlight/featured-type keys are server-authoritative allowlists in `routes/businesses.ts` (BUSINESS_AMENITY_KEYS etc.); client labels/icons live in `dhl-app/src/lib/business-meta.tsx` and MUST use the same keys. **Why:** an early version invented client keys (`fuel_dock`, `boat_rentals`) that rendered as raw strings.
- Business themeColor is stored as `#rrggbb` (server regex, lowercased) but the app's `--primary` CSS var is an HSL triplet ("H S% L%") — always convert via hexToHslTriplet before overriding, never inject the hex.
- hoursStructured sanitization is lenient: incomplete `{open, close}` pairs are silently coerced to null (closed) server-side, so the client doesn't need pre-validation.
- Business deletion: `removeBusiness()` must delete ALL child rows (follows, reviews, saves) and detach posts (businessId=null, posts survive). No DB cascades — any new business child table must be added there.
- Customize page is owner-gated client-side (redirect) AND server-side (PATCH customize 403); route is `/businesses/customize?id=N` and must be registered before `/businesses/:businessId`.
