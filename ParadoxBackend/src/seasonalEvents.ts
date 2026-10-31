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
import { WeekendDoubleOn } from "./weekendBonus";

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
    // [31 Oct] Weekend double drops (src/weekendBonus.ts) double the event currency too.
    const Amount = EventCurrencyPerHunt() * (WeekendDoubleOn() ? 2 : 1);
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

// [MNG DAUNTLESS 2026-10-31] The running event for the client's own schedule (GET /game_tuning/seasonal_event_schedule, an
// FServiceSchedule). Experimental: the ids the client may look for are not known, so the item list names the event's row and
// EventID in the client's seasonal_event_ui_table (runtime 0.1.7 [SeasonalProbe]) and its event hunts (matchmaker ids, the
// way the client's other schedules name hunts). MNG_EVENT_SCHEDULE=off serves the empty schedule again.
const CLIENT_EVENT_IDS: Record<string, string[]> = {
    dark_harvest: ["DarkHarvest", "EVENT_DARKHARVEST", "MatchmakerHunt_Event_Dark_Harvest_01", "MatchmakerHunt_Event_Dark_Harvest_Hard_01"],
    ramsgiving: ["Ramsgiving", "EVENT_RAMSGIVING", "MatchmakerHunt_Event_Ramsgiving_01", "MatchmakerHunt_Event_Ramsgiving_02"],
    frostfall: ["Frostfall", "EVENT_FROSTFALL"],
    saints_bond: ["SaintsBond", "Event_Saints_Bond_Evergreen"],
    springtide: ["SpringEvent", "EVENT_SPRINGTIDE", "CR19_MatchmakerHunt_Event_Spring_2020"],
};

/** The running event's window: its first day 00:00 to the day after its last (local time). */
export function SeasonalEventWindow(event: SeasonalEvent, now: Date = new Date()): { start: Date; end: Date } {
    const Wraps = event.from[0] * 100 + event.from[1] > event.to[0] * 100 + event.to[1];
    const StartYear = Wraps && now.getMonth() + 1 < event.from[0] ? now.getFullYear() - 1 : now.getFullYear();
    return {
        start: new Date(StartYear, event.from[0] - 1, event.from[1]),
        end: new Date(StartYear + (Wraps ? 1 : 0), event.to[0] - 1, event.to[1] + 1),
    };
}

export function SeasonalEventSchedule(now: Date = new Date(), env: NodeJS.ProcessEnv = process.env): unknown[] {
    if (/^(0|off|false|no)$/i.test(env.MNG_EVENT_SCHEDULE?.trim() ?? "")) return [];
    const Event = ActiveSeasonalEvent(now, env);
    const Ids = Event ? CLIENT_EVENT_IDS[Event.id] : undefined;
    if (!Event || !Ids) return [];
    const { start, end } = SeasonalEventWindow(Event, now);
    return [{
        Name: Event.name,
        StartTime: start.toISOString(),
        EndTime: end.toISOString(),
        IsRepeatable: false,
        RepeatableDetails: { EachDay: false, EachWeek: false },
        bShouldQueueTheSheduleItems: false,
        ScheduledItems: Ids.map((ID) => ({ ID, MaxCompletionPerInterval: -1 })),
        ItemsToBeLeftOutOfTheRotation: [],
    }];
}
