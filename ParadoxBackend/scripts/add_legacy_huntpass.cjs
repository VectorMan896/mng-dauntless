#!/usr/bin/env node
/*
 * MNG DAUNTLESS Legacy Hunt Pass: fills the client's enabled hunt pass seasons (season43..season50) with the items of
 * old Hunt Passes that are still in the 1.14.7 catalogue (ids like AR_..._HP05_NINJA_..., WP_..._HP10A_CELESTIAL_...).
 *
 * Edits game-data/raw/progression_config.source.json in place (run build_progression_source_from_export.cjs first),
 * then validate and install with:
 *   npm run generate:progression-config -- --apply
 *   npm run inventory:storage-policy:generate          # the new reward ids must be in the storage policy
 *
 * Each season gets 50 ranks on both tracks, every rank with a reward on both (the game draws a rank without one as an
 * empty card with a check on its lock):
 *   - the old pass's cosmetics (armour, weapon skins, lanterns, emotes, banners, flares, emoji, dyes, titles), spread
 *     across the ranks and alternating between the free and the premium track;
 *   - filler where a rank has no cosmetic, after the live passes (wiki, Hunt Pass Season: Aetherpunk): on the free track
 *     Rams, Ace Chips and Steel Marks, an Uncommon Cell Core every 5 ranks and a Rare one every 10; on the Elite track
 *     supplies (tonics, pylons, grenades), Steel Marks, Ace Chips, Transmog Stones and Cell Cores. Only items with a
 *     Hunt Pass reward icon (LargeIcon) are used: Chroma Dust has none and showed as a bare "100";
 *   - Platinum, as the live passes paid it (Aetherpunk: 50 on ~10 Elite and 4 free levels): 50 on Elite ranks ending in
 *     3 or 8 and free ranks ending in 3, where no cosmetic sits. The server sells no Platinum, so the pass is where players
 *     get it for the Platinum store. Granted as CURRENCY_PLATINUM_UNIV, the bucket the live pass data used (the wallet sums
 *     the buckets; platinumWallet.ts). A player-hosted realm refuses Platinum grants (hostGrantPolicy.ts); dedicated
 *     servers accept them;
 *   - premium_gating_entitlement <season>_premium (the live naming), which the backend grants to everyone when
 *     MYSTICPARADOX_HUNTPASS_FREE_PREMIUM=on.
 *
 * USAGE (from ParadoxBackend)
 *   node scripts/add_legacy_huntpass.cjs [--first <n>] [--catalog <file>] [--xp <per-rank>]
 *     --first   index of the first old pass to use (0 = the oldest with enough items); the next cycle uses --first 8
 *     --platinum  Platinum per Platinum rank (default 50; 0 leaves Platinum out)
 *     --xp      pass XP per rank (default 100). The 1.14.7 game server grants about 5-11 pass XP per event, so the
 *               earlier 3000 left players at rank 0 after a whole evening of hunts.
 *     --bonus-coins  Bonus Cache Coins per bonus level after rank 50 (default 25; 0 turns the bonus off)
 *     --bonus-xp     pass XP per bonus level (default: the same as --xp)
 */
const fs = require("node:fs");
const path = require("node:path");

function Arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const BackendRoot = path.resolve(__dirname, "..");
const CatalogPath = path.resolve(Arg("catalog", path.join(BackendRoot, "..", "Items_Analysis", "catalog_1_14_7.jsonl")));
const RawDir = process.env.PARADOX_GAME_DATA_RAW_DIR ? path.resolve(process.env.PARADOX_GAME_DATA_RAW_DIR) : path.join(BackendRoot, "game-data", "raw");
const SourcePath = path.join(RawDir, "progression_config.source.json");
const First = Number(Arg("first", "0"));
const XpPerRank = Number(Arg("xp", "100"));
const PlatinumPerRank = Number(Arg("platinum", "50"));
const PLATINUM_ID = "CURRENCY_PLATINUM_UNIV";
// [2026-10-31] Bonus levels after rank 50: Bonus Cache Coins (the Reward Cache's currency) per level, and the pass XP a level costs.
const BonusCoinsPerLevel = Number(Arg("bonus-coins", "25"));
const BonusXpPerLevel = Number(Arg("bonus-xp", String(XpPerRank)));
const BONUS_COIN_ID = "CURRENCY_SEASONAL_COIN";
const SEASONS = ["season43", "season44", "season45", "season46", "season47", "season48", "season49", "season50"];
const RANKS = 50;
const MIN_ITEMS = 12;

// Cosmetic kinds in the order they are placed (most valued first). QI covers only the pass flares (QI_FLARE_HP..).
const KIND_ORDER = ["AR", "WP", "LT", "EM", "BNC", "QI", "EJ", "TITLE", "DYE"];
const KindOf = (id) => (id.startsWith("QI_") && !id.startsWith("QI_FLARE_") ? null : KIND_ORDER.find((k) => id.startsWith(k + "_")) ?? null);

// Filler rotations for ranks without a cosmetic (catalog id, quantity), after the live passes' amounts.
const FREE_FILLER = [["CURRENCY_NOTES", 500], ["CURRENCY_TOKEN_EXCHANGE_SPEED_UP", 25], ["CURRENCY_NOTES", 500], ["CURRENCY_MARKS_STEEL", 50]];
const ELITE_SUPPLIES = [
    ["QI_DAMAGE_BLOCK_POTION", 15], ["QI_STAMINA_POTION_00", 25], ["QI_ATTACK_SPEED_POTION", 25], ["QI_HEALING_PYLON_BIG", 10],
    ["QI_STAGGER_POTION", 25], ["QI_GRENADE_INTERRUPT", 15], ["QI_LANTERN_POTION", 25], ["QI_DAMAGE_ENRAGEBONUS_POTION", 25],
    ["QI_LIFESTEAL_AOE_POTION", 15], ["CURRENCY_TOKEN_EXCHANGE_SPEED_UP", 25],
];
function EliteFiller(rank) {
    if (PlatinumPerRank > 0 && (rank % 10 === 3 || rank % 10 === 8)) return [PLATINUM_ID, PlatinumPerRank];
    if (rank % 10 === 9) return ["CONTAINER_CORE_GOLD_CELLCORE", 1];
    if (rank % 10 === 4) return ["CONTAINER_CORE_SILVER_CELLCORE", 1];
    if (rank % 10 === 2) return ["CURRENCY_TOKEN_TRANSMOG", 1];
    if (rank % 10 === 7) return ["CURRENCY_MARKS_STEEL", 200];
    return ELITE_SUPPLIES[rank % ELITE_SUPPLIES.length];
}

const Catalog = new Map();
for (const line of fs.readFileSync(CatalogPath, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const row = JSON.parse(line);
    Catalog.set(row.itemId, row);
}

// Group the old pass cosmetics: key "05", "06B", ... (number plus optional half), with the theme names seen.
const Passes = new Map();
for (const [id, row] of Catalog) {
    // Flares and some sets have no theme word (QI_FLARE_HP05_00) or a dashed half (AR_HP06-1_...).
    const m = id.match(/HP(\d{2})([AB]|-\d)?_([A-Z]+)?/);
    if (!m || row.isBundle || id.startsWith("BUNDLE_")) continue;
    const kind = KindOf(id);
    if (!kind) continue;
    // HP06-1/HP06-2 are the other half of HP06 (Fortune & Glory), not a pass of their own.
    const key = m[1] + (m[2] && !m[2].startsWith("-") ? m[2] : "");
    const pass = Passes.get(key) ?? { key, themes: new Map(), items: [] };
    if (m[3]) pass.themes.set(m[3], (pass.themes.get(m[3]) ?? 0) + 1);
    pass.items.push({ id, kind, stackable: row.isStackable === true });
    Passes.set(key, pass);
}
const Usable = [...Passes.values()].filter((p) => p.items.length >= MIN_ITEMS).sort((a, b) => a.key.localeCompare(b.key));
if (Usable.length < SEASONS.length) throw new Error(`Only ${Usable.length} old passes have ${MIN_ITEMS}+ items`);

function Grant(item, quantity = 1) {
    return item.stackable
        ? { stacked: { catalog_id: item.id, quantity, priority: 0, hidden: false } }
        : { instanced: item.id };
}
const Filler = (id, quantity) => ({ stacked: { catalog_id: id, quantity, priority: 0, hidden: false } });

function RewardRow(rank, grants) {
    return {
        rank_id: rank,
        stacked_items: grants.filter((g) => g.stacked).map((g) => g.stacked),
        instanced_items: grants.filter((g) => g.instanced).map((g) => g.instanced),
        entitlements: [],
    };
}

function BuildSeason(seasonId, pass) {
    // Interleave kinds so each stretch of ranks mixes armour, weapons, emotes, ... and cap at two per rank.
    const byKind = KIND_ORDER.map((k) => pass.items.filter((i) => i.kind === k).sort((a, b) => a.id.localeCompare(b.id)));
    const ordered = [];
    while (byKind.some((l) => l.length)) for (const l of byKind) if (l.length) ordered.push(l.shift());
    const cosmetics = ordered.slice(0, RANKS * 2);

    const free = new Map(), premium = new Map();
    cosmetics.forEach((item, i) => {
        // Spread across ranks 1..50; even positions go to premium, odd to free.
        const rank = 1 + Math.floor((i * RANKS) / cosmetics.length);
        const track = i % 2 === 0 ? premium : free;
        track.set(rank, [...(track.get(rank) ?? []), Grant(item)]);
    });
    for (let rank = 1; rank <= RANKS; rank++) {
        if (rank % 10 === 0) free.set(rank, [...(free.get(rank) ?? []), Filler("CONTAINER_CORE_GOLD_CELLCORE", 1)]);
        else if (rank % 5 === 0) free.set(rank, [...(free.get(rank) ?? []), Filler("CONTAINER_CORE_SILVER_CELLCORE", 1)]);
        else if (!free.has(rank) && PlatinumPerRank > 0 && rank % 10 === 3) free.set(rank, [Filler(PLATINUM_ID, PlatinumPerRank)]);
        else if (!free.has(rank)) free.set(rank, [Filler(...FREE_FILLER[rank % FREE_FILLER.length])]);
        if (!premium.has(rank)) premium.set(rank, [Filler(...EliteFiller(rank))]);
    }
    const rows = (m) => [...m.entries()].sort((a, b) => a[0] - b[0]).map(([rank, grants]) => RewardRow(rank, grants));
    const theme = [...pass.themes.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "?";
    return {
        path: {
            progression_id: seasonId,
            premium_gating_entitlement: `${seasonId}_premium`,
            start_date: "2019-05-21T00:00:00+00:00",
            end_date: "2099-12-31T00:00:00+00:00",
            requirements: Array.from({ length: RANKS + 1 }, (_, r) => ({ rank_id: r, xp_required: r === 0 ? 0 : XpPerRank })),
            free_rewards: rows(free),
            premium_rewards: rows(premium),
            // [MNG DAUNTLESS 2026-10-31] Bonus levels after the last rank pay Bonus Cache Coins, as the live passes did (5 free +
            // 20 Elite per level). Elite is free for everyone here, so the whole 25 sits on the free track: the wallet funds a
            // prestige grant from the free rate only (wallet.ts SpendBankedPrestigeForReward), so a 20 on the Elite side would be
            // refused. --bonus-coins 0 turns the bonus off.
            ...(BonusCoinsPerLevel > 0 ? {
                prestige: {
                    xp_per_level: BonusXpPerLevel,
                    free_rewards: { stacked_items: [{ catalog_id: BONUS_COIN_ID, quantity: BonusCoinsPerLevel, priority: 0, hidden: false }], instanced_items: [], entitlements: [] },
                    premium_rewards: { stacked_items: [], instanced_items: [], entitlements: [] },
                },
            } : {}),
        },
        summary: `${seasonId} <- HP${pass.key} ${theme} (${cosmetics.length} cosmetics)`,
    };
}

const Source = JSON.parse(fs.readFileSync(SourcePath, "utf8"));
const Paths = Source.payload.paths.filter((p) => !SEASONS.includes(p.progression_id));
const FillerIds = new Set(["CONTAINER_CORE_SILVER_CELLCORE", "CONTAINER_CORE_GOLD_CELLCORE", ...FREE_FILLER.map((f) => f[0]),
    ...Array.from({ length: 10 }, (_, r) => EliteFiller(r)[0]), ...ELITE_SUPPLIES.map((f) => f[0]), ...(PlatinumPerRank > 0 ? [PLATINUM_ID] : [])]);
for (const id of FillerIds) {
    if (!Catalog.has(id)) throw new Error(`Filler item ${id} is not in the catalog`);
}
SEASONS.forEach((seasonId, i) => {
    const pass = Usable[(First + i) % Usable.length];
    const built = BuildSeason(seasonId, pass);
    Paths.push(built.path);
    console.log(built.summary);
});
Source.payload.paths = Paths;
fs.writeFileSync(SourcePath, JSON.stringify(Source, null, 2) + "\n");
console.log(`Wrote ${SourcePath} (${Usable.length} old passes available; this cycle used ${First}..${First + SEASONS.length - 1})`);
