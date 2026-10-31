/*
 * [MNG DAUNTLESS 2026-10-31] The server's side of the seasonal Ramsgate events (scripts/mng-seasonal-events.mjs turns on the
 * Ramsgate dressing and the event stall in Game.ini; this decides which event is running for the backend and pays its currency).
 *
 * The calendar is the same as the script's. MNG_SEASONAL_EVENT overrides it: "off", or one event id (dark_harvest, frostfall,
 * saints_bond, springtide). MNG_EVENT_CURRENCY_PER_HUNT (default 100, 0 = none) is the event currency a player gets for each
 * completed dedicated hunt (activity/activityMonitor.ts RecordDedicatedHuntEnds: a hunt counts as completed when it had a kill,
 * and each hunt is closed, and paid, once). The currency is spent at the event merchant (game-data/event_store.json).
 */
import { logger } from "./logger";
import { AddCurrency } from "./controllers/wallet";

// currency: what each completed hunt pays (none for Midsommar: its shop takes Rams).
export type SeasonalEvent = { id: string; name: string; currency?: string; coins?: string; from: [number, number]; to: [number, number] };

export const SEASONAL_EVENTS: readonly SeasonalEvent[] = [
    { id: "dark_harvest", name: "Dark Harvest", currency: "CURRENCY_EVENT_DARKHARVEST", coins: "Harvest Coins", from: [10, 14], to: [11, 7] },
    { id: "ramsgiving", name: "Ramsgiving", currency: "CURRENCY_EVENT_RAMSGIVING", coins: "Golden Rams", from: [11, 16], to: [12, 1] },
    { id: "frostfall", name: "Frostfall", currency: "CURRENCY_EVENT_FROSTFALL", coins: "Frostfall Coins", from: [12, 9], to: [1, 6] },
    { id: "saints_bond", name: "Saint's Bond", currency: "CURRENCY_EVENT_SAINTSBOND", coins: "Friendship Coins", from: [2, 6], to: [2, 20] },
    { id: "springtide", name: "Springtide", currency: "CURRENCY_EVENT_SPRINGTIDE", coins: "Carrot Chips", from: [3, 26], to: [4, 23] },
    // Midsommar Madness ran 3 Aug - 14 Sep 2023 (a cosmetic hunt pass); MNG sells its items at Ozz for Rams.
    { id: "midsommar", name: "Midsommar", from: [8, 3], to: [9, 14] },
];

function InSeason(event: SeasonalEvent, date: Date): boolean {
    const Md = (date.getMonth() + 1) * 100 + date.getDate();
    const From = event.from[0] * 100 + event.from[1];
    const To = event.to[0] * 100 + event.to[1];
    return From <= To ? Md >= From && Md <= To : Md >= From || Md <= To;
}

/** The running event, or undefined. */
export function ActiveSeasonalEvent(now: Date = new Date(), env: NodeJS.ProcessEnv = process.env): SeasonalEvent | undefined {
    const Forced = env.MNG_SEASONAL_EVENT?.trim().toLowerCase();
    if (Forced === "off" || Forced === "none") return undefined;
    if (Forced && Forced !== "auto") return SEASONAL_EVENTS.find((Event) => Event.id === Forced);
    return SEASONAL_EVENTS.find((Event) => InSeason(Event, now));
}

export function EventCurrencyPerHunt(env: NodeJS.ProcessEnv = process.env): number {
    const Raw = env.MNG_EVENT_CURRENCY_PER_HUNT?.trim();
    const Value = Raw === undefined || Raw === "" ? 100 : Number(Raw);
    return Number.isSafeInteger(Value) && Value > 0 ? Value : 0;
}

/** Pays the running event's currency for one completed hunt. Never throws: a failed payment is logged and the hunt end goes on. */
export async function PaySeasonalEventHunt(userId: string, huntRef: string): Promise<void> {
    const Event = ActiveSeasonalEvent();
    const Amount = EventCurrencyPerHunt();
    if (!Event?.currency || Amount <= 0) return;
    try {
        const Balance = await AddCurrency(userId, Event.currency, Amount);
        logger.info(`[SeasonalEvent] ${Event.name}: ${userId} +${Amount} ${Event.currency} for hunt ${huntRef} -> ${Balance}`);
    } catch (Err) {
        logger.warn(`[SeasonalEvent] ${Event.name}: paying ${userId} for hunt ${huntRef} failed: ${String(Err)}`);
    }
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * [MNG DAUNTLESS 2026-10-31] The running event as a launcher notice (controllers/launcherNotices.ts adds it to GET /launcher/v1/notices):
 * an announcement until the event's last day ends (server local midnight) and a tag with the event's name. undefined outside events.
 */
export function SeasonalEventNotice(now: Date = new Date()): { announcement: { id: string; text: string; tone: "info"; showUntil: string }; tag: { id: string; text: string; tone: "success"; showUntil: string } } | undefined {
    const Event = ActiveSeasonalEvent(now);
    if (!Event) return undefined;
    const Wraps = Event.from[0] * 100 + Event.from[1] > Event.to[0] * 100 + Event.to[1];
    const EndYear = Wraps && now.getMonth() + 1 >= Event.from[0] ? now.getFullYear() + 1 : now.getFullYear();
    const Until = new Date(EndYear, Event.to[0] - 1, Event.to[1] + 1).toISOString();
    const Last = `${Event.to[1]} ${MONTHS[Event.to[0] - 1]}`;
    const Pay = Event.coins && EventCurrencyPerHunt() > 0 ? ` Every completed hunt pays ${EventCurrencyPerHunt()} ${Event.coins}.` : "";
    const Spend = Event.coins ? `spend them at Honest Ozz's stall in Ramsgate` : `Honest Ozz sells its cosmetics for Rams in Ramsgate`;
    const Text = Event.coins ? `${Event.name} is on until ${Last}!${Pay} ${Spend[0].toUpperCase()}${Spend.slice(1)}.` : `${Event.name} is on until ${Last}! ${Spend}.`;
    const Key = `mng-season-${Event.id}-${EndYear}`;
    return {
        announcement: { id: Key, text: Text.slice(0, 280), tone: "info", showUntil: Until },
        tag: { id: `${Key}-tag`, text: Event.name.toUpperCase().slice(0, 24), tone: "success", showUntil: Until },
    };
}
