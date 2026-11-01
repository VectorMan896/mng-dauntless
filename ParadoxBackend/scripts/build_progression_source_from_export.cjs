#!/usr/bin/env node
/*
 * MNG DAUNTLESS: builds game-data/raw/progression_config.source.json from the CatalogExporter progression export
 * (Items_Analysis/progression_1_14_7, EXPORT_PROGRESSION=1), for when no captured progression-config response exists.
 *
 * What the client's own tables provide and what is filled in:
 *   - ExperienceTrack_PlayerLevel and ExperienceTrack_Weapon_*: exact per-rank XP costs (no rewards in the tables).
 *   - MasteryTrack_*: per-rank costs and their item rewards.
 *   - PrestigeTrack_Weapon_*: a single 0-XP requirement with prestige.xp_per_level 1 (the rank IS the reforge count).
 *   - The served hunt pass (GAMESERVER_HUNTPASS_ID, default season43): the client table has no ranks or rewards for any
 *     pass, so it gets ranks 0..50 at a flat XP cost and no rewards. Add rewards later by editing the source file.
 *
 * USAGE (from ParadoxBackend)
 *   node scripts/build_progression_source_from_export.cjs [--export <dir>] [--pass <id>] [--pass-ranks 50] [--pass-xp 3000]
 * then
 *   npm run generate:progression-config            # validate (dry run)
 *   npm run generate:progression-config -- --apply  # write game-data/progression_config.json
 */
const fs = require("node:fs");
const path = require("node:path");

function Arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BackendRoot = path.resolve(__dirname, "..");
const ExportDir = path.resolve(Arg("export", path.join(BackendRoot, "..", "Items_Analysis", "progression_1_14_7")));
const RawDir = process.env.PARADOX_GAME_DATA_RAW_DIR
    ? path.resolve(process.env.PARADOX_GAME_DATA_RAW_DIR)
    : path.join(BackendRoot, "game-data", "raw");
const PassId = Arg("pass", process.env.GAMESERVER_HUNTPASS_ID || "season43");
const PassRanks = Number(Arg("pass-ranks", "50"));
const PassXp = Number(Arg("pass-xp", "3000"));

const OPEN_START = "2019-05-21T00:00:00+00:00";
const OPEN_END = "2099-12-31T00:00:00+00:00";

function ReadRows(file) {
    const full = path.join(ExportDir, file);
    if (!fs.existsSync(full)) throw new Error(`Missing export file: ${full} (run CatalogExporter with EXPORT_PROGRESSION=1)`);
    return fs.readFileSync(full, "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
}

function Rewards(list) {
    return (list ?? []).map((r) => ({
        rank_id: r.rankId,
        stacked_items: (r.stackedItems ?? []).map((s) => ({ catalog_id: s.catalogId, quantity: s.quantity, priority: s.priority ?? 0, hidden: false })),
        instanced_items: [...(r.instancedItems ?? []), ...(r.orderedInstancedItems ?? []).map((o) => o.catalogId)],
        entitlements: (r.entitlements ?? []).map((e) => ({ entitlement_id: e.entitlementId, duration: e.duration })),
    }));
}

function TrackPath(base) {
    return {
        progression_id: base.progressionTrack,
        premium_gating_entitlement: base.premiumGatingEntitlement || "",
        start_date: OPEN_START,
        end_date: OPEN_END,
        requirements: (base.requirements ?? []).map((q) => ({ rank_id: q.rankId, xp_required: q.requiredXP })),
        free_rewards: Rewards(base.freeRewards),
        premium_rewards: Rewards(base.premiumRewards),
    };
}

const Paths = new Map();
const Add = (p) => { if (p.requirements.length > 0 && !Paths.has(p.progression_id)) Paths.set(p.progression_id, p); };

// Experience tracks (player level and weapons), then mastery.
const Experience = [...ReadRows("player-experience-tracks.jsonl"), ...ReadRows("experience-tracks.jsonl"), ...ReadRows("weapon-experience-tracks.jsonl")];
for (const row of Experience) Add(TrackPath(row.base));
for (const row of ReadRows("mastery-tracks.jsonl")) Add(TrackPath(row.base));

// Weapon prestige (reforge) tracks named by the weapon experience tracks.
const Prestige = new Set(Experience.map((r) => r.prestigeTrack).filter((t) => t && t !== "None"));
for (const id of Prestige) {
    Add({
        progression_id: id,
        premium_gating_entitlement: "",
        start_date: OPEN_START,
        end_date: OPEN_END,
        requirements: [{ rank_id: 0, xp_required: 0 }],
        free_rewards: [],
        premium_rewards: [],
        // [MNG 2026-11-01] Each reforge pays one Aetherheart, as the live service did. This line is also what turns on
        // the server's limit (controllers/wallet.ts): Hearts only for reforges actually banked, so a repeated request
        // can't duplicate them.
        prestige: { xp_per_level: 1, free_rewards: { stacked_items: [{ catalog_id: "CURRENCY_PJM_PRESTIGE_FILLED", quantity: 1 }] } },
    });
}

// The served hunt pass: ranks without rewards (the client table carries none for any pass).
const PassRow = ReadRows("huntpass-season-table.jsonl").find((r) => r.base?.progressionTrack === PassId);
if (!PassRow) console.warn(`Warning: ${PassId} is not in the client's hunt_pass_season_table; adding it anyway.`);
Paths.set(PassId, {
    progression_id: PassId,
    premium_gating_entitlement: PassRow?.base?.premiumGatingEntitlement || "",
    start_date: OPEN_START,
    end_date: OPEN_END,
    requirements: Array.from({ length: PassRanks + 1 }, (_, rank) => ({ rank_id: rank, xp_required: rank === 0 ? 0 : PassXp })),
    free_rewards: [],
    premium_rewards: [],
});

const Source = { code: null, message: "OK", payload: { paths: [...Paths.values()] } };
fs.mkdirSync(RawDir, { recursive: true });
const Out = path.join(RawDir, "progression_config.source.json");
fs.writeFileSync(Out, JSON.stringify(Source, null, 2) + "\n");
console.log(`Wrote ${Out}`);
for (const p of Paths.values()) {
    const rewards = p.free_rewards.length + p.premium_rewards.length;
    console.log(`  ${p.progression_id.padEnd(36)} ranks=${p.requirements.length} rewards=${rewards}${p.prestige ? " prestige" : ""}`);
}
