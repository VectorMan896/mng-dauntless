// [MNG DAUNTLESS 2026-10-31] The seasonal event running today, for the launcher art. The same calendar as the server
// (ParadoxBackend/src/seasonalEvents.ts) and the Game.ini script (scripts/mng-seasonal-events.mjs); the player's local date.
import darkHarvest from "../assets/events/dark_harvest.webp";
import ramsgiving from "../assets/events/ramsgiving.webp";
import frostfall from "../assets/events/frostfall.webp";
import saintsBond from "../assets/events/saints_bond.webp";
import springtide from "../assets/events/springtide.webp";

export type SeasonalEvent = {
  id: string;
  name: string;
  art?: string;
  from: [number, number];
  to: [number, number];
  /** One line for the event calendar (MNG Server page): what the event brings. */
  brings: string;
};

export const SEASONAL_EVENTS: readonly SeasonalEvent[] = [
  { id: "dark_harvest", name: "Dark Harvest", art: darkHarvest, from: [10, 14], to: [11, 7], brings: "Halloween Ramsgate, Harvest Coins from every hunt, Honest Ozz's Unseen and Bloodshot shop." },
  { id: "ramsgiving", name: "Ramsgiving", art: ramsgiving, from: [11, 16], to: [12, 1], brings: "Golden Rams from every hunt, Benson cosmetics and the Ramsgiving Crown at Honest Ozz." },
  { id: "frostfall", name: "Frostfall", art: frostfall, from: [12, 9], to: [1, 6], brings: "Winter Ramsgate, Frostfall Coins from every hunt, sweaters, the Frostfall weapons and gifts." },
  { id: "saints_bond", name: "Saint's Bond", art: saintsBond, from: [2, 6], to: [2, 20], brings: "Friendship Coins from every hunt, the romantic weapon and armour sets at Honest Ozz." },
  { id: "springtide", name: "Springtide", art: springtide, from: [3, 26], to: [4, 23], brings: "Carrot Chips from every hunt, Puffle cosmetics and spring curiosities at Honest Ozz." },
  { id: "midsommar", name: "Midsommar", from: [8, 3], to: [9, 14], brings: "The Ritualist armour, Caladag and the other Midsommar weapons at Honest Ozz, for Rams." },
];

function inSeason(event: SeasonalEvent, date: Date): boolean {
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  const from = event.from[0] * 100 + event.from[1];
  const to = event.to[0] * 100 + event.to[1];
  return from <= to ? md >= from && md <= to : md >= from || md <= to;
}

/** The event running on `date` (today by default), or undefined. */
export function activeSeasonalEvent(date: Date = new Date()): SeasonalEvent | undefined {
  return SEASONAL_EVENTS.find((event) => inSeason(event, date));
}

export type CalendarEntry = { event: SeasonalEvent; start: Date; end: Date; running: boolean; daysUntil: number };

/**
 * [MNG DAUNTLESS 2026-10-31] The event calendar: every event with its next (or current) dates, the running one first, then by
 * start. `end` is the last day. Dates are the player's local calendar days.
 */
export function eventCalendar(today: Date = new Date()): CalendarEntry[] {
  const day = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const entries = SEASONAL_EVENTS.map((event) => {
    const wraps = event.from[0] * 100 + event.from[1] > event.to[0] * 100 + event.to[1];
    const running = inSeason(event, day);
    let startYear = day.getFullYear();
    // A running event that wrapped into this year started last year; one that already ended this year starts next year.
    if (running && wraps && day.getMonth() + 1 < event.from[0]) startYear -= 1;
    let start = new Date(startYear, event.from[0] - 1, event.from[1]);
    let end = new Date(startYear + (wraps ? 1 : 0), event.to[0] - 1, event.to[1]);
    if (!running && end < day) {
      start = new Date(startYear + 1, event.from[0] - 1, event.from[1]);
      end = new Date(startYear + 1 + (wraps ? 1 : 0), event.to[0] - 1, event.to[1]);
    }
    const daysUntil = running ? 0 : Math.round((start.getTime() - day.getTime()) / 86_400_000);
    return { event, start, end, running, daysUntil };
  });
  return entries.sort((a, b) => (a.running === b.running ? a.start.getTime() - b.start.getTime() : a.running ? -1 : 1));
}
