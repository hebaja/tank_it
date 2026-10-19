# Third-Party Assets

Tank It! ships and uses artwork, tilesets, sprites, sound effects, and fonts created by third parties. The project's own code is licensed separately in [`LICENSE`](LICENSE) — that license does **not** cover the third-party assets listed below.

`assets_tank-it/` is a local-only working folder (not committed). It is where the original asset packs are kept so their license files can be checked. This notice is the authoritative record for anyone using the repository.

## Asset inventory

| Asset / source | Author | License | Where used | Attribution required? |
|---|---|---|---|---|
| Pixel Platformer Blocks (1.0) | Kenney (www.kenney.nl) | CC0 1.0 | Destructible block tiles/sprites derived into `frontend/game/public/assets/map/` and `sprites/` | No (credit appreciated) |
| Top-down Tanks Remastered | Kenney Vleugels (kenney.nl) | CC0 1.0 | Tank, barrel, bullet and shot sprites in `frontend/game/public/assets/sprites/` and `barrels/` | No (credit appreciated) |
| UI Pack - Pixel Adventure (2.0) | Kenney (www.kenney.nl) | CC0 1.0 | Bars / UI panels derived into `frontend/game/public/assets/bars/` | No (credit appreciated) |
| Heavy 8bit Explosions Sounds (Free) | Levi V. B. (levivb.itch.io) | Custom license (see below) | Explosion/shot sfx derived into `frontend/game/public/assets/sounds/sfx/` (`tank_fire`, `block_destroy`, `gray_explosion`, `tank_destroy`, `barrel_destroy`, `death_wall_explode`) | No (credit optional) |
| 200 Free SFX | Kronbits (kronbits.itch.io) | CC0 1.0 | Alarm sfx derived into `frontend/game/public/assets/sounds/sfx/danger_warning` (from "Retro Alarm 02") | No (credit optional) |
| Impact Sounds | Kenney (www.kenney.nl) | CC0 1.0 | Sfx derived into `frontend/game/public/assets/sounds/sfx/tank_fire_fail` | No (credit appreciated) |
| Interface Sounds | Kenney (www.kenney.nl) | CC0 1.0 | Sfx derived into `frontend/game/public/assets/sounds/sfx/option_select` | No (credit appreciated) |
| Sci-Fi Sounds | Kenney (www.kenney.nl) | CC0 1.0 | Sfx derived into `frontend/game/public/assets/sounds/sfx/ammo_bar_complete` | No (credit appreciated) |
| Press Start 2P | The Press Start 2P Project Authors (cody@zone38.net) | SIL Open Font License 1.1 | `frontend/game/public/assets/fonts/PressStart2P-Regular.ttf` | Yes (copyright + license text) |
| Pixelify Sans | The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans) | SIL Open Font License 1.1 | `frontend/game/public/assets/fonts/PixelifySans-{Regular,Medium,SemiBold,Bold}.ttf` | Yes (copyright + license text) |
| Silkscreen | The Silkscreen Project Authors (https://github.com/googlefonts/silkscreen) | SIL Open Font License 1.1 | Prepared in local-only `assets_tank-it/Silkscreen/` (loaded by the overlay scene as `fonts/Silkscreen-Regular.ttf`) | Yes (copyright + license text) |

### Credits

Artwork packs by **Kenney** (www.kenney.nl) — released under CC0 1.0. Fonts are used under the SIL Open Font License 1.1.

Sound effects by **Levi V. B.** (levivb.itch.io) — used under the author's custom license described below; by **Kronbits** (kronbits.itch.io) and additional **Kenney** packs — released under CC0 1.0.

## Font copyright notices

Taken verbatim from each font's embedded metadata / `OFL.txt`:

```
Copyright 2012 The Press Start 2P Project Authors (cody@zone38.net), with Reserved Font Name "Press Start 2P".

Copyright 2001 The Silkscreen Project Authors (https://github.com/googlefonts/silkscreen)

Copyright 2021 The Pixelify Sans Project Authors (https://github.com/eifetx/Pixelify-Sans)
```

## SIL Open Font License 1.1

The verbatim license text lives in [`frontend/game/public/assets/fonts/OFL.txt`](frontend/game/public/assets/fonts/OFL.txt), committed alongside the font files it covers so it ships with every copy of them (SIL OFL 1.1, clause 2). A short index of the covered files is in [`frontend/game/public/assets/fonts/LICENSES.md`](frontend/game/public/assets/fonts/LICENSES.md).

Do not retype or reformat that file. To update it, download it fresh from <https://openfontlicense.org/documents/OFL.txt>.

## Creative Commons Zero 1.0 Universal (CC0 1.0)

The Kenney packs above are released under CC0 1.0 — a public domain dedication. Kenney's own license files state the content may be used in personal, educational, and commercial projects and that crediting Kenney is optional (but appreciated).

The **200 Free SFX** pack by Kronbits is likewise licensed CC0 1.0 (Creative Commons Zero v1.0 Universal, as stated on <https://kronbits.itch.io/freesfx>): the sounds may be used any number of times in personal and commercial projects, no credit needed — if crediting, link to that page.

Dedication text: <https://creativecommons.org/publicdomain/zero/1.0/legalcode>

## Levi V. B. sound effects license (Heavy 8bit Explosions Sounds)

The Heavy 8bit Explosions Sounds pack is **not** CC0; it ships with a custom license by its author, Levi V. B. (<https://levivb.itch.io/heavy-8bit-explosions-sounds>). Its terms, summarized from the pack's `License` section:

- Allowed: use the sounds in any number of personal and commercial projects; modify them to fit your needs; use without crediting (crediting is optional).
- Not allowed: redistribute or resell the sounds alone, in whole or in part, even after modifying them (including for free); claim authorship of them; use them for NFTs; use them for AI training.

The original downloads are kept uncommitted in `assets_tank-it/` as the verbatim license reference for this pack.

## Notes

- The MIT license in `LICENSE` covers the team's own code only. It must not be read as covering the assets listed above.
- If a pack is ever replaced, remove its row from the inventory table in the same PR.
- `assets_tank-it/` stays uncommitted; original `License.txt`/`OFL.txt` files there are the reference used to keep this notice accurate.