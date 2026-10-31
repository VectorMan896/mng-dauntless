/*
 * [MNG DAUNTLESS 2026-10-31] Weekend double drops: on Saturday and Sunday (the server's local time) a dedicated game server's
 * grants of Behemoth materials and Rams count double, and so does the event currency a completed hunt pays
 * (src/seasonalEvents.ts). Announced in the launcher's notices while it runs (controllers/launcherNotices.ts).
 *
 *   MNG_WEEKEND_DOUBLE=off            switch it off (default on)
 *   MNG_WEEKEND_DOUBLE_ITEMS=BREAK_,ORB_,CURRENCY_NOTES
 *                                     catalog id prefixes that are doubled (an exact id works too)
 *
 * Only stacked, uncapped items are doubled: an item the storage policy knows as instanced or capped (an unlock, a cosmetic) is
 * left as it is, and so are kill-count tokens (the activity monitor counts kills from them) and prestige-gated rewards.
 * A transaction retried across the weekend's edge is a different request (its doubled body differs) and is refused as a
 * mismatched replay instead of paying twice.
 */
import { GetInventoryStoragePolicy } from "./inventoryStoragePolicy";
import { IsPrestigeGatedReward } from "./controllers/wallet";

const DEFAULT_ITEMS = "BREAK_,ORB_,CURRENCY_NOTES";

export function WeekendDoubleOn(now: Date = new Date(), env: NodeJS.ProcessEnv = process.env): boolean {
    if (/^(0|off|false|no)$/i.test(env.MNG_WEEKEND_DOUBLE?.trim() ?? "")) return false;
    const Day = now.getDay();
    return Day === 0 || Day === 6;
}

function Prefixes(env: NodeJS.ProcessEnv): string[] {
    return (env.MNG_WEEKEND_DOUBLE_ITEMS?.trim() || DEFAULT_ITEMS).split(",").map((p) => p.trim()).filter(Boolean);
}

export function IsWeekendDoubled(catalogId: unknown, env: NodeJS.ProcessEnv = process.env): boolean {
    if (typeof catalogId !== "string" || catalogId.startsWith("TOKEN_KILL_COUNT")) return false;
    if (!Prefixes(env).some((p) => catalogId === p || (p.endsWith("_") && catalogId.startsWith(p)))) return false;
    if (IsPrestigeGatedReward(catalogId)) return false;
    let Policy: ReturnType<typeof GetInventoryStoragePolicy>;
    try { Policy = GetInventoryStoragePolicy(catalogId); } catch { Policy = undefined; }
    return Policy == undefined || (Policy.storage === "stacked" && !(Policy.maxQuantity > 0));
}

/** The stacked grants with the weekend's doubled quantities (a new array; the input is not changed), and what was doubled. */
export function WithWeekendDrops(items: unknown, now: Date = new Date(), env: NodeJS.ProcessEnv = process.env): { items: unknown; doubled: string[] } {
    if (!WeekendDoubleOn(now, env) || !Array.isArray(items)) return { items, doubled: [] };
    const Doubled: string[] = [];
    const Out = items.map((Item: any) => {
        const Quantity = Item?.quantity;
        if (typeof Quantity !== "number" || !Number.isSafeInteger(Quantity) || Quantity <= 0 || !IsWeekendDoubled(Item?.catalogId, env)) return Item;
        Doubled.push(`${Item.catalogId} x${Quantity}->${Quantity * 2}`);
        return { ...Item, quantity: Quantity * 2 };
    });
    return { items: Out, doubled: Doubled };
}

/** The launcher notice while the weekend bonus runs (until Sunday's end, server local time). */
export function WeekendNotice(now: Date = new Date(), env: NodeJS.ProcessEnv = process.env):
    { announcement: { id: string; text: string; tone: "info"; showUntil: string }; tag: { id: string; text: string; tone: "success"; showUntil: string } } | undefined {
    if (!WeekendDoubleOn(now, env)) return undefined;
    const Monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (now.getDay() === 6 ? 2 : 1));
    const Key = `mng-weekend-${Monday.toISOString().slice(0, 10)}`;
    return {
        announcement: { id: Key, text: "Weekend double drops! Behemoth parts, Rams and event coins from hunts count double until Sunday midnight.", tone: "info", showUntil: Monday.toISOString() },
        tag: { id: `${Key}-tag`, text: "DOUBLE DROPS", tone: "success", showUntil: Monday.toISOString() },
    };
}
