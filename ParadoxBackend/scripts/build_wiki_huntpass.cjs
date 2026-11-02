#!/usr/bin/env node
/*
 * [MNG DAUNTLESS 2026-11-02] Rebuilds the Legacy Hunt Pass rewards (season43..50) level by level from the original
 * passes' wiki tables, replacing the spread-out layout of add_legacy_huntpass.cjs. Only free_rewards and premium_rewards
 * change; XP per rank, the bonus levels (prestige), the Elite gating entitlement and the dates stay as they are.
 *
 * Input: Items_Analysis/wiki_huntpass/wiki_huntpass.json from scripts/wiki_huntpass_extract.cjs (run it first).
 * Rules, as decided by the owner on 2 Nov 2026:
 *   - every wiki reward that matches exactly one 1.14.7 item is given as listed (level, track, quantity);
 *   - Platinum -> CURRENCY_PLATINUM_UNIV; Bronze/Silver/Gold Slayer Core -> Common/Uncommon/Rare Cell Core (the
 *     modern names of the same tiers); Bounty Tokens -> TOKEN_BOUNTY_DRAFT;
 *   - anything else not in 1.14.7 (Aetherdust, old dyes, face paints, hair tints, unnamed items) is left out and listed;
 *   - a level left empty (the originals left 21-28 free levels empty per pass; on either track a reward may have been left
 *     out) gets, in turn, Platinum x25, Bounty Tokens x3, Patrol Keys x5 (the wiki's usual free-level amounts for those
 *     rewards); free and Elite each keep their own turn.
 *   - the bonus levels after the last rank pay 5 Bonus Cache Coins free + 20 Elite, as the live passes did (the Elite
 *     tile was empty and opening it crashed the game; wallet.ts counts both sides when Elite is free for everyone).
 * Writes game-data/raw/progression_config.source.json; then: npm run generate:progression-config -- --apply and
 * npm run inventory:storage-policy:generate.
 *
 * USAGE (from ParadoxBackend)
 *   node scripts/build_wiki_huntpass.cjs [--dry]      --dry prints the result and writes nothing
 */
const fs = require("node:fs");
const path = require("node:path");

const BackendRoot = path.resolve(__dirname, "..");
const ReportPath = path.join(BackendRoot, "..", "Items_Analysis", "wiki_huntpass", "wiki_huntpass.json");
const CatalogPath = path.join(BackendRoot, "..", "Items_Analysis", "catalog_1_14_7.jsonl");
const RawDir = process.env.PARADOX_GAME_DATA_RAW_DIR ? path.resolve(process.env.PARADOX_GAME_DATA_RAW_DIR) : path.join(BackendRoot, "game-data", "raw");
const SourcePath = path.join(RawDir, "progression_config.source.json");
const DRY = process.argv.includes("--dry");

const GENERIC = {
    "platinum": "CURRENCY_PLATINUM_UNIV",
    "bronze slayer core": "CONTAINER_CORE_BRONZE_CELLCORE",
    "silver slayer core": "CONTAINER_CORE_SILVER_CELLCORE",
    "gold slayer core": "CONTAINER_CORE_GOLD_CELLCORE",
    "bounty tokens": "TOKEN_BOUNTY_DRAFT",
};
const FREE_FILL = [["CURRENCY_PLATINUM_UNIV", 25], ["TOKEN_BOUNTY_DRAFT", 3], ["TOKEN_DAILY_PATROL_BONUS_PURCHASED", 5]];

const Catalog = new Map();
for (const line of fs.readFileSync(CatalogPath, "utf8").split(/\r?\n/)) {
    if (line.trim()) { const r = JSON.parse(line); Catalog.set(r.itemId, r); }
}
for (const id of [...Object.values(GENERIC), ...FREE_FILL.map((f) => f[0])]) {
    if (!Catalog.has(id)) throw new Error(`${id} is not in the 1.14.7 catalogue`);
}
const Named = (id) => { const n = Catalog.get(id)?.displayName ?? ""; return n && !/MISSING STRING/i.test(n); };

function Grant(id, quantity) {
    return Catalog.get(id)?.isStackable === true
        ? { stacked: { catalog_id: id, quantity, priority: 0, hidden: false } }
        : { instanced: id };
}
const Row = (rank, grants) => ({
    rank_id: rank,
    stacked_items: grants.filter((g) => g.stacked).map((g) => g.stacked),
    instanced_items: grants.filter((g) => g.instanced).map((g) => g.instanced),
    entitlements: [],
});

const Report = JSON.parse(fs.readFileSync(ReportPath, "utf8"));
const Source = JSON.parse(fs.readFileSync(SourcePath, "utf8"));
const left = [];
const summary = [];
for (const [season, pass] of Object.entries(Report)) {
    const target = Source.payload.paths.find((p) => p.progression_id === season);
    if (!target) throw new Error(`${season} is not in ${SourcePath}`);
    const fillTurn = { free: 0, elite: 0 };
    let filled = 0, given = 0;
    const build = (track) => pass[track].map(({ level, rewards }) => {
        const grants = [];
        for (const r of rewards) {
            const key = String(r.name ?? "").toLowerCase().replace(/\s*\(\d+\)$/, "");
            const id = GENERIC[key] ?? (r.ids.length === 1 ? r.ids[0] : null);
            if (id && Named(id)) { grants.push(Grant(id, r.quantity)); given++; }
            else left.push(`${season} ${pass.page.replace("Hunt Pass Season: ", "")} L${level} ${track}: ${r.name ?? r.raw}${r.kind ? ` (${r.kind})` : ""} x${r.quantity}${id ? ` (${id} has no name in 1.14.7)` : ""}`);
        }
        if (grants.length === 0) {
            const [id, q] = FREE_FILL[fillTurn[track]++ % FREE_FILL.length];
            grants.push(Grant(id, q));
            filled++;
        }
        return Row(level, grants);
    });
    const free = build("free");
    const elite = build("elite");
    const emptyElite = elite.filter((r) => !r.stacked_items.length && !r.instanced_items.length).map((r) => r.rank_id);
    if (free.length !== target.requirements.length - 1) throw new Error(`${season}: ${free.length} levels, the track has ${target.requirements.length - 1}`);
    target.free_rewards = free;
    target.premium_rewards = elite;
    if (target.prestige) {
        const Coin = (q) => ({ stacked_items: [{ catalog_id: "CURRENCY_SEASONAL_COIN", quantity: q, priority: 0, hidden: false }], instanced_items: [], entitlements: [] });
        target.prestige.free_rewards = Coin(5);
        target.prestige.premium_rewards = Coin(20);
    }
    const plat = [...free, ...elite].flatMap((r) => r.stacked_items).filter((s) => s.catalog_id === "CURRENCY_PLATINUM_UNIV").reduce((a, s) => a + s.quantity, 0);
    summary.push(`${season} <- ${pass.page}: ${given} wiki rewards, ${filled} empty levels filled, Platinum ${plat}` +
        (emptyElite.length ? `, EMPTY ELITE LEVELS ${emptyElite.join(",")}` : ""));
}
console.log(summary.join("\n"));
console.log(`\nLeft out (${left.length}):\n  ` + left.join("\n  "));
if (DRY) { console.log("\n--dry: nothing written"); process.exit(0); }
fs.writeFileSync(SourcePath, JSON.stringify(Source, null, 2) + "\n");
console.log(`\nWrote ${SourcePath}`);
