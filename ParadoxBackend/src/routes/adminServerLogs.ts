/*
 * MNG DAUNTLESS (modified version of Mystic Paradox). Licensed under the GNU Affero General Public License v3.0.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [MNG DAUNTLESS 2026-11-10] The server PC's own logs, for finding bugs on the live server from the development PC
// (scripts/mng-sync-server-logs.mjs, Get-Server-Logs.bat). Read-only, behind the same LAUNCHER_LOG_SYNC_TOKEN as the uploaded
// player logs (routes/adminLauncherLogs.ts); without that setting both answer 401.
//   GET /admin/v1/server-logs?days=7          -> { files: [{ name, size, modified }] }
//   GET /admin/v1/server-logs/file?name=<name>&tail=<bytes>  -> the last <tail> bytes of one listed file (default 8 MiB)
// Listed files: *.log under the repository's debug\ folder (backend, Director, each game server's console output; two levels
// deep) as "debug/...", and the runtime logs mysticparadox_dll_port*.log next to the game exe (the Director's
// GAMESERVER_BINARY_PATH, read from ParadoxDirector\.env, or MNG_GAME_LOG_DIR) as "game/...". A file is served only by a name
// the listing produced, so no path from the request ever reaches the file system.

import { Router, Request, Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { requireSyncToken } from "./adminLauncherLogs";

const DEFAULT_TAIL = 8 * 1024 * 1024;
const MAX_TAIL = 64 * 1024 * 1024;

export interface ServerLogFile {
    name: string;
    fullPath: string;
    size: number;
    modified: string;
}

/** The repository root (the backend runs from ParadoxBackend). */
function RepoRoot(): string {
    return path.resolve(process.cwd(), "..");
}

/** The folder of the game exe the game servers run from, or undefined. */
export function GameLogDir(repoRoot = RepoRoot(), env: NodeJS.ProcessEnv = process.env): string | undefined {
    const Explicit = env.MNG_GAME_LOG_DIR?.trim();
    if (Explicit) return Explicit;
    try {
        const DirectorEnv = fs.readFileSync(path.join(repoRoot, "ParadoxDirector", ".env"), "utf8");
        const Line = DirectorEnv.split(/\r?\n/).find((L) => /^\s*GAMESERVER_BINARY_PATH\s*=/.test(L));
        const Value = Line?.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
        return Value ? path.dirname(Value) : undefined;
    } catch {
        return undefined;
    }
}

/** Pure but for the file system reads: every log file the routes may serve, newest first. */
export function ListServerLogs(days: number, repoRoot = RepoRoot(), gameDir = GameLogDir(repoRoot), now = Date.now()): ServerLogFile[] {
    const Since = now - Math.max(1, days) * 24 * 60 * 60 * 1000;
    const Out: ServerLogFile[] = [];
    const Add = (name: string, fullPath: string) => {
        try {
            const Stat = fs.statSync(fullPath);
            if (!Stat.isFile() || Stat.mtimeMs < Since) return;
            Out.push({ name, fullPath, size: Stat.size, modified: new Date(Stat.mtimeMs).toISOString() });
        } catch {
            // Gone between the listing and the stat.
        }
    };
    const DebugDir = path.join(repoRoot, "debug");
    const Walk = (dir: string, prefix: string, depth: number) => {
        let Entries: fs.Dirent[] = [];
        try { Entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const Entry of Entries) {
            if (Entry.isDirectory() && depth > 0) Walk(path.join(dir, Entry.name), `${prefix}${Entry.name}/`, depth - 1);
            else if (Entry.isFile() && Entry.name.toLowerCase().endsWith(".log")) Add(`${prefix}${Entry.name}`, path.join(dir, Entry.name));
        }
    };
    Walk(DebugDir, "debug/", 2);
    if (gameDir) {
        let Names: string[] = [];
        try { Names = fs.readdirSync(gameDir); } catch { Names = []; }
        for (const Name of Names) {
            if (/^mysticparadox_dll_port\d+\.log$/i.test(Name)) Add(`game/${Name}`, path.join(gameDir, Name));
        }
    }
    return Out.sort((a, b) => b.modified.localeCompare(a.modified));
}

export const adminServerLogsRouter = Router();

adminServerLogsRouter.get("/admin/v1/server-logs", requireSyncToken, (req: Request, res: Response) => {
    const Days = Number(req.query.days ?? 7);
    const Files = ListServerLogs(Number.isFinite(Days) ? Math.min(Days, 90) : 7);
    res.json({
        serverTime: new Date().toISOString(),
        backendUptimeSeconds: Math.round(process.uptime()),
        files: Files.map(({ name, size, modified }) => ({ name, size, modified })),
    });
});

adminServerLogsRouter.get("/admin/v1/server-logs/file", requireSyncToken, (req: Request, res: Response) => {
    const Name = String(req.query.name ?? "");
    const File = ListServerLogs(90).find((F) => F.name === Name);
    if (!File) {
        res.sendStatus(404);
        return;
    }
    const Tail = Math.min(MAX_TAIL, Math.max(1024, Number(req.query.tail ?? DEFAULT_TAIL) || DEFAULT_TAIL));
    const Size = fs.statSync(File.fullPath).size;
    const Start = Math.max(0, Size - Tail);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Length", Size - Start);
    res.setHeader("X-Log-Size", String(Size));
    res.setHeader("X-Log-Start", String(Start));
    fs.createReadStream(File.fullPath, { start: Start, end: Size - 1 }).pipe(res);
});
