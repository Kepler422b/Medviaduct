# HEALTH BRIDGEAI design system

Visual thesis: an elegant clinical journal becomes an interactive research workspace. The supplied reference is inspiration, not a page background. Original generated edge artwork is used with digitally recreated surfaces and spacing.

## Reference analysis
- Palette: ivory paper, pale lavender, powder blue, periwinkle, muted botanical green. Ink is deliberately darker for reading and controls.
- Composition: quiet central content; decorative weight at opposing corners; generous negative space.
- Decoration: restrained botanical leaves and one butterfly. Never cover controls or medical text.
- Hierarchy: large editorial headline, concise supporting text, clear primary action; compact utility labels.
- Texture: translucent watercolor washes, subtle paper grain and glass surfaces.
- Spacing: 8px base, 16–24px component gaps, 32–48px workspace margins, 64–96px narrative sections.
- Typography: Playfair Display for journal headings; DM Sans for body, forms and controls; Georgia/system sans fallbacks.
- Lighting: diffuse, broad highlights and soft lavender shadows; restrained depth.

## Tokens
| Role | Value |
|---|---|
| Paper | #F7F7F2 |
| Ink | #263449 |
| Primary | #7478A8 |
| Lavender | #E2DDF1 |
| Mist blue | #E8EFF5 |
| Sage | #98AA9C |
| Reading text | #69788D |
| Border | #DEDEE6 |
| Surface | white, 65–80% opacity |
| Corners | 8px controls, 12–16px panels |

## Module identities
- Landing: open botanical margins, editorial introduction, one clinical network and a seven-step narrative.
- My Case: numbered journal fields and supporting attachments.
- Similar Cases: network canvas and a focused comparison panel.
- Trends: cool atlas surface, geographic globe, region detail and time-series chart.
- Research: paper-like cards and a quiet long-form reading view.
- Saved Research: the same reading system with a personal collection state.
- Profile/Auth: sparse forms with botanical framing.

## Motion and accessibility
CSS reveals and hover elevation are restrained. Network motion explains relationships; globe rotation explains geography. The system reduced-motion preference and saved preference should stop autonomous motion. Every visualization has text controls or an accessible alternative. Shadcn/Radix primitives provide dialogs, selects, tabs and sidebar keyboard behavior.

## Original artwork
Generated once with the built-in image tool and copied to public/botanical.png.
Prompt: Original wide 1536x1024 watercolor illustration for HEALTH BRIDGEAI; delicate eucalyptus-like leaves at upper right and lower left, one small pale lavender butterfly, warm ivory paper, exceptionally spacious blank center, soft diffuse light, restrained desaturated lavender and powder blue, no text, logo, UI, medical claims or watermark.
