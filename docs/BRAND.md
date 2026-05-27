# Hearth brand reference

Source: Fishburners Brand Styleguide V1.0 in Figma.

This document captures the brand decisions that are encoded in the codebase so future contributors can stay aligned without re-opening the Figma file.

## Primary colour palette

| Token | Name | Hex | Where it lives |
|---|---|---|---|
| `hearth-500` / `primary` | Flame Orange | `#FF4C00` | The single brand accent. Use sparingly. |
| `foreground` | Pure Black | `#000000` | Headlines, body copy on light backgrounds. |
| `background` | Pure White | `#FFFFFF` | Default surface. The codebase uses a warm-cream variant (`30 33% 98%`) as a pragmatic alternative. |
| `hearth-50..200` | Light tints of Flame Orange | computed | Subtle backgrounds, hover wash, decorative orbs. |
| `hearth-300` | Princeton Orange | `#FF9500` | Brighter accent for hover lifts. |
| `hearth-400` | Safety Orange | `#FF7700` | Mid orange used in gradients. |
| `hearth-700` | Rust | `#843600` | Deep orange used as gradient stop or pressed state. |
| `hearth-900` | Maroon | `#7E0400` | Deepest orange used in gradient bottoms. |

Neutral greys (from brand spec, not yet wired into the token system):

| Name | Hex |
|---|---|
| Eerie Black | `#252525` |
| Dim Gray | `#747474` |
| White Smoke | `#F4F4F4` |

## Secondary palette (20 supporting colours)

The brand allows a 20-colour secondary palette for "contrast, hierarchy, and visual richness", but the discipline is that **Flame Orange remains the core signal**. The secondary palette is currently **not** wired into the Tailwind config; introduce a token only when there's a specific use case (e.g. category tagging in the funding radar).

| Group | Colours |
|---|---|
| Oranges | Princeton `#FF9500`, Safety `#FF7700`, Flame `#FF4C00`, Rust `#843600`, Maroon `#7E0400` |
| Purples | Thistle `#E5C4E2`, Pink Lavender `#E5B9E6`, Amethyst `#AE69D7`, Grape `#7C3DA3`, Eminence `#5A2A77` |
| Blues | Electric Blue `#18E9FD`, Vivid Sky Blue `#15D0FA`, Deep Sky Blue `#128BF7`, Bleu de France `#0089F2`, Palatinate Blue `#0645EB` |
| Greens | Aquamarine `#65FFC6`, Spring Green `#00FF86`, and three additional emerald/sea greens |

## Gradients

Three approved patterns (Figma C.7):

1. Orange (Flame) → Pure Black, top-to-bottom linear.
2. Pure Black with Flame Orange radial glow in the centre.
3. Flame Orange → Maroon, top-to-bottom linear.

> "Orange remains the core signal. Gradients should never feel decorative or random; they should create energy, focus, and a sense of momentum."

Current implementation: `.hearth-gradient` (135° linear, `hearth-400 -> 600 -> 700`) and `.hearth-gradient-subtle` (top-to-bottom hearth-50 -> background). The radial-glow variant is **not** yet implemented; add when a "moment of intensity" calls for it.

## Typography

| Family | Use | Where |
|---|---|---|
| **Anton** | Uppercase headlines **only**. | `font-display` utility, applied to short kicker labels (e.g. "Invite-only for Fishburners community", "Privacy-first analytics"). |
| **Inter** | Subheaders, body copy, functional text. | Default `font-sans`, applied everywhere else. |

Hard rules from the styleguide (Figma C.9 incorrect uses - fonts):

- **Never** use Anton in lowercase.
- **Never** use Anton for body copy.
- **Never** introduce another typeface into the system.

When in doubt, use Inter. Reserve Anton for short uppercase moments that need to feel "bold and stand out".

## Icons

The brand styleguide ships a custom orange outline icon set (Figma C.8). The current product uses Lucide icons because:

1. The brand icon set isn't exported into the repo yet.
2. Lucide is industry-standard for SaaS UI, with broad coverage and excellent tree-shaking.

If we later want full brand alignment, the migration path is:
- Export the brand icon set as inline SVG components in `src/components/brand-icons/`.
- Replace Lucide usage on marketing surfaces first (landing page, sign-up).
- Keep Lucide for utility surfaces (admin, dashboard) where the brand icon set may not cover every concept.

## Colour usage rules (Figma C.9)

Banned patterns:

- **Setting everything in orange.** Orange is an accent, not a base. The current feature card row uses one orange icon, one dark icon, one neutral icon as a deliberate response to this rule.
- **Changing the corporate colours.** Don't pick a different orange or substitute another hue for Flame.
- **Placing brand assets on an illegible background.** Maintain contrast.

## Logo & wordmark

- The Fishburners isotype is a **stylised fish**, not a flame. The Hearth product mark (the Lucide `Flame`) is **separate** and represents Hearth as a product.
- The Fishburners wordmark must always be black (never orange).
- For co-branding ("Hearth, a Fishburners product"), use the fish isotype + "FISHBURNERS" wordmark together (the "imagotype"), never modified.

Currently the codebase does **not** ship the Fishburners isotype or wordmark. They should be added when we introduce explicit "Powered by Fishburners" co-branding.

## Photography

Three placeholder community photos live in `public/images/brand/`:

- `founder-hero.jpg`
- `community-collaborate.jpg`
- `founder-workspace.jpg`

They are sourced from **Unsplash** (royalty-free, no attribution required for content use, but credit is welcome). Chosen to match the Fishburners photographic direction (warm-lit, authentic moments, diverse women founders, workspace and community settings) — **not** final brand assets. When the actual Fishburners brand photos are exported from the styleguide, drop them in at the same filenames and they will swap in transparently.

Currently used on:
- Landing page (`/`), in the "community photo band" between the hero and the features section.

## What's still missing

- Fishburners logo SVG (isotype, wordmark, imagotype) — pending export from the Brand Styleguide.
- Brand icon set — pending export.
- Neutral greys (`Eerie Black`, `Dim Gray`, `White Smoke`) — not yet wired into the token system; the current `--muted` / `--border` shades are warm-cream variants. Migrate when refactoring the neutral scale.
- Dark mode tuning — the current dark mode keeps the warm-cream lineage; brand spec is silent on dark mode specifically.
