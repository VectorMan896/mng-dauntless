# MNG DAUNTLESS TODO

Updated 2026-11-01. Launcher version 0.3.0 (released, self-updating; live server on update pack 2026-11-01_0707); server data changes are listed under "Unreleased" in CHANGELOG-MNG.md.

## Now
- [x] **Windows Defender removes winmm.dll** (reported to Microsoft and launcher check shipped 1 Nov; code signing still open) (31 Oct, 12:12 on this PC): `Program:Win32/Contebrew.A!ml` (a machine-learning
      guess; the proxy-DLL loader looks like DLL hijacking). Without it the runtime never loads: the game and the local game
      servers start plain and show "Failed to create IGameClient instance". Players will hit it too. (1) Owner: report the
      false positive at microsoft.com/wdsi/filesubmission (software developer, incorrectly detected). (2) Launcher: after an
      install, detect a missing winmm.dll / MysticParadox.dll and explain it [done in launcher 0.3.0] (Protection history > Restore, or an exclusion
      for the game folder) instead of starting the game. (3) Later: code-sign the loader, the runtime and the launcher.
- [x] **Players do not see the events** (found 31 Oct; fixed in runtime 0.1.8 [EventCalendar], tested on this PC with an
      empty Game.ini: dressing and Ozz visible, client and Ramsgate server log the flags; live 1 Nov): Ramsgate's event dressing and Ozz's stall need the event feature
      flags in each player's own Game.ini. Only Start-Launcher.bat / Start-Test.bat write them (scripts/mng-seasonal-events.mjs,
      this PC); the released launcher does not, so players on other PCs see no decorations and no Ozz (no event shop).
      Fix in the runtime (it auto-updates, no new launcher needed): set the CDOs' bEnabled for the running event's flags
      (city_event_*_bpff, city_event_stall_bpff) on the client, from the same calendar, before Ramsgate streams its levels.
      Test with docs/MNG_TESTING.md "Testing as a new player" (a Game.ini without the MNG block).
- [x] **Restart needed** for the 31 Oct changes: backend (bonus levels, Trials leaderboards) and the game servers (runtime
      0.1.4). The launcher installs runtime 0.1.4 on the next Play; the dev launcher needs a restart for the new icons.
- [ ] Check in game: (Dark Harvest shows: done 31 Oct) the Hunt Pass screen has no Skip to Next Level button
      (`[HuntPassSkip]` in port0.log); bonus levels after 50 pay 25 Bonus Cache Coins.
- [x] Hunts work end to end (owner, 31 Oct).
- [ ] Test the fountain daily bundle, cells (drops, cores, Middleman fusion) and daily/weekly bounties.
- [ ] Client crash at 21:00 on 2026-10-30: access violation in ProcessEventClientHook (dllmain.cpp:14831); minidump in %LOCALAPPDATA%\Archon\Saved\Crashes.
- [x] Server start/stop files: `Start-Server.bat`, `Stop-Server.bat`, `Restart-Server.bat`, `Server-Status.bat` in
      DautlessReforged (they call `scripts/mng-server.ps1`). Tested on 30 Oct: start brings up backend, Director,
      Ramsgate and the Dojo; stop closes them all. The new pass, Platinum and Reward Cache data load on start.
- [x] `Start-Launcher.bat`: starts the server if needed, then the launcher (`npm run tauri dev`; there is only a debug
      build, which needs the Vite dev server, so the exe alone does not work). Tested on 30 Oct.
- [x] Server pack + installer (31 Oct): `Make-Server-Pack.bat` -> `Server-Packs\MNG-Server-<date>.zip`; on the other PC
      unzip, then `Install-Server.bat`. Pack built and checked on this PC (extracted copy reads the database, packages
      load, build is current); the .env and MongoDB config steps tested on the copy.
- [x] Connect the launcher to the server on the other PC (Set-Server-Address.bat there, Start-Launcher.bat change
      here) and play Ramsgate + one hunt over the network.
- [x] Run Install-Server.bat on a second PC for real (the full run needs administrator rights and was not run here,
      because this PC already has the server).
- [x] Game downloader for any PC (31 Oct): `MNG-Game-Downloader\Download-Game.bat`. Tested on the first 1.7 GB.
- [x] Cleanup: `C:\Games\_chunk_cache` (15 GB) deleted 1 Nov. `dl\` kept (1 MB, the first downloader's scripts).
- [x] Public launcher (31 Oct, released as launcher 0.2.0 on GitHub): DNS done (dauntless.maning-gaming.com -> the server PC). Friend: forward TCP 443
      (and 80) on the router, apply the update pack, run Set-Up-HTTPS.bat, Start-Server. Then Build-Launcher.bat here, the
      GitHub repository (owner/name) and a release with the installer. Later: a launcher updater key (self-update).
- [x] (older) Players need a real launcher build (installer from `npm run tauri build`, with the server address and runtime key
      set at build time - see ParadoxLauncher/README.md), not the dev launcher.
- [x] Hunt Pass works in game (owner, 31 Oct): rewards on every level, claims go through (the "Server Error" Elite-confirm
      fix is live).
- [x] Hunt Pass bonus levels after 50 (31 Oct): 25 Bonus Cache Coins per 100 pass XP, all on the free track (see
      CHANGELOG). Tune with `add_legacy_huntpass.cjs --bonus-coins <n> --bonus-xp <n>`, then regenerate the config.
- [x] Hunt Pass "Skip to Next Level" button hidden by runtime 0.1.4 (needs the restart and an in-game look).
- [x] Naked character in the hunt menu: fixed itself (owner, 31 Oct); the runtime lead is kept in this file's history.
- [x] Reward Cache, first in-game check (22:30): gliders, armour, weapons and standards fixed. Second pass done: the
      full-size sigil textures were white-on-black masks (black squares) and are no longer used; Weavewitch Homunculance
      (placeholder icon) and Harvest Pumpkin Sigil now use their store tiles.
- [x] Reward Cache: Weavewitch Homunculance, Harvest Pumpkin Sigil and the sigils show in game (owner, 31 Oct).
- [ ] Reward Cache, what game files cannot fix (the tile draws a picture at its own size, so small icons sit at the left
      edge, and the game has no larger art for these): sigils without Hunt Pass art (Frostfall Corona, Frostfall Snow
      Crystal, Aetherwort, Horror from the Deeps, Time to Work, True Lodestar), back accessories (Skyshark's Teeth, Wings
      of Paradise), The Unseen Crown. White fabrics (Psycho Circuit, Splatterpunk Shield, Autumn Fox, Malevolent Grove,
      Molten Plateau, Stitched Harvest) are how the live store drew them too. Options: swap those items out of the
      rotation for items with store art, or serve our own tile images if the client's StoreDownloadImagesFeature can load
      them from a URL (untested).
- [x] Dark Harvest: not visible in Ramsgate (owner, 31 Oct) although the flag is on for client and server (Game.ini
      works). The event sub-level `/Game/Maps/ramsgate/events/city_01_event_dark_harvest` never loaded; runtime 0.1.4
      streams it in (see Seasonal events). Check after the restart.

## Seasonal events (Halloween, Christmas, ...)
- [x] Found the switch: Ramsgate's event dressing is gated by feature flags that ship off in 1.14.7
      (city_event_dark_harvest_bpff, enable_city_event_frostfall_bpff, city_event_SaintsBond_bpff,
      city_event_Springtide_bpff, plus city_event_stall_bpff). Calendar in scripts/mng-seasonal-events.mjs.
- [x] The game reads that Game.ini section: on the 22:38 restart it rewrote the file itself and kept
      `bEnabled=True` (dropping comment lines; the script now finds its sections by name, not by markers).
- [x] The ini route works: `[FeatureFlags] city_event_dark_harvest_bpff_C bEnabled=1` on Ramsgate's server and the client.
- [x] The flag alone does not dress Ramsgate. Runtime 0.1.4 (`CityEventLevels` in dllmain.cpp) asks Ramsgate's streaming
      sub-level named after the event to load and show. If `[CityEvent]` says the sub-level is not in Ramsgate's streaming
      list, the next step is loading it as a level instance (ULevelStreamingDynamic::LoadLevelInstance), client and server.
      The 1.14.7 paks have event sub-levels for Dark Harvest and Saint's Bond only (`/Game/Maps/ramsgate/events/`).
- [ ] Event quests and currency: the client has EVENT_DARKHARVEST_QUESTS, EVENT_FROSTFALL_QUESTS(_2023), Saint's Bond
      and Springtide quests, and event currencies (CURRENCY_EVENT_DARKHARVEST / _FROSTFALL). The backend answers
      GET /game_tuning/seasonal_event_schedule with an empty list; its shape is FServiceSchedule
      `{ ScheduledItems: [FScheduleData { StartTime, EndTime, ScheduledItems: [{ ID, MaxCompletionPerInterval }] }] }`
      with IDs from the client's SeasonalEventsTable. Export that table (EXPORT_TABLE_INVENTORY, then a row serializer)
      and serve the current event.
- [x] Dark Harvest dressing confirmed in game (31 Oct, on the friend's server): the Game.ini route works
      (`city_event_dark_harvest_bpff_C bEnabled=1` in the Ramsgate log). The event NPC's stage stood empty.
- [x] city_event_stall_bpff (event merchant stall): runtime 0.1.5 streams city_01_event_stall in; the stall and Honest
      Ozz appear in game (31 Oct, friend's server). His shop was empty.
- [ ] Event shop (31 Oct, runtime 0.1.6 + backend): game-data/event_store.json (46 offers, wiki
      list and prices, scripts/generate_event_store.cjs) priced in CURRENCY_EVENT_DARKHARVEST; each completed dedicated hunt pays
      100 of the running event's currency (src/seasonalEvents.ts, MNG_SEASONAL_EVENT / MNG_EVENT_CURRENCY_PER_HUNT).
      Shop shown in game (31 Oct): names, types and prices right. Ozz's screen asks for tag "seasonal_event", no tabs
      ([StoreProbe]); the SKUs now carry it. The rumour stand-ins showed the generic rumour-skip art from their
      quest_rumour_* rows: now sku_<catalog id> with the item icon (check). Buying works (31 Oct); bought
      one-time items are now listed with remaining 0 (check the client shows them as owned; if not, hide them instead).
      Event end: the shop and the coin payment follow the calendar by themselves. The Ramsgate dressing and stall
      do not: Game.ini is written only by Start-Server (server PC) and Start-Launcher (players), so the Ramsgate
      server keeps the event until it restarts. Option: a daily scheduled Restart-Server (asked 31 Oct).
      1.14.7 Ramsgate has dressing sub-levels only for Dark Harvest and Frostfall (+ season_16a/16b/17a); Saint's Bond
      and Springtide would show just the stall. Ramsgiving (November, wiki) has store rows and
      CURRENCY_EVENT_RAMSGIVING but no flag or sub-level. Midsommar store rows exist too.
      All six shops built (31 Oct, scripts/generate_event_stores.cjs). Check in game: Ramsgiving (16 Nov), Frostfall (9 Dec).
      Force one to test: .env MNG_SEASONAL_EVENT=frostfall (server) + node scripts/mng-seasonal-events.mjs --event frostfall.
- [ ] Event hunts in 1.14.7 tables: Unseen Summons (MatchmakerHunt_Event_Dark_Harvest_01 / _Hard_01), King Gruk
      (MatchmakerHunt_Event_Ramsgiving_01/02), Anniversary 01/02, Pufflehop Rescue (CR19_MatchmakerHunt_Event_Spring_2020,
      Spring_Event_Island_01), a Charrogg entry. The client does not offer them.
      Tried 1 Nov: the client fetched the served schedule (Dark Harvest, ID EVENT_DARKHARVEST) and accepted it, but the hunt
      map showed nothing new. So the schedule alone is not the gate: next look at island_content_config / the matchmaker
      hunt list, or have the runtime log what the map reads (a probe like [SeasonalProbe]).
      Runtime 0.1.7 [SeasonalProbe] (31 Oct, client log): seasonal_event_ui_table has 6 rows (row -> eventId, hunt tag,
      currency): SpringEvent -> EVENT_SPRINGTIDE, Hunt.Event.Spring, rounds egghunt/bunnies/sharkcats; DarkHarvest ->
      EVENT_DARKHARVEST, Hunt.Event.DarkHarvest; Anniversary -> Event_Anniversary_Evergreen, Hunt.Event.Anniversary
      (Harvest Coins); Ramsgiving -> EVENT_RAMSGIVING; Frostfall -> EVENT_FROSTFALL; SaintsBond ->
      Event_Saints_Bond_Evergreen. Next: serve GET /game_tuning/seasonal_event_schedule with the running event
      (ScheduledItems [{ Name, StartTime, EndTime, ScheduledItems: [{ ID: <eventId or row>, MaxCompletionPerInterval: -1 }] }],
      FServiceSchedule/FScheduleData) and see whether the client offers the event hunt (MatchmakerHunt_Event_Dark_Harvest_01
      carries Hunt.Event.DarkHarvest). Anniversary is a seventh event, not in the calendar yet. Island events, quests and rumours
      need the quest system (not served).
- [x] Launcher ping + seasonal art applied (31 Oct). Launcher workflow test fails before and after (cannot load
      servers/RealmInvites from HomeTab.tsx; unrelated).
- [ ] In-game MOTD popup (GET /motd/trigger) could carry the event news, but its response body was never captured: a 200
      with the usual envelope opened an empty popup (15 Oct). Needs the client's parser (Ghidra) first.
      Unsure matches: Sinister Squash = TY_THROWN_DH2020, Unseen Curse = BNC_ANIMATION_UNSEEN_01 (or HP07B_UNSEEN_00).
      Still missing: the schedule (seasonal_event_schedule), the event quests/rumours (Unseen gifts in Ramsgate,
      Mysterious Notes), Shrowd Effigies / part-break coins, TITLE_DARKHARVESTER, The Unseen Crown; Frostfall/Saint's Bond/Springtide shops.
- [x] Start-Launcher.bat applies the seasonal flags on each player's PC (the client reads its own Game.ini).
- [x] For players on other PCs (friend's server): the launcher should write the same Game.ini block, or the runtime
      should set the flags, since the client reads its own config.

## Trials
- [x] All 11 Trials hunts resolve to a launch manifest (Easy/Hard/Elite and the test Trials, arena_ramsgate_00);
      the weekly rotation is on row 070 (TRIALS_ROTATION_MINUTES, default one week).
- [ ] Play one Trial end to end on the dedicated servers (launch, finish, results screen, Gilded/Steel Marks). Not done
      yet (owner, 31 Oct).
- [x] Leaderboards save runs (31 Oct, src/trialRuns.ts). The game server's run report is undocumented: after the first
      Trial, read `[TrialsMon] submission` in backend-run.log and check `[TrialsMon] run saved` (else adjust
      ParseTrialRunSubmission to the logged body).
- [ ] Lady Luck store (the Trials shop): still the sample file.

## Next
- [x] **Event calendar on the map** (owner's request, 31 Oct; launcher calendar on the MNG Server page, 0.3.0; the in-game
      schedule is served experimentally, check what the client does with it): show the year's seasonal events (dates, what each one brings) on
      the map. In game: the client's own event schedule (GET /game_tuning/seasonal_event_schedule, served empty; runtime
      0.1.7 [SeasonalProbe] logs the event ids) may drive its event UI, to check. Fallback: a calendar card in the launcher
      from the same calendar (src/seasonalEvents.ts).
- [x] **Weekend double drops** (owner's request; src/weekendBonus.ts, 31 Oct, check a weekend hunt's [WeekendDouble] line): Saturday and Sunday (server time), for example double event
      currency and Rams per hunt (backend, easy: a multiplier on the hunt payout and on the reward grants). Double Behemoth
      loot is rolled by the game server: check the game's own boost items (store "supplies_boost", XP/loot boosts) or a
      multiplier on the hunt's inventory grant. Announce it with a launcher notice (like the event notices).
- [ ] **Credits** (owner's request): the people who contributed or tested, on the launcher's About page and in the README,
      next to the Mystic Paradox / Undaunted credit. Needs the list of names from the owner.
- [ ] Guilds: not implemented (server always answers "no guild"). Needs create/join/leave, members and ranks,
      invites, guild chat and the guild hall.
- [ ] Friends: blocklist and "recent players" are placeholders.
- [ ] Legacy Hunt Pass: reset pass progress when the rotation wraps (after season50, around 2027-06-10), and
      move to the next 8 old passes (`node scripts/add_legacy_huntpass.cjs --first 8`, then
      `npm run generate:progression-config -- --apply` and `npm run inventory:storage-policy:generate`). 27 old passes available.
- [ ] Hunt Pass in realms (player-hosted servers): the host grant policy refuses cosmetics, Platinum and Cache Coins
      from a player host, so pass claims there would be refused. Dedicated servers are not affected.
- [x] Hunt Pass "Skip to level N" button: hidden by runtime 0.1.4 (31 Oct).
- [x] Expedition islands 2-8 (the Director's `[HuntLaunchCoverage] unsupported player hunt rows` warning, 7 of 161 hunts):
      not a bug. In the 1.14.7 client's own hunt table these rows point at matchmaker hunt "None" (no table, no tags), and
      the matchmaker tables have no Expedition hunt at all: leftovers of the removed Expeditions mode, not selectable in
      game. The warning on every Director start can be ignored.
- [ ] Optional data: mastery_objectives.json and escalation_tuning.json (read from the paks).
- [ ] Adapt the *.gamedata.test.ts tests that expect the original project's private captures. 1 Nov: 12 left (was 19),
      all MNG data differing on purpose: Lady Luck sample shop (3), no Hunt Pass level skips / captured entitlements in
      the Platinum store (4), 50-rank pass instead of 100 (2), Vault Coins not a pass prestige reward (1), 161 hunt rows
      without the Expedition leftovers (1), the realm-host pass test (1). Rewrite them for MNG data or skip them.
- [ ] **Aetherheart limit back on** (1 Nov): the game data built from the export had no reforge reward on the weapon
      prestige tracks, so the server's Aetherheart limit (controllers/wallet.ts, Hearts only for banked reforges, closes
      a duplication) was off. Added `CURRENCY_PJM_PRESTIGE_FILLED x1` per reforge (build_progression_source_from_export.cjs
      and game-data, backup `progression_config.json.2026-11-01-before-aetherheart.bak`); the 7 prestige tests pass.
      Check in game on this PC: reforge a weapon, the Heart arrives (backend-run.log [PrestigeMon], no 409). Then ship
      in the next update pack.
- [ ] Re-export the store images with the fixed CatalogExporter (full paths), then drop the pak listing step if wanted.

## Launcher
- [x] **Launcher remake** (31 Oct, the owner's reference design): "Charcoal & Mint" colours, Outfit font, a left icon rail,
      top-right server state and avatar, Home with a heavy title, a PLAY pill and three cards (weekly activity, setup,
      server), new app icons (see CHANGELOG-MNG.md). Checked in the browser preview; type check and build pass. The
      earlier "Frost & Ember" pass with a top bar was replaced.
- [ ] Launcher remake, check in the real window (Start-Launcher.bat, restart it for the new icons): dragging the window
      (the 38 px strip at the top and the rail), the window buttons, Play, the status popover. At 1120x700 with a server
      announcement showing, Home scrolls a little to reach the card buttons.
- [ ] Launcher remake, colours: owner not sure yet; one file (src/styles/tokens.css). Bump the launcher version
      (`node scripts/mng-bump-launcher-version.mjs minor "New look"`) when it ships.
- [x] Launcher self-update (0.3.0): key in .secrets\mng-launcher-updater.key (BACK IT UP), feed latest.json on GitHub.
- [x] (0.3.0) The released launcher shows an "UNOFFICIAL BUILD" tag (src/lib/buildKind.ts: any build without the original project's
      official profile). MNG's releases should show no tag, or an MNG one.
- [x] (0.3.0, now the ping) Home's "Your server" card still counts INVITES (player-hosted servers are off): show something useful instead (the
      running event, the player count).
- [ ] Internal names (MysticParadox.dll, MYSTICPARADOX_* settings): rename only if wanted. (%LOCALAPPDATA% folder: MNGDauntless
      since 31 Oct.)

## Friend's server (going live)
- [x] Domain dauntless.maning-gaming.com, Let's Encrypt certificate (http-01, Set-Up-HTTPS.bat), HTTPS live (31 Oct).
- [x] Runtime and launcher signed with the MNG keys; the backend address reaches the runtime from the launcher (no
      MP_PUBLIC_HOST build needed). Live 31 Oct.
- [x] Friend's PC setup (Node.js, MongoDB replica set, game, data, .env, keys, saves): Install-Server.bat from a pack.
- [x] Friend's PC: router forwarding (TCP 443/80/3000, UDP 8780-8790) and MY_IP done (31 Oct).
- [ ] Optional: new secrets for production (the live server still uses the keys made on this PC).
- [ ] Backups of MongoDB and the signing keys.

## Done
- [x] Rebrand to MNG DAUNTLESS, logo, Terms and Privacy Policy, MNG Servers naming.
- [x] Dauntless 1.14.7 downloaded straight from Epic's CDN (dl/download.mjs) and verified.
- [x] SDK dump (and the Dumper-7 bug fix), runtime, loader, exporter built.
- [x] Real game data: catalog, storage policy, stores, Slayer's Path, hunts, progression.
- [x] Local server reaches Ramsgate and Training; Legacy Hunt Pass with free premium; no rank skips.
- [x] Launcher versioning (`node scripts/mng-bump-launcher-version.mjs patch "summary"`) and CHANGELOG-MNG.md.
- [x] 2026-10-30: Hunt Pass Elite levels all filled, pass XP 100 per level, flares/emoji added (was: "most levels blank
      with a checkmark on the lock").
- [x] 2026-10-30: Reward Cache thumbnails: 31 tiles moved to the live store art; the earlier "89 of 178 point to paths the
      game may not have" was wrong, all 178 paths exist in the paks (checked with scripts/list_pak_textures.cjs).
