// [MNG DAUNTLESS 2026-10-31] The event calendar (MNG Server page): the year's seasonal events with their dates, what each one
// brings, and which one is running or comes next. From the launcher's calendar (lib/seasonalEvent.ts), the same dates as the
// server and the runtime.
import type { CSSProperties } from "react";
import { ClockIcon, SparkIcon } from "./icons";
import { eventCalendar } from "../lib/seasonalEvent";

const DAY_MONTH = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short" });

function when(daysUntil: number): string {
  if (daysUntil <= 0) return "Today";
  if (daysUntil === 1) return "Tomorrow";
  if (daysUntil < 60) return `In ${daysUntil} days`;
  return `In ${Math.round(daysUntil / 30)} months`;
}

export function EventCalendar({ style }: { style?: CSSProperties }) {
  const entries = eventCalendar();
  const nextId = entries.find((entry) => !entry.running)?.event.id;
  return (
    <section className="glass card reveal" style={style} aria-label="Event calendar">
      <div className="section">
        <div className="section-head">
          <div className="section-icon"><ClockIcon /></div>
          <div className="min-w-0">
            <h2 className="section-title">Event calendar</h2>
            <p className="section-desc">Seasonal events in Ramsgate. Each one starts and ends by itself; Honest Ozz's stall opens with it.</p>
          </div>
        </div>
      </div>
      {entries.map(({ event, start, end, running, daysUntil }) => (
        <div className="section event-row" key={event.id} data-running={running}>
          <div className="section-row">
            <div className="section-head">
              <div className={`section-icon${running ? " good" : ""}`}><SparkIcon /></div>
              <div className="min-w-0">
                <h3 className="section-title server-title">
                  <span className="server-name">{event.name}</span>
                  {running && <span className="chip good">Live now</span>}
                  {!running && event.id === nextId && <span className="chip accent">Next</span>}
                </h3>
                <p className="section-desc">{event.brings}</p>
              </div>
            </div>
            <div className="section-actions event-dates">
              <span className="event-range">{DAY_MONTH.format(start)} – {DAY_MONTH.format(end)}</span>
              <span className="event-when">{running ? `Until ${DAY_MONTH.format(end)}` : when(daysUntil)}</span>
            </div>
          </div>
        </div>
      ))}
    </section>
  );
}
