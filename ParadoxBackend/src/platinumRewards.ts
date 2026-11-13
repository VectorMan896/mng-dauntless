/*
 * [MNG DAUNTLESS 2026-11-13] Platinum you earn by playing. The store does not sell Platinum on MNG, so the server pays it for:
 *
 *   weekly season challenge claimed   MNG_PLATINUM_WEEKLY_CHALLENGE   default 10 per challenge
 *   bounty claimed (drafted)          MNG_PLATINUM_BOUNTY             default "2,5,10" (bronze, silver, gold)
 *   first completed hunt of the day   MNG_PLATINUM_FIRST_HUNT         default 15 (game day: from 17:00 UTC, as the dailies)
 *   Escalation level reached          MNG_PLATINUM_ESCALATION_LEVEL   default 5 per new level
 *
 * 0 turns one off; MNG_PLATINUM_REWARDS=off turns them all off. Each payment has a key (the account and what it pays for), and
 * the key is stored first (collection mngRewardClaims, _id = key), so a repeated save, a retried request or two game servers
 * reporting the same claim pay once. Only claims that happen after this update pay: nothing is paid for old ones.
 * Paid as CURRENCY_PLATINUM_UNIV, the bucket the Hunt Pass already pays Platinum into (platinumWallet.ts).
 * Never throws: a failed payment is logged ([Platinum]) and the save that caused it goes on.
 */
import { logger } from "./logger";
import { AddCurrency } from "./controllers/wallet";
import { GameDailyWindowKey } from "./bountyState";
import { GetMongoDb } from "./persistence/mongo/client";
import { Collections } from "./persistence/mongo/collections";
import type { BountyStateRecord } from "./persistence";

export const PLATINUM_REWARD_CURRENCY = "CURRENCY_PLATINUM_UNIV";
/** The most Escalation levels one save can pay for (a real save moves one or two). */
export const MAX_ESCALATION_LEVELS_PER_SAVE = 10;

export interface PlatinumRewardAmounts {
    weeklyChallenge: number;
    bounty: { bronze: number; silver: number; gold: number };
    firstHunt: number;
    escalationLevel: number;
}

function Amount(raw: string | undefined, fallback: number): number {
    const Text = raw?.trim();
    const Value = Text === undefined || Text === "" ? fallback : Number(Text);
    return Number.isSafeInteger(Value) && Value > 0 && Value <= 100000 ? Value : 0;
}

export function PlatinumRewardAmounts(env: NodeJS.ProcessEnv = process.env): PlatinumRewardAmounts {
    if (/^(0|off|false|no)$/i.test(env.MNG_PLATINUM_REWARDS?.trim() ?? "")) {
        return { weeklyChallenge: 0, bounty: { bronze: 0, silver: 0, gold: 0 }, firstHunt: 0, escalationLevel: 0 };
    }
    const Tiers = (env.MNG_PLATINUM_BOUNTY?.trim() || "2,5,10").split(",");
    return {
        weeklyChallenge: Amount(env.MNG_PLATINUM_WEEKLY_CHALLENGE, 10),
        bounty: { bronze: Amount(Tiers[0], 2), silver: Amount(Tiers[1], 5), gold: Amount(Tiers[2], 10) },
        firstHunt: Amount(env.MNG_PLATINUM_FIRST_HUNT, 15),
        escalationLevel: Amount(env.MNG_PLATINUM_ESCALATION_LEVEL, 5),
    };
}

/** What one claimed bounty pays, or 0: a weekly season challenge, or a drafted bronze / silver / gold bounty. Dailies pay Cache Coins. */
export function BountyPlatinum(group: string, bountyId: string, amounts: PlatinumRewardAmounts): number {
    if (group === "weekly") return amounts.weeklyChallenge;
    if (group !== "base") return 0;
    if (/^Bounty_Gold_/i.test(bountyId)) return amounts.bounty.gold;
    if (/^Bounty_Silver_/i.test(bountyId)) return amounts.bounty.silver;
    if (/^Bounty_Bronze_/i.test(bountyId)) return amounts.bounty.bronze;
    return 0;
}

export interface PlatinumPayment { key: string; amount: number; reason: string }

/** The payments for the bounties this save claimed (record.updatedAt is the save's time: see bountyState.ts NewlyClaimedBountyIds). */
export function BountyClaimPayments(record: BountyStateRecord, amounts: PlatinumRewardAmounts = PlatinumRewardAmounts()): PlatinumPayment[] {
    const Payments: PlatinumPayment[] = [];
    for (const Entry of record.bounties) {
        if (Entry.bounty.claimed !== true || Entry.claimedAt === undefined || Entry.claimedAt !== record.updatedAt) continue;
        const Id = String(Entry.bounty.bounty_id);
        const Group = Entry.group === "unassigned" ? (Id.includes("Challenge_Season") ? "weekly" : Id.startsWith("Challenge_Daily_") ? "daily" : "base") : Entry.group;
        const Pay = BountyPlatinum(Group, Id, amounts);
        if (Pay <= 0) continue;
        // One drafted instance pays once: the id and its draft time (a re-draft of the same bounty is a new instance).
        Payments.push({
            key: `${record.userId}:bounty:${Id}:${String(Entry.bounty.drafted_timestamp ?? "")}`,
            amount: Pay,
            reason: Group === "weekly" ? `weekly challenge ${Id}` : `bounty ${Id}`,
        });
    }
    return Payments;
}

export function FirstHuntPayment(userId: string, nowMs: number = Date.now(), amounts: PlatinumRewardAmounts = PlatinumRewardAmounts()): PlatinumPayment | undefined {
    if (amounts.firstHunt <= 0) return undefined;
    const Day = GameDailyWindowKey(nowMs);
    return { key: `${userId}:firsthunt:${Day}`, amount: amounts.firstHunt, reason: `first hunt of the day (${Day.slice(0, 10)})` };
}

export function EscalationLevelPayments(userId: string, seasonId: string, before: number, after: number,
    amounts: PlatinumRewardAmounts = PlatinumRewardAmounts()): PlatinumPayment[] {
    if (amounts.escalationLevel <= 0 || !Number.isSafeInteger(before) || !Number.isSafeInteger(after) || after <= before) return [];
    const Payments: PlatinumPayment[] = [];
    for (let Level = Math.max(before, 0) + 1; Level <= after && Payments.length < MAX_ESCALATION_LEVELS_PER_SAVE; Level++) {
        Payments.push({ key: `${userId}:escalation:${seasonId}:${Level}`, amount: amounts.escalationLevel, reason: `Escalation ${seasonId} level ${Level}` });
    }
    return Payments;
}

// ---- The once-only store: MongoDB, or memory when the backend runs without it. ----

const memoryKeys = new Set<string>();

export interface RewardClaimStore {
    /** True when the key was new (this caller pays), false when it was already taken. */
    take(key: string, userId: string, amount: number, reason: string): Promise<boolean>;
    /** Gives a key back after its payment failed, so the next save or hunt can pay it. */
    release(key: string): Promise<void>;
}

const MongoClaimStore: RewardClaimStore = {
    async take(key, userId, amount, reason) {
        let Db;
        try { Db = await GetMongoDb(); } catch { Db = undefined; }
        if (!Db) {
            if (memoryKeys.has(key)) return false;
            memoryKeys.add(key);
            return true;
        }
        const Result = await Db.collection<{ _id: string }>(Collections.MngRewardClaims).updateOne(
            { _id: key },
            { $setOnInsert: { _id: key, userId, currency: PLATINUM_REWARD_CURRENCY, amount, reason, at: new Date().toISOString() } },
            { upsert: true });
        return Result.upsertedCount === 1;
    },
    async release(key) {
        memoryKeys.delete(key);
        try { await (await GetMongoDb()).collection<{ _id: string }>(Collections.MngRewardClaims).deleteOne({ _id: key }); } catch { /* memory store */ }
    }
};

export interface PlatinumPayDeps {
    store: RewardClaimStore;
    credit(userId: string, catalogId: string, amount: number): Promise<number>;
}

const DefaultDeps: PlatinumPayDeps = { store: MongoClaimStore, credit: AddCurrency };

/** Pays each payment once. Never throws. Returns what was paid now. */
export async function PayPlatinum(userId: string, payments: readonly PlatinumPayment[], deps: PlatinumPayDeps = DefaultDeps): Promise<number> {
    let Paid = 0;
    for (const Payment of payments) {
        let Taken = false;
        try {
            if (Payment.amount <= 0 || !(Taken = await deps.store.take(Payment.key, userId, Payment.amount, Payment.reason))) continue;
            const Balance = await deps.credit(userId, PLATINUM_REWARD_CURRENCY, Payment.amount);
            Paid += Payment.amount;
            logger.info(`[Platinum] ${userId} +${Payment.amount} for ${Payment.reason} -> ${Balance}`);
        } catch (Err) {
            logger.warn(`[Platinum] paying ${userId} ${Payment.amount} for ${Payment.reason} failed: ${String(Err)}`);
            if (Taken) await deps.store.release(Payment.key).catch(() => undefined);
        }
    }
    return Paid;
}

/** The bounty saves (dedicated and host): pays the bounties this save claimed. */
export function PayBountyClaimPlatinum(record: BountyStateRecord): Promise<number> {
    return PayPlatinum(record.userId, BountyClaimPayments(record));
}

/** A completed dedicated hunt (activity/activityMonitor.ts RecordDedicatedHuntEnds): the first one of the game day pays. */
export function PayFirstHuntPlatinum(userId: string): Promise<number> {
    const Payment = FirstHuntPayment(userId);
    return Payment ? PayPlatinum(userId, [Payment]) : Promise.resolve(0);
}

/** An Escalation save that raised the season level. */
export function PayEscalationLevelPlatinum(userId: string, seasonId: string, before: number, after: number): Promise<number> {
    return PayPlatinum(userId, EscalationLevelPayments(userId, seasonId, before, after));
}
