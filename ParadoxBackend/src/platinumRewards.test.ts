import { test } from "node:test";
import assert from "node:assert/strict";
import {
    BountyClaimPayments, BountyPlatinum, EscalationLevelPayments, FirstHuntPayment, PayPlatinum, PlatinumRewardAmounts,
    MAX_ESCALATION_LEVELS_PER_SAVE
} from "./platinumRewards";
import type { BountyStateRecord } from "./persistence";

const AMOUNTS = PlatinumRewardAmounts({});
const NOW = "2026-11-13T12:00:00.000Z";

function Record(bounties: BountyStateRecord["bounties"]): BountyStateRecord {
    return { userId: "u1", bounties, draftData: {}, updateVersion: 3, createdAt: NOW, updatedAt: NOW };
}

test("amounts: defaults, overrides and off", () => {
    assert.deepEqual(AMOUNTS, { weeklyChallenge: 10, bounty: { bronze: 2, silver: 5, gold: 10 }, firstHunt: 15, escalationLevel: 5 });
    const Custom = PlatinumRewardAmounts({ MNG_PLATINUM_WEEKLY_CHALLENGE: "25", MNG_PLATINUM_BOUNTY: "1,0,50", MNG_PLATINUM_FIRST_HUNT: "x" });
    assert.equal(Custom.weeklyChallenge, 25);
    assert.deepEqual(Custom.bounty, { bronze: 1, silver: 0, gold: 50 });
    assert.equal(Custom.firstHunt, 0, "a bad value turns it off rather than paying something unexpected");
    const Off = PlatinumRewardAmounts({ MNG_PLATINUM_REWARDS: "off" });
    assert.equal(Off.weeklyChallenge + Off.firstHunt + Off.escalationLevel + Off.bounty.gold, 0);
});

test("bounty tiers: weekly challenges and drafted bounties pay, dailies do not", () => {
    assert.equal(BountyPlatinum("weekly", "43_2_5_Challenge_Season_Staggers-season43-1", AMOUNTS), 10);
    assert.equal(BountyPlatinum("base", "Bounty_Gold_KillBehemoths", AMOUNTS), 10);
    assert.equal(BountyPlatinum("base", "Bounty_Silver_StaggerDamageReduce", AMOUNTS), 5);
    assert.equal(BountyPlatinum("base", "Bounty_Bronze_Something", AMOUNTS), 2);
    assert.equal(BountyPlatinum("base", "Something_Else", AMOUNTS), 0);
    assert.equal(BountyPlatinum("daily", "Challenge_Daily_Bronze_DPInterrupts", AMOUNTS), 0);
});

test("only the bounties this save claimed pay, keyed by their drafted instance", () => {
    const Payments = BountyClaimPayments(Record([
        { group: "weekly", bounty: { bounty_id: "W1_Challenge_Season_A", claimed: true, drafted_timestamp: "T1" }, claimedAt: NOW },
        { group: "base", bounty: { bounty_id: "Bounty_Gold_A", claimed: true, drafted_timestamp: "T2" }, claimedAt: NOW },
        { group: "base", bounty: { bounty_id: "Bounty_Silver_Old", claimed: true, drafted_timestamp: "T0" }, claimedAt: "2026-11-01T00:00:00.000Z" },
        { group: "base", bounty: { bounty_id: "Bounty_Bronze_Open", claimed: false, drafted_timestamp: "T3" } },
        { group: "daily", bounty: { bounty_id: "Challenge_Daily_Bronze_X", claimed: true, drafted_timestamp: "T4" }, claimedAt: NOW },
    ]), AMOUNTS);
    assert.deepEqual(Payments.map((P) => [P.key, P.amount]), [
        ["u1:bounty:W1_Challenge_Season_A:T1", 10],
        ["u1:bounty:Bounty_Gold_A:T2", 10],
    ]);
});

test("first hunt: one key per game day (17:00 UTC reset)", () => {
    const Before = FirstHuntPayment("u1", Date.parse("2026-11-13T16:59:00Z"), AMOUNTS)!;
    const After = FirstHuntPayment("u1", Date.parse("2026-11-13T17:01:00Z"), AMOUNTS)!;
    const Later = FirstHuntPayment("u1", Date.parse("2026-11-14T09:00:00Z"), AMOUNTS)!;
    assert.notEqual(Before.key, After.key);
    assert.equal(After.key, Later.key);
    assert.equal(After.amount, 15);
});

test("escalation: each new level once, capped per save", () => {
    assert.deepEqual(EscalationLevelPayments("u1", "S1", 3, 5, AMOUNTS).map((P) => P.key), ["u1:escalation:S1:4", "u1:escalation:S1:5"]);
    assert.equal(EscalationLevelPayments("u1", "S1", 5, 5, AMOUNTS).length, 0);
    assert.equal(EscalationLevelPayments("u1", "S1", 5, 2, AMOUNTS).length, 0);
    assert.equal(EscalationLevelPayments("u1", "S1", 0, 50, AMOUNTS).length, MAX_ESCALATION_LEVELS_PER_SAVE);
});

test("PayPlatinum pays each key once and survives a failing credit", async () => {
    const Taken = new Set<string>();
    const Credits: number[] = [];
    const Deps = {
        store: {
            async take(Key: string) { if (Taken.has(Key)) return false; Taken.add(Key); return true; },
            async release(Key: string) { Taken.delete(Key); }
        },
        async credit(_U: string, _C: string, Amount: number) { if (Amount === 7) throw new Error("wallet down"); Credits.push(Amount); return Credits.reduce((a, b) => a + b, 0); }
    };
    const Payments = [{ key: "a", amount: 10, reason: "x" }, { key: "b", amount: 7, reason: "y" }, { key: "a", amount: 10, reason: "x again" }];
    assert.equal(await PayPlatinum("u1", Payments, Deps), 10);
    assert.equal(await PayPlatinum("u1", Payments, Deps), 0);
    assert.deepEqual(Credits, [10]);
    assert.equal(Taken.has("b"), false, "a failed payment gives its key back for the next try");
});
