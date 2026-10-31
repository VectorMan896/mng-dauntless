# MNG DAUNTLESS changelog

Newest first. Launcher versions; the server, runtime and data change with them.

## Unreleased - 2026-10-30 / 31

Server, data, tools, the runtime (client feed 0.1.4) and the launcher's look. Folded into the next launcher version.

**Launcher look ("Charcoal & Mint", after the owner's reference design)**
- Colours: neutral charcoal instead of the original's navy blue glass, a pale mint accent for Play, main buttons and the
  open page, peach for small highlights (activity bars, the invite badge), grey capitals for labels. Alerts keep
  green/yellow/red. All colours come from `src/styles/tokens.css` (RGB triplets such as `--aether-rgb`), one file to change.
- Font: Outfit (geometric sans, bundled) for text and the heavy headings, instead of Cinzel and Inter.
- Soft round corners and pill buttons.
- A slim left rail of round icon buttons replaces the 252 px sidebar: the MNG mark, Home on its own (the open page is a
  mint circle), the other pages in one grouped pill, tooltips on hover. Top right: the server and its state
  ("MNG DAUNTLESS · ONLINE", detail under it, a round status button with the service popover) and the account avatar
  with a status dot. Settings no longer has "Sidebar layout".
- Home: full-bleed art (`DautlessReforged\background.jpg`, the frost Skraev, also on the sign-in screen); a "Welcome back"
  pill, the heavy DAUNTLESS title with a small MNG, a round PLAY pill with the launch status, server and state beside it;
  three cards along the bottom: Weekly activity (play time per day for the last 7 days from this PC's sessions, View
  logs), Your setup (Build, Runtime, game folder, View library) and Your server (server state, account, invites, View
  servers). Pages fill the window's height.
- New app icons: the MNG mark and letters on a charcoal tile with a mint edge (`scripts/make-mng-icon.ps1`, then
  `npx tauri icon src-tauri/icons/source-mng.png`); the old set is in `src-tauri/icons.before-mng-icon`.
- (An earlier pass the same day, "Frost & Ember" with a top bar, was replaced by this one.)

**Hunt Pass bonus levels**
- Past level 50 every 100 pass XP is a bonus level paying 25 Bonus Cache Coins (the Reward Cache's currency; the live
  passes paid 5 free + 20 Elite). All 25 sit on the free track because Elite is free here and the wallet funds a bonus
  grant from the free rate only. `add_legacy_huntpass.cjs --bonus-coins <n> --bonus-xp <n>` (0 coins = off).
- This brings back the original project's rule that the coin is paid only from banked bonus levels (season challenges
  and bounties keep their own funding); the rebuilt seasons had dropped it, so the coin was ungated in between.

**Trials leaderboards**
- Finished runs are stored (MongoDB `trialRuns`; memory on a SQLite server) and the two leaderboard queries are answered
  from them: `/trials/leaderboards/all` (best solo time per player, best group time per party, fastest first) and
  `/trials/leaderboards/solo/individual` (the player's best). Shapes from EisigesEis/DauntlessEndpointDocumentation.
- The game server's report of a run (`UArenaGameModeComponent::SubmitLeaderboardsInfo`) is not documented: any POST under
  `/trials/` or `/leaderboards/` from a game server is read as one (`trial_id`, `completion_time`, `party_members`, ...)
  and the first 20 bodies are logged in full (`[TrialsMon]`). Not yet seen in a real run. Tests: `src/trialRuns.test.ts`.

**Runtime 0.1.4 (client feed)**
- The Hunt Pass "Skip to Next Level" button is hidden (`[HuntPassSkip]`; `KEEP_HUNTPASS_SKIP_BUTTON.flag` keeps it).
- Ramsgate's city events: the event's feature flag was on for client and server (the Game.ini route works) but its
  sub-level (`/Game/Maps/ramsgate/events/city_01_event_dark_harvest`) never loaded. For 90 s after Ramsgate loads the
  runtime asks the matching streaming sub-level to load and show, on server and client, and logs Ramsgate's event
  sub-levels once (`[CityEvent]`; `NO_CITY_EVENT_LEVELS.flag` turns it off). Not yet checked in game.

**Legacy Hunt Pass**
- Every level of both tracks now has a reward. The Elite track had one on only 13-26 of 50 levels, and the game drew
  the rest as empty cards with a check on the lock. Empty Elite levels get the live passes' kind of rewards (tonics,
  pylons, grenades, Steel Marks, Ace Chips, Transmog Stones, Uncommon/Rare Cell Cores); free levels mix Rams, Ace Chips
  and Steel Marks with the Cell Cores.
- The old passes' flares and emoji are now part of their seasons, and HP06's second half (HP06-1) joins HP06 Pirate.
- Chroma Dust is no longer a pass reward: it has no Hunt Pass icon and showed as a bare "100".
- Platinum is earned from the pass, as on the live game: 50 on Elite levels ending in 3 or 8 and free levels ending in
  3 where no cosmetic sits, 200-450 per season (the Platinum store costs 100-1,000, median 500). The server sells no
  Platinum, so this is the way to get it. Change the amount with `--platinum <n>` (0 = none).
- 100 pass XP per level (was 3,000). The game grants about 5-11 pass XP per event, so nobody got past level 0.
- Rotation unchanged: season43-50 = HP03 Mossy, HP04 Arid, HP05 Ninja, HP06 Pirate, HP06B Academy, HP07A Monk,
  HP07B Witch, HP08A Heroes.
- Fixed "Server Error. Please try again later." when claiming a pass level. A claim grants both rewards, confirms the
  free level, then confirms the Elite level (`POST /progression/<user>/<season>/<level>/confirm/premium`). The server
  had no Elite confirm, so it answered 404 after the rewards were already given and the Elite level never showed as
  claimed. The rank-confirm route now handles both (same checks); the Elite rank is stored in `confirmedPremiumRank`.
  Needs a backend restart (the start script rebuilds it).

**Reward Cache**
- 31 tiles use the art the live store drew for the item (the client's StoreItemsTable) instead of the catalogue icon:
  all 7 gliders (were a grey ring), sigils that were a tiny icon at the tile's left edge, and the Alchemancer, Seismic,
  Raiders and Heroes armour that showed blank or wrong. Same 178 items, prices and tags.
- Second pass after in-game screenshots: Weavewitch Homunculance (was the blank placeholder icon) and Harvest Pumpkin
  Sigil use their store tiles; six sigils are back on their small icons (the full-size sigil textures drew a black
  square). 98 of 178 tiles now use the live store's art.
- New `ParadoxBackend/scripts/list_pak_textures.cjs`: lists the texture paths of your own install's paks
  (`Items_Analysis/pak_textures_1_14_7.txt`); `npm run reward-cache:generate` uses it when present.
- CatalogExporter: store images are exported with their full `/Game/...` path (they were cut to the short name).

**Moving the server / backups (31 Oct)**
- New `Make-Server-Pack.bat` (beside the repository; `scripts/mng-make-server-pack.ps1`): one zip in `Server-Packs\`
  (~76 MB) with the server code, the .env settings, game data, signing keys, packages, the runtime update feed,
  MysticParadox.dll + winmm.dll, the game downloader and a copy of the database. Build outputs of the launcher,
  runtime and tools are left out. The zip holds secrets: keep it private.
- New `Install-Server.bat` inside the pack (`scripts/mng-install-server.ps1`): asks for administrator rights, installs
  Node.js and MongoDB with winget when missing, turns on the replica set, finds or downloads the game, copies the
  runtime files next to it, points the .env paths at the new PC, restores the saves (asks and backs up first if the PC
  already has a database) and can open the firewall ports. Safe to run again.
- New `ParadoxBackend/scripts/mng-database.cjs` (export / import / count / init-replica) with the backend's own MongoDB
  driver, so no MongoDB tools are needed. Round trip tested: same 1,036 documents and indexes.

**Playing on a server on another PC (31 Oct)**
- New `Set-Server-Address.bat` (server PC; `scripts/mng-set-address.ps1`): lists the PC's addresses (Tailscale, home
  network) and writes the one players use to MY_IP, UPDATE_PUBLIC_BASE_URL and REALTIME_XMPP_ALLOWED_HOSTS. The
  installer runs it when players on other PCs will connect.
- `Start-Launcher.bat` (`scripts/mng-start-launcher.ps1`) asks once which server to use and keeps it in
  `launcher-server.txt` (`Start-Launcher.bat change` asks again); it builds the launcher for that address
  (MYSTICPARADOX_API_BASE_URL) and always passes the MNG runtime key.
- Debug launcher: runtime downloads over plain HTTP are accepted from the launcher's own server at any address (the
  MNG servers have no HTTPS yet; host and port must match and every file is still signature-checked). Fixes "Extra file
  URL is not an approved HTTPS endpoint" on Play. Links a server hands out for 127.0.0.1 (UPDATE_PUBLIC_BASE_URL not
  set) are fetched from the connected server instead. Tested (cargo test).
- Fixed "An error occurred while communicating with the game servers" at login on a server on another PC: the launcher
  only passed plain http:// server addresses to the game for localhost, so the game fell back to its built-in
  https://localhost (log: `[BackendAddress] source=built-in`). A debug build now passes its own http://host:port,
  and the second check just before the game starts (launch/process.rs, "Invalid server address.") accepts it too.
  Two launcher tests that still expected the old "Mystic Paradox" name and no official address were updated.
- About: removed the "Check this build" card and its startup check against the original project's GitHub releases
  (MNG builds are never there, so it always showed "Not on GitHub" / "Not verified").
- Game downloader: fixed the free-space check crashing in Windows PowerShell 5.1 ("Cannot convert ... to Int32").

**HTTPS and the public launcher (31 Oct)**
- Server name dauntless.maning-gaming.com (Hostinger DNS A record -> the server PC). New Set-Up-HTTPS.bat
  (scripts/mng-setup-https.ps1 + ParadoxBackend/scripts/mng-https.cjs): stops the server, opens TCP 443/80 in the firewall,
  gets a Let's Encrypt certificate (http-01 on port 80, answered by the script itself) and switches the backend to HTTPS on
  443 (.env: MNG_DOMAIN, HTTPS_PORT, PARADOX_CERT/KEY_PEM_PATH, TLS proxy off, UPDATE_PUBLIC_BASE_URL, XMPP hosts).
  Start-Server renews it when under 30 days remain. New backend package: acme-client 5.4.0.
- Install-Server reinstalls the server packages when package-lock.json is newer than the installed ones (update packs carry
  no node_modules; acme-client is new).
- Set-Server-Address keeps the https:// download address once HTTPS is set up.
- New Build-Launcher.bat (scripts/mng-build-launcher.ps1): the players' installer (NSIS) with the HTTPS server name, the
  runtime key and the GitHub release repository built in (release-server.txt / release-repo.txt); no launcher self-update
  yet. Output in Launcher-Releases\. A trial release build passed (31 Oct).
- .gitignore: realm-data/ (a local player database) and certs/.

**Every event's shop, event notices, Midsommar, launcher ping and art (31 Oct)**
- Honest Ozz has a shop for every event (scripts/generate_event_stores.cjs -> game-data/event_store.json); the server sells
  the running event's only. Dark Harvest 46 offers (as before), Frostfall 42 (the wiki's list and prices; 7 sweaters named
  by number, no names in 1.14.7), Ramsgiving 33 (Ramsgiving Crown 4000 as on the wiki), Saint's Bond 51, Springtide 21:
  every cosmetic the client's store rows have for the event, priced by type like the wiki shops. Each also sells the
  supplies (Rams, Patrol Key, Merits, Bounty Token, Aethersparks, tonics). Unnamed items get plain names ("Ramsgiving Axe I").
- Midsommar (3 Aug - 14 Sep, after the 2023 Midsommar Madness pass): 18 offers (Ritualist armour, Caladag and the other
  6 weapons, glider, lantern, ...) priced in Rams; no event currency, Ozz's stall only.
- The launcher's notices (GET /launcher/v1/notices) carry the running event automatically: an announcement ("Dark Harvest
  is on until 7 Nov! Every completed hunt pays 100 Harvest Coins. ...") and a tag with the event's name.
- Launcher: a Ping row in the service status (best of three HTTP round trips on an open connection, coloured) and in the
  corner's detail line; the background art switches to the running event's picture (src/assets/events, your .webp files).
- Launcher, MNG only: no player-hosted MNG Servers (the Add form, invites and the Host MNG Server page are gone; invites are
  no longer polled, which were 404s on our server). The MNG Server page only sets where the game is installed; the server
  address stays built in. Switch: MNG_PLAYER_SERVERS in src/servers/RealmInvites.tsx.
- Launcher data folder %LOCALAPPDATA%\MNGDauntless (session logs, realm host log; was MysticParadox, left as it is). The
  build badges and two error messages say MNG DAUNTLESS; Mystic Paradox stays credited in About, the terms and the licence headers.
- Launcher: the announcement banner sits on each page's art: on Home in the space above the cards, on the other pages under
  their title (it ran under the corner's tags, then sat on a dark strip above the page).
- Runtime 0.1.7: [SeasonalProbe] logs the client's seasonal event tables (event ids, tags, currencies, rounds), the ids the
  event schedule (GET /game_tuning/seasonal_event_schedule, served empty) would name. First step towards event hunts.

**Seasonal events research, Ramsgiving (31 Oct)**
- New docs/MNG_SEASONAL_EVENTS.md: the five events from the wiki (dates, NPCs, currencies and how they were earned,
  quests, rewards, Frostfall's full shop with prices) and what the 1.14.7 client has for each.
- Ramsgiving (16 Nov - 1 Dec) added to the server calendar (Golden Rams per hunt) and to the Game.ini script (Ozz's
  stall only: 1.14.7 Ramsgate has no Ramsgiving dressing). Player-Currency.bat knows "ramsgiving".

**Event shop, event currency, currency tool (31 Oct)**
- Honest Ozz (the event merchant) now has a Dark Harvest shop: the wiki's "Honest Ozz's Event Store" list with its prices
  in Harvest Coins (dauntless.fandom.com/wiki/Dark_Harvest): 4 Curiosities (10 each), 3 masks (500), Twilight's Laugh and
  Devious Grimace lanterns, Red-Eye glider and the 7 Bloodshot weapons (1,200), 4 flares, 5 banner pieces, Rams, Patrol
  Key, Combat Merits, Bounty Token, Aethersparks, tonics, Nightshade dye, Granny Strega emojis. Plus the 2021 rumour
  rewards (7 Unseen weapons, Grinning Rictus, Unseen fabric/standard/flare) at their Bloodshot counterparts' prices,
  until the rumour quests are served. Data: game-data/event_store.json, made by scripts/generate_event_store.cjs.
- Ozz's shop (after the first in-game look): item descriptions from the wiki (the details box was empty), the rumour
  items show their own icons, and a one-time item you already bought is listed with nothing remaining (it showed
  "Buy Now" again; a second purchase never charged twice). Buying works (Bloodshot Beheader, 31 Oct).
- Ozz's shop follows the event calendar: it sells only while Dark Harvest runs (14 Oct - 7 Nov) and is empty
  afterwards; the coins stay in the wallet for next year.
- Event currency: each completed hunt pays 100 of the running event's currency (Dark Harvest 14 Oct - 7 Nov, same
  calendar as the seasonal script). .env: MNG_SEASONAL_EVENT (off, or force an event), MNG_EVENT_CURRENCY_PER_HUNT.
- Runtime 0.1.6: [StoreProbe] logs each store screen's tag and tabs once. Ozz's shop asks for "seasonal_event" (no tabs);
  the offers carry that tag. Checked in game: the shop lists the offers with the wiki prices.
- New `Player-Currency.bat` (scripts/mng-currency.cjs) on the server PC: list players' balances, give or set any
  currency (Rams, Platinum, event currency, ...) for one player or all; changes are logged to
  ParadoxBackend/logs/currency-changes.log. Also in the server and update packs.

**Event stall + update packs (31 Oct)**
- Runtime 0.1.5: the event merchant's stall sub-level (city_01_event_stall) is streamed into Ramsgate when
  city_event_stall_bpff is on, like the events' own sub-levels; the seasonal script now turns that flag on with each
  event. With 0.1.4 the stall's stage stood empty. Checked in game: the stall and Honest Ozz appear.
- New `Make-Update-Pack.bat` (`scripts/mng-make-update-pack.ps1`): a zip (~22 MB) for a server already installed
  elsewhere, with the new code, tools, runtime feed and runtime DLL, and no .env, keys, packages or database.

**Game downloader (31 Oct)**
- New `MNG-Game-Downloader\` folder, copy it to any PC: `Download-Game.bat` installs Node.js if needed, asks for the
  folder (C:\Games\Dauntless by default), checks the free space and downloads 1.14.7 from Epic's CDN. It now works in
  ~1 GB steps and deletes downloaded pieces once written, so it needs ~17.5 GB free instead of ~31 GB; it resumes after
  a stop and checks the game exe at the end. Replaces `dl\download.mjs`.

**Running the server**
- New `scripts/mng-server.ps1` (start / stop / restart / status) and double-click files beside the repository:
  `Start-Server.bat`, `Stop-Server.bat`, `Restart-Server.bat`, `Server-Status.bat`. Start checks MongoDB, applies the
  seasonal event for today, then opens the backend (port 3000) and the Director (3001) in their own windows, which also
  write `backend-run.log` / `director-run.log` (the previous run is kept as `*.prev.log`). Stop closes those windows with
  the Ramsgate, Dojo and hunt servers; other node programs and MongoDB are left alone.
- `Start-Launcher.bat`: starts the server if it is not running, then the development launcher (`npm run tauri dev`).

**Seasonal events**
- New `scripts/mng-seasonal-events.mjs`: turns on Ramsgate's event dressing by date (Dark Harvest, Frostfall,
  Saint's Bond, Springtide) through the game's own feature flags in the user Game.ini. Not yet confirmed in game.
  The game rewrites Game.ini itself and drops comments, so the script finds its sections by name (an earlier version
  relied on marker comments and wrote the setting again on every start).

## 0.2.0 - 2026-10-30

First MNG DAUNTLESS build: a modified version of Mystic Paradox for Dauntless 1.14.7.

**Branding**
- Launcher, in-game texts, emails, credits and start screen renamed to MNG DAUNTLESS; MNG logo and app icons.
- Paradox realms renamed to MNG Servers.
- New Terms of Use and Privacy Policy (version 2026-10-30); contact studioferrermoz@gmail.com.
- About page and credits keep the Mystic Paradox and Undaunted attribution the licence requires.

**Launcher**
- The official server entry passes its own address to the game, so the game follows the server the launcher was built for.
- Debug builds accept the runtime feed over plain HTTP when the server is on the same PC (local testing only).

**Server**
- Runs on MongoDB (one-member replica set `rs0`).
- Real game data generated from the 1.14.7 client: catalog, storage policy, Reward Cache, Platinum store,
  Slayer's Path (509 nodes), hunt tables (154 of 161 launchable), progression config.
- Progression config built from the client's own tables (player level, weapon levels and prestige, mastery).
- Legacy Hunt Pass: seasons 43-50 carry old passes (HP03 Mossy ... HP08A Heroes), rotating every 4 weeks from
  2026-10-29; premium is free for everyone; rank skips and pass purchases are disabled.
- Fountain daily bundle: 1,000 Rams and a Common Cell Core.
- Patch notes explain the Legacy Hunt Pass.

**Runtime**
- Fixed the SDK generated by Dumper-7 (function lookups used the class name), which crashed Ramsgate when a player spawned.
- The kick reason is logged when a server sends a player back to the menu.
- Credits/start-screen text escaped so special characters show correctly.
