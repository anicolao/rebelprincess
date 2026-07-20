# Generated visual assets

These original raster atlases establish an initial visual direction for the
digital game. They were generated with OpenAI's built-in image-generation tool
on July 15 and July 20, 2026 and are licensed with the rest of this repository
under GPL-3.0-only.

The commercial Rebel Princess materials were used only to identify the required
component categories and rule concepts. These images do not copy the published
illustrations, logo, card frames, or trade dress and were explicitly generated
without imitating the original illustrator or any other named artist.

## Files

- `generated/suited-card-families.png`: four panels for Fairies, Queens,
  Princes, and Pets. Values and suit labels should be rendered by the client.
- `generated/alternate-suits-review/fairies.png`: review-only alternate Fairy
  art for ranks 1–12 in a 6 × 2 row-major grid.
- `generated/alternate-suits-review/queens.png`: review-only alternate Queen
  art for ranks 1–12 in a 6 × 2 row-major grid.
- `generated/alternate-suits-review/princes.png`: review-only alternate Prince
  art for ranks 1–12 in a 6 × 2 row-major grid.
- `generated/alternate-suits-review/pets.png`: review-only alternate Pet art
  for ranks 1–12 in a 6 × 2 row-major grid. The species are rabbit, fox,
  hedgehog, owl, cat, tortoise, squirrel, frog, dragon, dog, raven, and fawn.
- `generated/princess-portraits.png`: ten portraits in a 5 × 2 grid.
- `generated/princess-portraits-deluxe.png`: Rapunzel and Thumbelina in a
  2 × 1 extension grid matching the original Princess portraits.
- `generated/round-rule-vignettes.png`: twenty-one symbolic scenes in a 7 × 3
  grid. Rule names and text should be rendered by the client.
- `generated/round-rule-vignettes-deluxe.png`: six additional Deluxe symbolic
  scenes in a 3 × 2 extension grid.
- `manifest.json`: stable row-major mapping from grid cells to game IDs.

Keep typography out of the bitmap assets. HTML-rendered names, values, and rule
text remain exact, accessible, localizable, and deterministic under E2E tests.
The atlases are source assets; an implementation may crop optimized derivatives
during its build without changing the canonical IDs in the manifest.

## Prompt record

All three prompts requested original hand-painted storybook gouache, subtle
paper texture, crisp card-size silhouettes, generic ornamental geometry, no
logos, no readable text, no watermarks, no existing Rebel Princess artwork, and
no imitation of Alfredo Cáceres or another named artist.

The suit prompt specified four crop-ready panels: luminous Fairies with a
crystal wand, an empty Queen's throne, an abandoned Prince's sword/boot/bouquet,
and enchanted Pets centered on a frog. The Princess prompt specified ten diverse
adult fairy-tale archetypes in a fixed 5 × 2 portrait grid. The Round prompt
specified the twenty-one row-major symbolic scenes enumerated in
`manifest.json`, in a fixed 7 × 3 grid.

The Deluxe Princess extension was generated with the original Princess atlas
as a style and framing reference. It requested two original adult heroines in
a fixed 2 × 1 grid: Rapunzel with a practical climbing braid and tower-and-ivy
motif, and Thumbelina among oversized clover and bellflowers. The prompt kept
the same gouache, paper grain, ornamental border, crop-safe framing, and
text-free constraints as the original atlas.

The Deluxe Round extension was generated with the original Round atlas as its
style and crop reference. Its row-major cells are Magic Beans, Three Times a
Lady, Arranged Marriage, Always the Bridesmaid, Sisterhood, and Late for a Very
Important Date. It uses original symbolic compositions and contains no copied
commercial artwork or readable text.

The alternate suit review set was generated with `suited-card-families.png` as
a palette, texture, framing, and crop-safety reference. Each suit uses a fixed
6 × 2 row-major grid for ranks 1–12 and requests a distinct character, pose,
setting, and motif in every cell. The Pet prompt fixes every species by rank and
explicitly reserves the only frog or frog imagery for rank 8. These four sheets
are intentionally absent from `manifest.json` until their art direction is
approved and the client is changed to use them.
