#!/usr/bin/env node
// [MNG DAUNTLESS 2026-10-30] Seasonal Ramsgate events (Dark Harvest, Frostfall, Saint's Bond, Springtide).
//
// Ramsgate's event dressing is gated by blueprint feature flags that ship turned off in 1.14.7 (the runtime's
// [FeatureFlags] dump on the Ramsgate server: city_event_dark_harvest_bpff_C bEnabled=0, enable_city_event_frostfall_bpff_C
// bEnabled=0, ...). UFeatureFlag::bEnabled is a Config property, so this writes a section per flag into the user-level
// Game.ini (%LOCALAPPDATA%\Archon\Saved\Config\WindowsClient\Game.ini), which the client and the local dedicated servers
// both read at start-up. Only the sections of the event flags below are touched; the rest of the file is kept. The game
// rewrites this file itself (seen 30 Oct: a server start kept the section but dropped every comment line), so the
// sections are found by their names, not by marker comments. Restart the game and the servers afterwards.
//
// UNVERIFIED: whether the config value wins over the value saved in the blueprint. Check the runtime log after the next
// start: grep "[FeatureFlags]" mysticparadox_dll_port*.log for the flag with bEnabled=1, then look at Ramsgate.
//
// USAGE (from the repository root)
//   node scripts/mng-seasonal-events.mjs                 # turn on the event(s) in season today (by the calendar below)
//   node scripts/mng-seasonal-events.mjs --event frostfall   # force one event (dark_harvest, ramsgiving, frostfall, saints_bond, springtide, midsommar)
//   node scripts/mng-seasonal-events.mjs --off           # remove the MNG block (every flag back to the game's default)
//   node scripts/mng-seasonal-events.mjs --list          # show the calendar and what is in season
//   --ini <path>  another Game.ini (e.g. on a server PC with a different user)

import fs from "node:fs";
import path from "node:path";

const FLAG_DIR = "/Game/Features/HuntPass";
// Windows after the live game's usual dates (month 1-12, inclusive). A window may run over the new year.
// city_event_stall_bpff: the event merchant stall in Ramsgate (shared by every event). [31 Oct] Turned on with each event as a
// test: with the dressing alone the stall's stage stood empty. Its shop and quests are not served yet (TODO-MNG.md).
const STALL = "city_event_stall_bpff";
const EVENTS = {
    dark_harvest: { name: "Dark Harvest (Halloween)", from: [10, 14], to: [11, 7], flags: ["city_event_dark_harvest_bpff", STALL] },
    // [31 Oct] Ramsgiving has no Ramsgate dressing in 1.14.7: only Ozz's stall is turned on.
    ramsgiving: { name: "Ramsgiving (Thanksgiving)", from: [11, 16], to: [12, 1], flags: [STALL] },
    frostfall: { name: "Frostfall (Christmas)", from: [12, 9], to: [1, 6], flags: ["enable_city_event_frostfall_bpff", STALL] },
    saints_bond: { name: "Saint's Bond (Valentine's)", from: [2, 6], to: [2, 20], flags: ["city_event_SaintsBond_bpff", STALL] },
    springtide: { name: "Springtide (spring)", from: [3, 26], to: [4, 23], flags: ["city_event_Springtide_bpff", STALL] },
    // [31 Oct] Midsommar (summer, from the Midsommar Madness pass): Ozz's stall only.
    midsommar: { name: "Midsommar (summer)", from: [8, 3], to: [9, 14], flags: [STALL] },
};
const BEGIN = "; >>> MNG DAUNTLESS seasonal events (scripts/mng-seasonal-events.mjs) >>>";
const END = "; <<< MNG DAUNTLESS seasonal events <<<";

function Arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
}
const Has = (name) => process.argv.includes(`--${name}`);

function InSeason(event, date) {
    const md = (date.getMonth() + 1) * 100 + date.getDate();
    const from = event.from[0] * 100 + event.from[1];
    const to = event.to[0] * 100 + event.to[1];
    return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

const now = new Date();
if (Has("list")) {
    for (const [id, e] of Object.entries(EVENTS)) {
        console.log(`${InSeason(e, now) ? "*" : " "} ${id.padEnd(13)} ${e.name.padEnd(28)} ${e.from.join("/")} - ${e.to.join("/")} (month/day)`);
    }
    process.exit(0);
}

const iniPath = path.resolve(Arg("ini") ?? path.join(process.env.LOCALAPPDATA ?? "", "Archon", "Saved", "Config", "WindowsClient", "Game.ini"));
const forced = Arg("event");
if (forced && !EVENTS[forced]) {
    console.error(`Unknown event '${forced}'. Known: ${Object.keys(EVENTS).join(", ")}`);
    process.exit(1);
}
const active = Has("off") ? [] : forced ? [forced] : Object.keys(EVENTS).filter((id) => InSeason(EVENTS[id], now));

const before = fs.existsSync(iniPath) ? fs.readFileSync(iniPath, "utf8") : "";
// Drop every section of a known event flag (and our old marker lines), whatever the game did to the file since.
const ownHeaders = new Set(Object.values(EVENTS).flatMap((e) => e.flags).map((flag) => `[${FLAG_DIR}/${flag}.${flag}_C]`.toLowerCase()));
const keptLines = [];
let inOwnSection = false;
for (const line of before.split(/\r?\n/)) {
    const header = line.trim().match(/^\[.*\]$/);
    if (header) inOwnSection = ownHeaders.has(line.trim().toLowerCase());
    if (inOwnSection || line === BEGIN || line === END) continue;
    keptLines.push(line);
}
const kept = keptLines.join("\r\n").trim();
const block = [...new Set(active.flatMap((id) => EVENTS[id].flags))].map((flag) => `[${FLAG_DIR}/${flag}.${flag}_C]\r\nbEnabled=True`).join("\r\n\r\n");
const after = [kept, block].filter((part) => part.length > 0).join("\r\n\r\n") + "\r\n";

if (after === before) {
    console.log(`No change: ${iniPath}`);
} else {
    if (before.length > 0) fs.copyFileSync(iniPath, `${iniPath}.mng-backup`);
    fs.mkdirSync(path.dirname(iniPath), { recursive: true });
    fs.writeFileSync(iniPath, after);
    console.log(`Wrote ${iniPath}${before.length > 0 ? ` (previous copy: ${iniPath}.mng-backup)` : ""}`);
}
console.log(active.length > 0 ? `Events on: ${active.map((id) => EVENTS[id].name).join(", ")}` : "No seasonal event on (game defaults).");
console.log("Restart the game and the game servers for it to take effect.");
