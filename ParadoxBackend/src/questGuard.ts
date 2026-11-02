/*
 * MNG DAUNTLESS (modified version of Mystic Paradox). Licensed under the GNU Affero General Public License v3.0.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [MNG 2026-11-02] Quest saves only move forward.
// A character save replaces every SERIE_* quest blob with what the writer sends. A stale write (gameserver writes are
// forced through on a version conflict, see UpdateCharacter) could turn a Redeemed quest back into Redeemable, so it
// could be turned in, and paid, a second time. A save without a series at all got an empty one from
// NormalizeCharacterData, which put the player back on the series' first quest (the "first quest loops" report).
// This keeps, per series: a series the save left out, a quest the save left out, and a Redeemed quest (or series).

const REDEEMED = 3; // EQuestStatus::Redeemed (SDK Archon_structs.hpp)

export interface QuestGuardResult {
    /** One line per thing kept from the existing save, for the log. Empty when the save was left as sent. */
    kept: string[];
}

function ParseSeries(Raw: unknown): Record<string, any> | undefined {
    if (typeof Raw !== "string") return undefined;
    try {
        const Parsed = JSON.parse(Raw);
        return Parsed !== null && typeof Parsed === "object" && !Array.isArray(Parsed) ? Parsed : undefined;
    } catch {
        return undefined;
    }
}

function IsRedeemed(Entry: unknown): boolean {
    return Entry !== null && typeof Entry === "object" && Number((Entry as any).Status) === REDEEMED;
}

/** Changes `incoming` (a parsed character data object) in place, using `existing` (the saved one). */
export function GuardQuestSeries(incoming: Record<string, unknown>, existing: Record<string, unknown>): QuestGuardResult {
    const kept: string[] = [];
    for (const [Key, ExistingRaw] of Object.entries(existing)) {
        if (!Key.startsWith("SERIE_")) continue;
        if (incoming[Key] === undefined) {
            incoming[Key] = ExistingRaw;
            kept.push(`${Key} (left out of the save)`);
            continue;
        }
        const Old = ParseSeries(ExistingRaw);
        const New = ParseSeries(incoming[Key]);
        if (!Old || !New) continue;

        let Changed = false;
        if (Number(Old.Status) === REDEEMED && Number(New.Status) !== REDEEMED) {
            kept.push(`${Key} series Redeemed (save sent ${String(New.Status)})`);
            New.Status = Old.Status;
            Changed = true;
        }
        for (const [QuestId, OldQuest] of Object.entries(Old)) {
            if (QuestId === "ID" || QuestId === "Status" || OldQuest === null || typeof OldQuest !== "object") continue;
            const NewQuest = New[QuestId];
            if (NewQuest === undefined) {
                New[QuestId] = OldQuest;
                kept.push(`${Key}/${QuestId} (left out of the save)`);
                Changed = true;
            } else if (IsRedeemed(OldQuest) && !IsRedeemed(NewQuest)) {
                New[QuestId] = OldQuest;
                kept.push(`${Key}/${QuestId} Redeemed (save sent status ${String(NewQuest?.Status)})`);
                Changed = true;
            }
        }
        if (Changed) incoming[Key] = JSON.stringify(New);
    }
    return { kept };
}
