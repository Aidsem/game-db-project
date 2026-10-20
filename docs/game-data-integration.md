# Game data API and asset conventions

## `genshin-db` source

The backend reads JSON directly from the downloaded `genshin-db` repository;
it does not import its JavaScript package. The default checked-out location is
`../../genshin-db-main/genshin-db-main/src/data` relative to this project.
Set `GENSHIN_DB_DATA_DIR` to that repository's `src/data`
directory when it is elsewhere. If the directory is absent, the existing API
continues to work and unavailable asset fields are `null`.

`GET /api/game-data/status` returns availability and attribution metadata. The
existing `GET /api/characters`, `/api/characters/<id>`, `/api/weapons`,
`/api/weapons/<id>`, `/api/artifacts`, and `/api/artifacts/<id>` responses keep
their existing fields and add an `assets` object:

- Character: `image_url`, `portrait_url`, `card_url`, `element_icon_url`,
  `source`.
- Weapon: `image_url`, `weapon_type_icon_url`, `source`.
- Artifact: piece-specific `flower`, `plume`, `sands`, `goblet`, `circlet`,
  `icon_url`, and `source`.
- Artifact responses use `bonus_2pc` and `bonus_4pc` from
  `src/data/English/artifacts/<slug>.json` when that record is available.
  Otherwise, the existing database values are retained.

The URLs are source-provided HTTPS URLs from `src/data/image/*.json` (or
`null` where no mapping exists). They are external URLs, not Flask proxy paths;
the API never returns a local filesystem path. The artifact `icon_url` uses the
flower image as the set thumbnail. `weapon_type_icon_url` is deliberately
`null`: the checked-in `genshin-db` image maps have no weapon-class icon set.
Character and item identifiers are matched against `src/data/index/English`
name maps after punctuation-insensitive normalization. Character portraits
prefer the source's `mihoyo_icon`/`hoyowiki_icon` fields before legacy
`portrait` fields because at least one legacy URL in the downloaded map
(Xiangling) currently returns HTTP 404.

The frontend's shared `app/static/js/assets.js` renderer consumes these
source-mapped URLs, supplies alt text, and switches to a labeled fallback when
the mapping is absent or the remote image fails. The project has no verified
local copies of these game images, so the images themselves do not have Flask
`/static` URLs; they load from the external hosts named by the data source.
Rehosting them into Flask static storage requires rights to those image files.

`GET /api/builds` (including `?character_id=<id>`) keeps its existing
user-managed build fields and now includes the same `assets` objects on nested
`weapon` and `artifact` records. It remains a CRUD/damage-build response; it
does not include premade recommendations.

`GET /api/search?q=<at-least-2-characters>` keeps the existing
`characters`, `weapons`, and `artifacts` arrays and adds the same `assets`
objects to each matching result. Artifact search results also carry the
source-provided `bonus_2pc` and `bonus_4pc` when mapped.

`genshin-db` repository code is MIT licensed (copyright theBowja, 2020). Its
image URLs point to HoYoverse and Fandom/Wikia hosts; the game art and marks
remain the property of their respective owners. See the source repository's
license and notices before distributing this application.

## Premade build content

The downloaded `genshin-builds-main` checkout is at
`../../genshin-builds-main/genshin-builds-main`. Its `src/content` tree contains
character metadata and multiple nested build folders with weapon rankings,
artifact sets, main stats, substats, talents, and notes. Its repository notice
states that the recommendations, rankings, notes, and related content may not
be copied, mirrored, rehosted, redistributed, or deployed without written
permission from its maintainers. Therefore this application does not read,
import, expose, or copy that content. Attribution does not replace that
permission. Existing `/api/builds` continues to represent database-managed
builds and damage setups; it is not a premade recommendation API.
