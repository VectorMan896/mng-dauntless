/*
 * MNG DAUNTLESS (modified version of Mystic Paradox). Licensed under the GNU Affero General Public License v3.0.
 * SPDX-License-Identifier: AGPL-3.0-only
 *
 * [MNG 2026-11-02] Hunt Pass bonus levels pay 5 Bonus Cache Coins free + 20 Elite (the live passes' amounts; the empty Elite
 * tile crashed the game when opened). With Elite free for everyone each bonus level funds 25 coins, claimed as two lines,
 * through the real wallet on a throwaway SQLite realm. A .gamedata test: it reads the real progression config.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import type { TestRealm } from "../persistence/sqlite/testSupport";

process.env.MYSTICPARADOX_HUNTPASS_FREE_PREMIUM = "on";   // before the wallet builds its prestige sources

let Realm: TestRealm | undefined;
const Resolved = require.resolve("../persistence");
const Replacement = Object.create(require("../persistence"));
Object.defineProperty(Replacement, "GetRepositories", { value: () => Realm!.repos, enumerable: true });
Object.defineProperty(Replacement, "GetUnitOfWork", { value: () => Realm!.uow, enumerable: true });
require.cache[Resolved]!.exports = Replacement;

const COIN = "CURRENCY_SEASONAL_COIN";
const USER = "bonus-user";
const CAP_XP = 50 * 100;   // season43: 50 ranks of 100 XP; bonus levels are 100 XP each

test("two banked bonus levels pay 2 x (5 + 20) coins as separate lines, and a third claim is refused", async () => {
    const { OpenTestRealm } = require("../persistence/sqlite/testSupport");
    Realm = OpenTestRealm("huntpass-bonus-levels");
    try {
        const { ApplyCurrencyDeltas, GetBalance } = require("./wallet");
        await Realm!.repos.progressionTracks.increment(USER, "season43", CAP_XP + 2 * 100);
        const Claim = () => Realm!.uow.withTransaction((_repos: any, session: any) =>
            ApplyCurrencyDeltas(USER, [{ catalogId: COIN, quantity: 5 }, { catalogId: COIN, quantity: 20 }], [], session));
        await Claim();
        await Claim();
        assert.equal(await GetBalance(USER, COIN), 50);
        assert.equal((await Realm!.repos.progressionTracks.get(USER, "season43"))?.prestigeClaimed, 50);
        assert.equal((await Realm!.repos.progressionTracks.get(USER, "season43"))?.progress, CAP_XP + 200, "progress is kept");
        await assert.rejects(Claim(), /Insufficient banked prestige/);
        assert.equal(await GetBalance(USER, COIN), 50, "the refused claim paid nothing");
    } finally {
        await Realm!.cleanup();
        Realm = undefined;
    }
});
