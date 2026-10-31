/*
 * MNG DAUNTLESS (modified version of Mystic Paradox). Licensed under the GNU Affero General Public License v3.0.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [MNG DAUNTLESS 2026-10-31] Trials leaderboards: finished runs are stored and the two leaderboard queries are answered from them.
//
// Read side (documented, EisigesEis/DauntlessEndpointDocumentation Leaderboards/TrialsAll.md and TrialsIndividualSolo.md):
//   POST /trials/leaderboards/all {difficulty, page, page_size, trial_id, target_platforms}
//     -> payload {difficulty, guild: {}, page, page_size, trial_id, world: {group: {difficulty, entries: [team]}, solo: {all:
//        {difficulty, entries: [solo]}}}}; a solo entry {completion_time, objectives_completed, phx_account_id, platform,
//        platform_name, player_role_id, rank, session_id, weapon}; a team entry {completion_time, objectives_completed, rank,
//        session_id, entries: [{phx_account_id, platform, platform_name, player_role_id, weapon}]}.
//   POST /trials/leaderboards/solo/individual {difficulty, trial_id, phx_account_id}
//     -> payload {completion_time, difficulty, objectives_completed, phx_account_id, platform, platform_name, player_role_id,
//        secondary_weapon, session_id, trial_id, weapon} (empty when the player has no run).
//   Lower completion_time is better (the live board's rank 1 had the smallest). Its unit is whatever the game server reports;
//   the board hands it back unchanged.
//
// Write side (NOT documented): the dedicated Trials server reports a finished run (UArenaGameModeComponent::SubmitLeaderboardsInfo
// in the 1.14.7 exe; strings trial_id, completion_time, party_members; settings TrialsLeaderboardsEndpoint and friends). Its exact
// path and body are unknown until a Trial is played here, so ParseTrialRunSubmission reads the field names the read side uses and
// the exe names, and the route logs the first submissions in full ([TrialsMon]) so the parser can be checked against them.

import { randomUUID } from "node:crypto";
import { logger } from "./logger";
import { GetMongoDb } from "./persistence/mongo/client";
import { Collections } from "./persistence/mongo/collections";

export interface TrialRunPlayer {
    userId: string;
    weapon: number;
    secondaryWeapon: number;
    playerRoleId: string;
    platform: string;
}

export interface TrialRun {
    id: string;
    trialId: string;
    difficulty: number;
    completionTime: number;
    objectivesCompleted: number;
    sessionId: string;
    players: TrialRunPlayer[];
    recordedAt: string;
}

const Num = (value: unknown, fallback = 0): number => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
};
const Str = (value: unknown): string => (typeof value === "string" ? value : typeof value === "number" ? String(value) : "");

function ParsePlayer(raw: unknown): TrialRunPlayer | undefined {
    if (typeof raw === "string") return raw ? { userId: raw, weapon: 0, secondaryWeapon: 0, playerRoleId: "", platform: "WIN" } : undefined;
    if (!raw || typeof raw !== "object") return undefined;
    const p = raw as Record<string, unknown>;
    const userId = Str(p.phx_account_id ?? p.account_id ?? p.player_id ?? p.user_id ?? p.id);
    if (!userId) return undefined;
    return {
        userId,
        weapon: Num(p.weapon ?? p.weapon_type),
        secondaryWeapon: Num(p.secondary_weapon),
        playerRoleId: Str(p.player_role_id ?? p.role_id),
        platform: Str(p.platform) || "WIN",
    };
}

/**
 * Pure: a run from a submission body, or undefined when it has no trial id, no usable time or no player. Accepts the players as
 * party_members / entries / players (objects or account ids), or one player inline (phx_account_id at the top level).
 */
export function ParseTrialRunSubmission(body: unknown, now = new Date()): TrialRun | undefined {
    if (!body || typeof body !== "object") return undefined;
    const b = body as Record<string, unknown>;
    const trialId = Str(b.trial_id ?? b.trialId);
    const completionTime = Num(b.completion_time ?? b.completionTime, NaN);
    if (!trialId || !Number.isFinite(completionTime) || completionTime <= 0) return undefined;
    const list = [b.party_members, b.entries, b.players].find(Array.isArray) as unknown[] | undefined;
    const players = (list ?? [b]).map(ParsePlayer).filter((p): p is TrialRunPlayer => p !== undefined);
    // One row per account (a duplicated member would count twice on the board); the first, fullest row is kept.
    const unique = players.filter((p, index) => players.findIndex((q) => q.userId === p.userId) === index);
    if (unique.length === 0) return undefined;
    const sessionId = Str(b.session_id ?? b.sessionId);
    return {
        id: sessionId || randomUUID(),
        trialId,
        difficulty: Num(b.difficulty, 1),
        completionTime,
        objectivesCompleted: Num(b.objectives_completed ?? b.completed_objectives),
        sessionId,
        players: unique,
        recordedAt: now.toISOString(),
    };
}

export type NameLookup = (userId: string) => string;

const PlayerEntry = (p: TrialRunPlayer, name: NameLookup) => ({
    phx_account_id: p.userId,
    platform: p.platform,
    platform_name: name(p.userId),
    player_role_id: p.playerRoleId,
    weapon: p.weapon,
});

/** Pure: the payload of POST /trials/leaderboards/all from the stored runs (best run per player solo, per party in groups). */
export function BuildTrialsLeaderboard(runs: TrialRun[], query: { trialId: string; difficulty: number; page: number; pageSize: number }, name: NameLookup) {
    const forTrial = runs.filter((r) => r.trialId === query.trialId && r.difficulty === query.difficulty);
    const bestBy = (list: TrialRun[], key: (r: TrialRun) => string) => {
        const best = new Map<string, TrialRun>();
        for (const run of list) {
            const k = key(run);
            const current = best.get(k);
            if (!current || run.completionTime < current.completionTime) best.set(k, run);
        }
        return [...best.values()].sort((a, b) => a.completionTime - b.completionTime || a.recordedAt.localeCompare(b.recordedAt));
    };
    const start = Math.max(0, query.page) * Math.max(1, query.pageSize);
    const page = <T,>(list: T[]) => list.slice(start, start + Math.max(1, query.pageSize));

    const solo = bestBy(forTrial.filter((r) => r.players.length === 1), (r) => r.players[0].userId)
        .map((run, index) => ({
            completion_time: run.completionTime,
            objectives_completed: run.objectivesCompleted,
            ...PlayerEntry(run.players[0], name),
            rank: index + 1,
            session_id: run.sessionId,
        }));
    const group = bestBy(forTrial.filter((r) => r.players.length > 1), (r) => r.players.map((p) => p.userId).sort().join("|"))
        .map((run, index) => ({
            completion_time: run.completionTime,
            objectives_completed: run.objectivesCompleted,
            rank: index + 1,
            session_id: run.sessionId,
            entries: run.players.map((p) => PlayerEntry(p, name)),
        }));

    return {
        difficulty: query.difficulty,
        guild: {},
        page: query.page,
        page_size: query.pageSize,
        trial_id: query.trialId,
        world: {
            group: { difficulty: query.difficulty, entries: page(group) },
            solo: { all: { difficulty: query.difficulty, entries: page(solo) } },
        },
    };
}

/** Pure: the payload of POST /trials/leaderboards/solo/individual (the player's best solo run), {} when there is none. */
export function BuildTrialsPersonalBest(runs: TrialRun[], query: { trialId: string; difficulty: number; userId: string }, name: NameLookup) {
    const best = runs
        .filter((r) => r.trialId === query.trialId && r.difficulty === query.difficulty && r.players.length === 1 && r.players[0].userId === query.userId)
        .sort((a, b) => a.completionTime - b.completionTime)[0];
    if (!best) return {};
    const p = best.players[0];
    return {
        completion_time: best.completionTime,
        difficulty: String(best.difficulty),
        objectives_completed: best.objectivesCompleted,
        phx_account_id: p.userId,
        platform: p.platform,
        platform_name: name(p.userId),
        player_role_id: p.playerRoleId,
        secondary_weapon: p.secondaryWeapon,
        session_id: best.sessionId,
        trial_id: best.trialId,
        weapon: p.weapon,
    };
}

// ---- Storage: MongoDB when the backend runs on it, memory otherwise (a SQLite server keeps the board until it restarts). ----

const memoryRuns: TrialRun[] = [];
let warnedMemory = false;

async function Collection() {
    try {
        return (await GetMongoDb()).collection<TrialRun & { _id: string }>(Collections.TrialRuns);
    } catch {
        if (!warnedMemory) {
            warnedMemory = true;
            logger.warn("[TrialsMon] MongoDB unavailable: Trials runs are kept in memory until the backend restarts");
        }
        return undefined;
    }
}

export async function SaveTrialRun(run: TrialRun): Promise<void> {
    const c = await Collection();
    if (!c) {
        if (!memoryRuns.some((r) => r.id === run.id)) memoryRuns.push(run);
        return;
    }
    // A repeated submission of the same session keeps the first record.
    await c.updateOne({ _id: run.id }, { $setOnInsert: { ...run, _id: run.id } }, { upsert: true });
}

export async function LoadTrialRuns(trialId: string, difficulty: number): Promise<TrialRun[]> {
    const c = await Collection();
    if (!c) return memoryRuns.filter((r) => r.trialId === trialId && r.difficulty === difficulty);
    return (await c.find({ trialId, difficulty }).sort({ completionTime: 1 }).limit(5000).toArray()) as TrialRun[];
}
