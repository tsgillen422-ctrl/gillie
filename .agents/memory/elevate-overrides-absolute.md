---
name: hover-elevate overrides position absolute
description: Why a ui/button.tsx Button with `absolute` positioning silently fails to appear
---

# Replit elevate utilities override `position: absolute` on Button

The shadcn `Button` (`components/ui/button.tsx`) bakes `hover-elevate active-elevate-2`
into its base classes. In `index.css`, the rule
`.hover-elevate:not(.no-default-hover-elevate) { position: relative; z-index: 0 }`
uses a `:not()` selector, giving it higher specificity than Tailwind's `.absolute`
utility (a single class). So `className="absolute ..."` on a `Button` is silently
overridden to `position: relative`.

**Symptom:** A `Button` positioned `absolute` inside an `overflow-hidden` container
(e.g. an image tile overlay) does not appear at all. It flows after the full-size
content and gets clipped. Plain `<div>`s and native `<button>`s with `absolute` work
fine — only the `Button` component is affected. The CSS even warns:
`/* Does not work on elements with overflow:hidden! */`.

**Why:** elevate paints a `::after` overlay (`position:absolute; inset:0; z-index:999`)
and forces the host to `position: relative; z-index: 0` to contain it.

**How to apply:** Never put `absolute` directly on a `Button`. Wrap it in an
absolutely-positioned plain `<div>` and let the Button sit normally inside:
`<div className="absolute top-1.5 right-1.5 z-20"><Button .../></div>`.
(Escape hatch `no-default-hover-elevate` also exists but the wrapper is cleaner.)
