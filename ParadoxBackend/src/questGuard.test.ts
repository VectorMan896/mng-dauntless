/*
 * MNG DAUNTLESS (modified version of Mystic Paradox). Licensed under the GNU Affero General Public License v3.0.
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import test from "node:test";
import assert from "node:assert/strict";
import { GuardQuestSeries } from "./questGuard";

const Series = (o: Record<string, unknown>) => JSON.stringify({ ID: "CR20_PJM_Quests", ...o });
const Q = (Status: number, extra: Record<string, unknown> = {}) => ({ Status, ...extra });

test("a Redeemed quest cannot go back to Redeemable or Accepted (no second turn-in)", () => {
    const existing = { SERIE_cr20_pjm_quests: Series({ A: Q(3), B: Q(1) }) };
    const incoming: Record<string, unknown> = { SERIE_cr20_pjm_quests: Series({ A: Q(2), B: Q(2) }) };
    const r = GuardQuestSeries(incoming, existing);
    const s = JSON.parse(incoming.SERIE_cr20_pjm_quests as string);
    assert.equal(s.A.Status, 3);
    assert.equal(s.B.Status, 2); // forward progress goes through
    assert.equal(r.kept.length, 1);
});

test("a save that leaves a series out keeps the saved one instead of starting it over", () => {
    const existing = { SERIE_cr20_pjm_quests: Series({ A: Q(3) }), Other: 1 };
    const incoming: Record<string, unknown> = { Other: 2 };
    GuardQuestSeries(incoming, existing);
    assert.equal(incoming.SERIE_cr20_pjm_quests, existing.SERIE_cr20_pjm_quests);
    assert.equal(incoming.Other, 2);
});

test("a quest left out of a series is kept; a new quest in the save is added", () => {
    const existing = { SERIE_x: Series({ A: Q(3), B: Q(1, { O1: { CurrentAmount: 5 } }) }) };
    const incoming: Record<string, unknown> = { SERIE_x: Series({ C: Q(4) }) };
    GuardQuestSeries(incoming, existing);
    const s = JSON.parse(incoming.SERIE_x as string);
    assert.deepEqual(Object.keys(s).sort(), ["A", "B", "C", "ID"]);
    assert.equal(s.B.O1.CurrentAmount, 5);
});

test("a normal forward save is left exactly as sent", () => {
    const existing = { SERIE_x: Series({ A: Q(1) }) };
    const sent = Series({ A: Q(3), B: Q(1) });
    const incoming: Record<string, unknown> = { SERIE_x: sent };
    assert.equal(GuardQuestSeries(incoming, existing).kept.length, 0);
    assert.equal(incoming.SERIE_x, sent);
});

test("a Redeemed series stays Redeemed; unreadable blobs are left alone", () => {
    const existing = { SERIE_x: JSON.stringify({ ID: "X", Status: 3 }), SERIE_bad: "{not json" };
    const incoming: Record<string, unknown> = { SERIE_x: JSON.stringify({ ID: "X", Status: 1 }), SERIE_bad: "also bad" };
    GuardQuestSeries(incoming, existing);
    assert.equal(JSON.parse(incoming.SERIE_x as string).Status, 3);
    assert.equal(incoming.SERIE_bad, "also bad");
});
