// [MNG DAUNTLESS 2026-11-10] The server-log listing (routes/adminServerLogs.ts): what may be served, and nothing else.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GameLogDir, ListServerLogs } from "./adminServerLogs";

function Tree(): { root: string; game: string } {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "mng-serverlogs-"));
    const game = path.join(root, "Game", "Win64");
    for (const dir of ["debug/metagame", "debug/gameservers", "debug/deep/er/still", "ParadoxDirector"]) fs.mkdirSync(path.join(root, dir), { recursive: true });
    fs.mkdirSync(game, { recursive: true });
    fs.writeFileSync(path.join(root, "debug/metagame/metagame.log"), "backend");
    fs.writeFileSync(path.join(root, "debug/gameservers/port8790_ramsgate.log"), "hub");
    fs.writeFileSync(path.join(root, "debug/deep/er/still/too-deep.log"), "x");
    fs.writeFileSync(path.join(root, "debug/metagame/notes.txt"), "not a log");
    fs.writeFileSync(path.join(game, "mysticparadox_dll_port8790.log"), "runtime");
    fs.writeFileSync(path.join(game, "Dauntless-Win64-Shipping.exe"), "exe");
    fs.writeFileSync(path.join(game, "other.log"), "not a runtime log");
    fs.writeFileSync(path.join(root, "ParadoxDirector/.env"), `PORT=3001\r\nGAMESERVER_BINARY_PATH=${path.join(game, "Dauntless-Win64-Shipping.exe")}\r\n`);
    return { root, game };
}

test("the game folder comes from the Director's GAMESERVER_BINARY_PATH, or MNG_GAME_LOG_DIR", () => {
    const { root, game } = Tree();
    assert.equal(GameLogDir(root, {}), game);
    assert.equal(GameLogDir(root, { MNG_GAME_LOG_DIR: "D:\\Elsewhere" }), "D:\\Elsewhere");
    assert.equal(GameLogDir(path.join(root, "missing"), {}), undefined);
});

test("only debug\\*.log (two levels) and the runtime's port logs are listed", () => {
    const { root, game } = Tree();
    const names = ListServerLogs(7, root, game).map((f) => f.name).sort();
    assert.deepEqual(names, ["debug/gameservers/port8790_ramsgate.log", "debug/metagame/metagame.log", "game/mysticparadox_dll_port8790.log"]);
});

test("files older than the window are left out", () => {
    const { root, game } = Tree();
    const old = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
    fs.utimesSync(path.join(root, "debug/metagame/metagame.log"), old, old);
    assert.equal(ListServerLogs(7, root, game).some((f) => f.name === "debug/metagame/metagame.log"), false);
    assert.equal(ListServerLogs(30, root, game).some((f) => f.name === "debug/metagame/metagame.log"), true);
});
