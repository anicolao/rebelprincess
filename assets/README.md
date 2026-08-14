# Generated visual assets

These original raster atlases establish the visual direction for the digital
game. The complete set was regenerated with OpenAI's built-in image-generation
tool on August 14, 2026 and is licensed with the rest of this repository under
GPL-3.0-only.

The commercial Rebel Princess materials were used only to identify the required
component categories and rule concepts. These images do not copy the published
illustrations, logo, card frames, or trade dress and were explicitly generated
without imitating the original illustrator or any other named artist.

## Files

- `generated/suited-card-families.png`: four panels for Fairies, Queens,
  Princes, and Pets. Values and suit labels should be rendered by the client.
- `generated/alternate-suits-review/fairies.png`: gameplay Fairy art for ranks
  1–12 in a 6 × 2 row-major grid.
- `generated/alternate-suits-review/queens.png`: gameplay Queen art for ranks
  1–12 in a 6 × 2 row-major grid.
- `generated/alternate-suits-review/princes.png`: gameplay Prince art for ranks
  1–12 in a 6 × 2 row-major grid.
- `generated/alternate-suits-review/pets.png`: gameplay Pet art for ranks 1–12
  in a 6 × 2 row-major grid. The species are rabbit, fox,
  hedgehog, owl, cat, tortoise, squirrel, frog, dragon, dog, raven, and fawn.
- `generated/princess-portraits.png`: ten portraits in a 5 × 2 grid.
- `generated/princess-portraits-deluxe.png`: Rapunzel and Thumbelina in a
  2 × 1 extension grid matching the original Princess portraits.
- `generated/round-rule-vignettes.png`: twenty-one symbolic scenes in a 7 × 3
  grid. Rule names and text should be rendered by the client.
- `generated/round-rule-vignettes-deluxe.png`: six additional Deluxe symbolic
  scenes in a 3 × 2 extension grid.
- `manifest.json`: stable row-major mapping from grid cells to game IDs.

## Uniform atlas contract

Every source image is an edge-to-edge regular grid with equal cells. Each cell
owns its complete ornamental border; there are no outer margins, inter-cell
gutters, shared borders, crop marks, or material outside the grid. Generated
outputs were normalized to dimensions exactly divisible by their grids:

- gameplay suits: 1800 × 1000, 6 × 2, 300 × 500 cells
- suit families: 1200 × 500, 4 × 1, 300 × 500 cells
- Princesses: 1500 × 1000, 5 × 2, 300 × 500 cells
- Deluxe Princesses: 1200 × 1000, 2 × 1, 600 × 1000 cells
- Round cards: 1680 × 840, 7 × 3, 240 × 280 cells
- Deluxe Round cards: 1500 × 1000, 3 × 2, 500 × 500 cells

Keep typography out of the bitmap assets. HTML-rendered names, values, and rule
text remain exact, accessible, localizable, and deterministic under E2E tests.
The atlases are source assets; an implementation may crop optimized derivatives
during its build without changing the canonical IDs in the manifest.

The app's `/assets` route displays every source atlas, its computed integer-pixel
grid, and all 91 rendered cells. Runtime rendering has one path: `SpriteCard`
selects a regular grid cell with an SVG view box and maps that complete cell
edge-to-edge into its matching frame. No atlas has crop overrides or fit modes.

## Prompt record

All nine final prompts requested original hand-painted storybook gouache,
subtle paper texture, crisp card-size silhouettes, generic ornamental geometry,
no logos, no readable text, no watermarks, no existing Rebel Princess artwork,
and no imitation of a named artist. Existing atlases were supplied only as
style references; every character, pose, setting, and symbolic composition was
regenerated.

Every prompt stated the grid dimensions, complete-cell aspect ratio, exact
row-major count, edge-to-edge canvas extent, and independent ownership of a
complete border on all four cell edges. They explicitly prohibited outer
margins, gutters, gaps, shared seams, blank strips, checkerboards, crop marks,
and content crossing a cell boundary.

The four gameplay-suit prompts each specified a 6 × 2 grid of 3:5 cells. Fairies
use amber, honey-gold, and bronze; Queens use plum, aubergine, burgundy, and
rose-gold; Princes use midnight blue, cobalt, and silver; Pets use moss green,
emerald, and antique gold. Queen cells 11 and 12 explicitly prohibit blue
dominance, and Fairy cell 10 explicitly remains amber rather than blue. Pet
species and the rank-8-only Frog remain fixed by row-major position.

The suit-family prompt specified four 3:5 concept panels: luminous Fairies with
a crystal wand, an empty Queen throne, an abandoned Prince sword/boot/bouquet,
and enchanted Pets centered on a crowned frog. Its palette constraints match
the four gameplay sheets.

The Princess prompt specified ten diverse adult fairy-tale archetypes in a
5 × 2 grid with a complete intentional ivory border. The Deluxe Princess prompt
uses the same geometry and border language for Rapunzel with a practical
climbing braid and Thumbelina among oversized clover and bellflowers.

The original Round prompt specified the twenty-one row-major symbolic scenes
enumerated in `manifest.json` in a 7 × 3 grid of 6:7 cells with complete beige
borders. A targeted follow-up removed only an unwanted outer parchment band.
The Deluxe Round prompt specified its six enumerated scenes in a 3 × 2 grid of
square cells with the same complete-border requirement.
