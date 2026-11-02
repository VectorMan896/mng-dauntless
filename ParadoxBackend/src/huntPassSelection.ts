/*
 * MNG DAUNTLESS (modified version of Mystic Paradox). Licensed under the GNU Affero General Public License v3.0.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [MNG 2026-11-02] Which hunt pass a player progresses, when MYSTICPARADOX_HUNTPASS_ALL_OPEN opens every rotation pass at
// once. GET /huntpass/<account> tells the game the selected pass (`huntpass_id`); the game's pass selection screen
// (HuntPassComponent.ServerSetSelectedHuntPass) saves a new pick. The shape of that save was never captured, so
// PickHuntPassId accepts the likely field names and otherwise any string value that names an open pass, and the route
// logs the body it got. Each pass keeps its own rank in the progression records: switching pauses one and resumes another.

import { GetMongoDb } from "./persistence/mongo/client";
import { Collections } from "./persistence/mongo/collections";

const LIKELY_FIELDS = ["huntpass_id", "huntPassId", "selected_huntpass", "selectedHuntPassId", "huntpass", "season", "id"];

/** The open pass a save body names, or undefined. `open` is the list of passes the player may pick. */
export function PickHuntPassId(body: unknown, open: readonly string[]): string | undefined {
    const Open = new Set(open);
    if (typeof body === "string") return Open.has(body.trim()) ? body.trim() : undefined;
    if (body === null || typeof body !== "object") return undefined;
    const Record = body as Record<string, unknown>;
    for (const Field of LIKELY_FIELDS) {
        const Value = Record[Field];
        if (typeof Value === "string" && Open.has(Value.trim())) return Value.trim();
    }
    for (const Value of Object.values(Record)) {
        if (typeof Value === "string" && Open.has(Value.trim())) return Value.trim();
        if (Value !== null && typeof Value === "object") {
            const Nested = PickHuntPassId(Value, open);
            if (Nested) return Nested;
        }
    }
    return undefined;
}

/** The pass GET /huntpass serves: the saved pick while it is still open, else the served (rotation) pass. */
export function ServedSelection(saved: string | undefined, open: readonly string[], fallback: string): string {
    return saved !== undefined && open.includes(saved) ? saved : fallback;
}

export async function LoadHuntPassSelection(userId: string): Promise<string | undefined> {
    const Db = await GetMongoDb();
    const Doc = await Db.collection<{ _id: string; huntpassId: string }>(Collections.HuntPassSelections).findOne({ _id: userId });
    return typeof Doc?.huntpassId === "string" ? Doc.huntpassId : undefined;
}

export async function SaveHuntPassSelection(userId: string, huntpassId: string): Promise<void> {
    const Db = await GetMongoDb();
    await Db.collection<{ _id: string; huntpassId: string; modified: string }>(Collections.HuntPassSelections)
        .updateOne({ _id: userId }, { $set: { huntpassId, modified: new Date().toISOString() } }, { upsert: true });
}
