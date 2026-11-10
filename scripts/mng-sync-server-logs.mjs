#!/usr/bin/env node
// [MNG DAUNTLESS 2026-11-10] Pulls the live server's own logs to this PC (Get-Server-Logs.bat): the backend, the Director, each
// game server's console output and the runtime logs of Ramsgate, the Training Dojo and the hunts. They are served read-only by
// GET /admin/v1/server-logs (ParadoxBackend/src/routes/adminServerLogs.ts) behind LAUNCHER_LOG_SYNC_TOKEN, which the server PC
// sets once with Enable-Log-Sync.bat.
//
// USAGE (from the folder that holds Mystic-Paradox)
//   node Mystic-Paradox/scripts/mng-sync-server-logs.mjs [--server <host or URL>] [--days 7] [--tail-mb 8]
// The server defaults to release-server.txt (the live address); the token comes from MNG_LOG_SYNC_TOKEN or
// live-log-sync-token.txt next to Mystic-Paradox (never committed). Files land in logs\live-server\<date_time>\, and a short
// summary counts the lines that matter: errors, [Health], [Stamina] STUCK, [CityEvent], kicks and exits.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const Root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const Arg = (name, fallback) => {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};
const ReadText = (file) => { try { return fs.readFileSync(path.join(Root, file), "utf8").trim(); } catch { return ""; } };

let Server = Arg("server", ReadText("release-server.txt"));
if (!Server) { console.error("No server: pass --server or put the address in release-server.txt"); process.exit(1); }
if (!/^https?:\/\//i.test(Server)) Server = `https://${Server}`;
Server = Server.replace(/\/+$/, "");
const Token = (process.env.MNG_LOG_SYNC_TOKEN ?? ReadText("live-log-sync-token.txt")).trim();
if (!Token) { console.error("No token: set MNG_LOG_SYNC_TOKEN or put it in live-log-sync-token.txt"); process.exit(1); }
const Days = Number(Arg("days", "7"));
const TailBytes = Math.round(Number(Arg("tail-mb", "8")) * 1024 * 1024);

async function Get(url) {
    const res = await fetch(url, { headers: { "x-sync-token": Token } });
    if (res.status === 401) throw new Error("The server refused the token (401). Run Enable-Log-Sync.bat on the server PC with this token, then restart its server.");
    if (res.status === 404 && url.includes("/server-logs?")) throw new Error("The server has no /admin/v1/server-logs yet (404): apply the update pack from 10 Nov or later.");
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return res;
}

const Listing = await (await Get(`${Server}/admin/v1/server-logs?days=${Days}`)).json();
const Stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "_").slice(0, 13);
const OutDir = path.join(Root, "logs", "live-server", Stamp);
fs.mkdirSync(OutDir, { recursive: true });
console.log(`${Server}: backend up ${Math.round(Listing.backendUptimeSeconds / 3600)} h, ${Listing.files.length} log files from the last ${Days} days`);

const Patterns = {
    errors: /\bERROR\b|\berror\b.*:|Fatal|Unhandled|AccessViolation|EXCEPTION/,
    health: /\[Health\]/,
    staminaStuck: /\[Stamina\].*STUCK/,
    kicks: /kick|Kicked|NetConnectionClose|ClientNetworkFailure|LoadFailed/i,
};
const Summary = [];
for (const File of Listing.files) {
    const res = await Get(`${Server}/admin/v1/server-logs/file?name=${encodeURIComponent(File.name)}&tail=${TailBytes}`);
    const Text = await res.text();
    const Local = path.join(OutDir, File.name.replace(/[\\/]/g, "__"));
    fs.writeFileSync(Local, Text);
    const Lines = Text.split(/\r?\n/);
    const Counts = Object.fromEntries(Object.entries(Patterns).map(([k, re]) => [k, Lines.filter((l) => re.test(l)).length]));
    const Partial = Number(res.headers.get("x-log-start") ?? 0) > 0 ? " (last part)" : "";
    Summary.push(`${File.name.padEnd(52)} ${(File.size / 1024 / 1024).toFixed(1).padStart(7)} MB${Partial}  modified ${File.modified.slice(0, 16).replace("T", " ")}  errors=${Counts.errors} health=${Counts.health} staminaStuck=${Counts.staminaStuck} kicks/closes=${Counts.kicks}`);
}
fs.writeFileSync(path.join(OutDir, "SUMMARY.txt"), `${Server} at ${Listing.serverTime}\n\n${Summary.join("\n")}\n`);
console.log(Summary.join("\n"));
console.log(`\nSaved to ${OutDir}`);
