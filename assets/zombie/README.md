# Zombie Princess art set

These are original, AI-generated assets for the proposed Zombie Princess variant. They are not extracted from, and do not attempt to reproduce, the published game’s component art.

## Direction

The shared direction was “storybook resistance after dark”: painterly fantasy illustration, moonlit teal shadows, sickly chartreuse zombie accents, oxidized copper, bruised plum, theatrical lighting, adventurous rather than gory. Existing Rebel Princess atlases were supplied only as a reference for the project’s warmth, readable silhouettes, and handcrafted storybook finish.

Art is generated borderless and without typography. The review page supplies dimensions, borders, ranks, names, suit emblems, pass arrows, and rules in HTML/CSS. All playing cards use one shared component frame; all Princesses use one portrait frame; all round cards use one beige event frame.

## Inventory

- `playing/` — 60 suited illustrations, ranks 1–15 for Villagers, Pets, Knights, and Princes. Pet 6 is the Frog.
- `princesses/` — all 12 Princess portraits.
- `rounds/` — all 26 A–Z round illustrations.
- `tokens/` — the bidding coin and skull counter.
- `concepts/` — the initial 13-image direction study retained as generation provenance.

The complete review set contains 98 card illustrations. Independent files are used at this stage so every source can be reviewed before any deterministic atlas packaging.

## Generation record

Mode: built-in OpenAI image generation, one source image per prompt. Repository derivatives are normalized to 600×900 JPEG for playing cards, 666×1000 JPEG for Princesses, and 800×800 JPEG for rounds. The transparent tokens remain PNGs. Full-resolution PNG originals remain in the local generation output.

Every prompt included the shared direction above and asked for a single borderless illustration with no text, numbers, card frame, watermark, or cropped subject. The initial 13 direction-study prompts were:

- `suit-villager.jpg` — friendly zombie village baker, warm ochre market, vertical playing-card composition.
- `suit-pet.jpg` — scrappy zombie rabbit companion in an overgrown moonlit garden, green palette.
- `suit-knight.jpg` — undead knight standing guard in blue moonlight, readable armor silhouette.
- `suit-prince.jpg` — charming zombie prince in a ruined ballroom, bruised-plum palette.
- `frog.jpg` — living heroic frog resistance fighter with a tiny sword and shield, distinctly not undead; this is the special Pet 6.
- `princess-red-riding-hood.jpg` — adult forest ranger with a red hood and practical axe.
- `princess-dorothy.jpg` — adult storm-country engineer with a house-shaped hammer.
- `princess-goldilocks.jpg` — adult survivalist with a cast-iron pan shield and three-bear motifs.
- `round-opening-night.jpg` — moonlit village theater opening as zombies arrive, square event art.
- `round-brain-drain.jpg` — comic magical stream of glowing thoughts leaving a zombie crowd, square event art.
- `round-hourglass-comeback.jpg` — dramatic hourglass, skulls, and underdog rebellion, square final-round art.
- `bid-coin.png` — embossed oxidized-copper coin with a raised closed-hand emblem, isolated transparent token.
- `skull-token.png` — friendly carved bone skull counter with chartreuse glow, isolated transparent token.

The gallery renders the entire inventory. Generated illustrations deliberately contain no ranks, suit marks, pass instructions, rules, or borders; those deterministic layers are owned by reusable UI components.
