// [MNG DAUNTLESS 2026-10-31] Trials leaderboards (src/trialRuns.ts): parsing a reported run and building the two boards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { BuildTrialsLeaderboard, BuildTrialsPersonalBest, ParseTrialRunSubmission, type TrialRun } from "./trialRuns";

const names = (id: string) => ({ a: "Alpha", b: "Bravo", c: "Charlie" } as Record<string, string>)[id] ?? "Slayer";
const run = (id: string, players: string[], time: number, difficulty = 1, trialId = "T1"): TrialRun => ({
    id, trialId, difficulty, completionTime: time, objectivesCompleted: 3, sessionId: id,
    players: players.map((userId) => ({ userId, weapon: 1, secondaryWeapon: 0, playerRoleId: "PR_FRANK", platform: "WIN" })),
    recordedAt: `2026-10-31T00:00:0${id.length}Z`,
});

test("a submission with party members becomes a run; one row per account", () => {
    const parsed = ParseTrialRunSubmission({
        trial_id: "Arena_X", difficulty: 2, completion_time: 14948, session_id: "s1", objectives_completed: 3,
        party_members: [{ phx_account_id: "a", weapon: 5, player_role_id: "PR_BASTION" }, { phx_account_id: "a" }, "b"],
    });
    assert.ok(parsed);
    assert.equal(parsed.trialId, "Arena_X");
    assert.equal(parsed.difficulty, 2);
    assert.equal(parsed.completionTime, 14948);
    assert.deepEqual(parsed.players.map((p) => p.userId), ["a", "b"]);
    assert.equal(parsed.players[0].weapon, 5);
});

test("a single player inline is a solo run; no trial id or no time is refused", () => {
    assert.equal(ParseTrialRunSubmission({ trial_id: "T", completion_time: 100, phx_account_id: "a" })?.players.length, 1);
    assert.equal(ParseTrialRunSubmission({ completion_time: 100, phx_account_id: "a" }), undefined);
    assert.equal(ParseTrialRunSubmission({ trial_id: "T", completion_time: 0, phx_account_id: "a" }), undefined);
    assert.equal(ParseTrialRunSubmission({ trial_id: "T", completion_time: 100 }), undefined);
});

test("the board ranks each player's best solo time and each party's best group time, fastest first", () => {
    const runs = [run("1", ["a"], 300), run("22", ["a"], 200), run("333", ["b"], 250), run("4444", ["a", "b"], 500), run("55555", ["b", "a"], 400),
        run("666666", ["c"], 100, 2), run("7777777", ["c"], 50, 1, "OTHER")];
    const board = BuildTrialsLeaderboard(runs, { trialId: "T1", difficulty: 1, page: 0, pageSize: 100 }, names);
    const solo = board.world.solo.all.entries;
    assert.deepEqual(solo.map((e) => [e.platform_name, e.completion_time, e.rank]), [["Alpha", 200, 1], ["Bravo", 250, 2]]);
    assert.equal(board.world.group.entries.length, 1);
    assert.equal(board.world.group.entries[0].completion_time, 400);
    assert.deepEqual(board.world.group.entries[0].entries.map((e) => e.platform_name), ["Bravo", "Alpha"]);
});

test("the personal best is the player's fastest solo run, {} without one", () => {
    const runs = [run("1", ["a"], 300), run("22", ["a"], 200), run("333", ["a", "b"], 100)];
    assert.equal((BuildTrialsPersonalBest(runs, { trialId: "T1", difficulty: 1, userId: "a" }, names) as { completion_time: number }).completion_time, 200);
    assert.deepEqual(BuildTrialsPersonalBest(runs, { trialId: "T1", difficulty: 1, userId: "b" }, names), {});
});
