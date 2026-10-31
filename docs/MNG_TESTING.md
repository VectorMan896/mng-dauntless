# MNG DAUNTLESS: testing before the live server

Players are on the live server (your friend's PC, https://dauntless.maning-gaming.com). Every change is tried on this PC
first, and reaches the live server only as an update pack.

## The two places

| | Test (this PC) | Live (the friend's PC) |
|---|---|---|
| Server | `Start-Server.bat` / `Stop-Server.bat` here | `C:\MNG-Server`, changed only by update packs |
| Database | this PC's `mngdauntless` (test accounts) | the players' accounts and saves |
| Address | http://127.0.0.1:3000 | https://dauntless.maning-gaming.com |
| Launcher | `Start-Test.bat` (development launcher, rebuilt on every code change) | the installed launcher from the GitHub release |
| Runtime feed | `server-data\` here (publish-runtime-update.mjs) | the copy inside the last update pack |

To play with everyone, use the installed launcher. To try a change, use `Start-Test.bat`. Both use the same game folder:
each launcher puts its server's runtime next to the game when you press Play, so switching between them is safe.

## The flow for every change

1. **Change** the code or the data on this PC.
2. **Build what changed**: the backend rebuilds itself on start; the runtime with MSBuild and
   `publish-runtime-update.mjs --version <next>` (to this PC's feed); the launcher rebuilds in `Start-Test.bat`.
3. **Test here**: `Stop-Server.bat`, `Start-Test.bat` (starts the server again), then the checklist below.
4. **Commit** (`git commit`), then `Make-Update-Pack.bat`.
5. **Ship to the live server**: on the friend's PC `Stop-Server.bat`, unzip the update over `C:\MNG-Server`,
   `Install-Server.bat` (database: **No**), `Start-Server.bat`. Pick a quiet time: the stop disconnects everyone.
6. **Check live** from this PC: `https://dauntless.maning-gaming.com/launcher/v1/status` answers, then play once with the
   installed launcher.
7. **A launcher change** also needs a new installer: raise the version
   (`node scripts/mng-bump-launcher-version.mjs patch "what changed"`), `Build-Launcher.bat`, then a GitHub release with
   the tag `launcher-v<version>`. `git push` the source.

## Checklist (before every update pack)

- [ ] The backend tests: `cd ParadoxBackend && npm test` (the `*.gamedata.test` failures listed in TODO-MNG.md are
      known); after Rust changes `cargo fmt` and `cargo test` in `ParadoxLauncher\src-tauri` (GitHub checks both).
- [ ] **A new player**: create a fresh account in the test launcher (any made-up email), choose the game folder, Play.
      Character creation, Ramsgate loads.
- [ ] **A returning player**: sign in with an existing test account; the character and inventory are there.
- [ ] A hunt from the Ramsgate map: it starts, ends, the rewards arrive, back to Ramsgate.
- [ ] What the change touched (for example: the event shop lists and sells; the currency moves; the notice shows).
- [ ] The server windows show no new errors (`backend-run.log`, `director-run.log` beside the .bat files).

## Testing as a new player on another PC

The best test of the installer is a PC (or a Windows user account) that never had MNG DAUNTLESS: install the launcher from
the GitHub release, download the game with the MNG Game Downloader, create an account, Play. That is what new players do,
and it shows what only exists on this PC (for example: Start-Launcher.bat writes the event flags into this PC's Game.ini;
a player's PC only gets what the installed launcher and the runtime do).

## Reproducing a live problem here

Ask for the player's log (the launcher's Settings > logs, or `C:\Games\Dauntless\Archon\Binaries\Win64\
mysticparadox_dll_port0.log`) and the live server's `backend-run.log`. A copy of the live database
(`node scripts/mng-database.cjs export <folder>` on the friend's PC, `import` here) holds every player's data: keep it on
this PC only and delete it after.
