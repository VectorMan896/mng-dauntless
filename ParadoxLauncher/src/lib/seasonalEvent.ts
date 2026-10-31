// [MNG DAUNTLESS 2026-10-31] The seasonal event running today, for the launcher art. The same calendar as the server
// (ParadoxBackend/src/seasonalEvents.ts) and the Game.ini script (scripts/mng-seasonal-events.mjs); the player's local date.
import darkHarvest from "../assets/events/dark_harvest.webp";
import ramsgiving from "../assets/events/ramsgiving.webp";
import frostfall from "../assets/events/frostfall.webp";
import saintsBond from "../assets/events/saints_bond.webp";
import springtide from "../assets/events/springtide.webp";

export type SeasonalEvent = { id: string; name: string; art?: string; from: [number, number]; to: [number, number] };

export const SEASONAL_EVENTS: readonly SeasonalEvent[] = [
  { id: "dark_harvest", name: "Dark Harvest", art: darkHarvest, from: [10, 14], to: [11, 7] },
  { id: "ramsgiving", name: "Ramsgiving", art: ramsgiving, from: [11, 16], to: [12, 1] },
  { id: "frostfall", name: "Frostfall", art: frostfall, from: [12, 9], to: [1, 6] },
  { id: "saints_bond", name: "Saint's Bond", art: saintsBond, from: [2, 6], to: [2, 20] },
  { id: "springtide", name: "Springtide", art: springtide, from: [3, 26], to: [4, 23] },
  { id: "midsommar", name: "Midsommar", from: [8, 3], to: [9, 14] },
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
