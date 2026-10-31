#!/usr/bin/env node
/*
 * [MNG DAUNTLESS 2026-10-31] Builds game-data/event_store.json: Honest Ozz's event shop for every seasonal event. The server sells
 * the running event's shop only (src/seasonalEvents.ts calendar, controllers/store.ts EventStoreSkus).
 *
 *   Dark Harvest  the wiki's "Honest Ozz's Event Store" list and prices + the 2021 rumour items (generate_event_store.cjs data).
 *   Frostfall     the wiki's Frostfall store table and prices, matched to catalog ids by name and icon (docs/MNG_SEASONAL_EVENTS.md).
 *   Ramsgiving, Saint's Bond, Springtide, Midsommar
 *                 the wiki has no price list: every cosmetic the client's StoreItemsTable has for the event (row ids
 *                 matched to catalog ids by sku_<id> or icon), priced by type like the wiki stores (weapons 1200, ...).
 *                 Midsommar has no event currency in 1.14.7 and is priced in Rams (x25).
 * Every shop also sells the wiki's supplies (Rams, Patrol Key, Merits, Bounty Token, Aethersparks, tonics).
 *
 * Names: the catalog's when it has one; else the wiki's (Frostfall); else a plain "<Event> <type>" name (the 1.14.7 string
 * table has no names for many event items; the in-game preview still shows the item itself).
 *
 *   node scripts/generate_event_stores.cjs && npx tsx scripts/generate_inventory_storage_policy.ts
 */
const fs = require("node:fs");
const path = require("node:path");
const DH = require("./generate_event_store.cjs").DARK_HARVEST;

const Root = path.resolve(__dirname, "..", "..");
const Analysis = path.join(Root, "Items_Analysis");
const OutPath = path.resolve(__dirname, "..", "game-data", "event_store.json");

function ReadJsonl(file) {
    return fs.readFileSync(path.join(Analysis, file), "utf8").split(/\r?\n/).filter((l) => l.trim()).map((l) => JSON.parse(l));
}
const Catalog = new Map(ReadJsonl("catalog_1_14_7.jsonl").map((r) => [r.itemId, r]));
const Rows = ReadJsonl("store_item_images_1_14_7.jsonl");
const RowByName = new Map(Rows.map((r) => [r.rowName, r]));
const Textures = new Map();
for (const line of fs.readFileSync(path.join(Analysis, "pak_textures_1_14_7.txt"), "utf8").split(/\r?\n/)) {
    const m = line.trim().match(/\/([^/]+)\.\1$/);
    if (m && !Textures.has(m[1].toLowerCase())) Textures.set(m[1].toLowerCase(), line.trim());
}
const short = (p) => String(p ?? "").split("/").pop().split(".")[0].toLowerCase();
function ItemData(row) {
    try { return JSON.parse(JSON.parse(row.customData).ItemData); } catch { return {}; }
}
const ByIcon = new Map();
for (const row of Catalog.values()) {
    const d = ItemData(row);
    for (const key of ["Icon", "LargeIcon"]) {
        const n = short(d[key]);
        if (!n) continue;
        if (!ByIcon.has(n)) ByIcon.set(n, new Set());
        ByIcon.get(n).add(row.itemId);
    }
}
const Texture = (name) => (name && name !== "none" ? Textures.get(name) : undefined);
const ItemIcon = (row) => { const d = ItemData(row); return Texture(short(d.LargeIcon)) ?? Texture(short(d.Icon)); };
const ValidName = (n) => typeof n === "string" && n.trim() && !n.includes("MISSING") && !n.includes("~DNT~");

// ---- prices and type labels by catalog item ----
function Kind(row) {
    const id = row.itemId, tags = (row.tags ?? []).map((t) => String(t).toLowerCase());
    if (id.startsWith("WP_")) return "weapon";
    if (id.startsWith("AR_")) return /HELM/.test(id) ? "helm" : /CHEST/.test(id) ? "chest" : "armour";
    if (id.startsWith("LT_")) return "lantern";
    if (id.startsWith("GD_")) return "glider";
    if (id.startsWith("EM_INTRO") || tags.includes("intro")) return "arrival";
    if (id.startsWith("EM_")) return "emote";
    if (id.startsWith("QI_FLARE")) return "flare";
    if (id.startsWith("BNC_ANIMATION")) return "banneremote";
    if (id.startsWith("BNC_")) return "banner";
    if (id.startsWith("TITLE_")) return "title";
    if (id.startsWith("AC_")) return "accessory";
    if (id.startsWith("DYE_")) return "dye";
    if (id.startsWith("EJ_")) return "emoji";
    if (id.startsWith("TY_")) return "curiosity";
    if (id.startsWith("CC_")) return "style";
    if (id.startsWith("PET_")) return "pet";
    return undefined;
}
const PRICE = { weapon: 1200, helm: 1200, chest: 960, armour: 720, lantern: 720, glider: 600, arrival: 1125, emote: 675, flare: 300,
    banneremote: 700, banner: 180, title: 500, accessory: 1500, dye: 500, emoji: 200, curiosity: 10, style: 300, pet: 1200 };
const LABEL = { weapon: "Weapon", helm: "Helm", chest: "Chest", armour: "Armour", lantern: "Lantern", glider: "Glider", arrival: "Arrival",
    emote: "Emote", flare: "Flare", banneremote: "Banner Emote", banner: "Banner", title: "Title", accessory: "Head Accessory", dye: "Dye",
    emoji: "Emoji", curiosity: "Curiosity", style: "Style", pet: "Pet" };
const WEAPON = { AC: "Strikers", CB: "Chain Blades", DP: "Repeaters", EB: "Sword", GA: "Axe", IH: "Hammer", MS: "War Pike" };
function TypeLabel(row, kind) {
    const w = row.itemId.match(/^WP_([A-Z]{2})_/);
    if (kind === "weapon" && w && WEAPON[w[1]]) return WEAPON[w[1]];
    if (/^AR_.*ARMS/.test(row.itemId)) return "Arms";
    if (/^AR_.*LEGS/.test(row.itemId)) return "Legs";
    if (/STANDARD/.test(row.itemId)) return "Standard";
    if (/SIGIL/.test(row.itemId)) return "Sigil";
    if (/FABRIC/.test(row.itemId)) return "Banner Fabric";
    return LABEL[kind];
}

// ---- supplies (the wiki's Dark Harvest list, sold by every event) ----
const SUPPLIES = [
    ["notes", "1000 Rams", 50, [["CURRENCY_NOTES", 1000]], "The namesake currency of Ramsgate."],
    ["key", "Patrol Key", 300, [["TOKEN_DAILY_PATROL_BONUS_PURCHASED", 1]], "Used to recover lost treasures spread across the Shattered Isles."],
    ["merits", "5 Combat Merits", 100, [["CURRENCY_PJM_WEAPON", 5]], "A currency used to unlock nodes in the Slayer's Path."],
    ["bounty", "Bounty Token", 150, [["TOKEN_BOUNTY_DRAFT", 1]], "Get more Hunt Pass progress by getting more bounties."],
    ["sparks", "5 Aethersparks", 100, [["CURRENCY_PJM_PRESTIGE_EMPTY", 5]], "Fragments of aetheric power that can be used to reforge a slayer's skill and produce an aetherheart."],
    ["consumables1", "Tonic Pack", 200, [["QI_LANTERN_POTION", 5], ["QI_ATTACK_SPEED_POTION", 5], ["QI_DAMAGE_ENRAGEBONUS_POTION", 5]], "A bundle of 5 Aetherdrive Tonics, 5 Blitz Tonics, and 5 Frenzy Tonics."],
    ["consumables2", "15 Bulwark Tonics", 200, [["QI_DAMAGE_BLOCK_POTION", 15]], "A protective tonic."],
];

// ---- the events ----
const EVENTS = [
    { id: "dark_harvest", name: "Dark Harvest", currency: "id_currency_event_darkharvest", offers: DH.offers, descriptions: DH.descriptions, supplies: false },
    {
        id: "frostfall", name: "Frostfall", currency: "id_currency_event_frostfall",
        // [sku id, wiki name, price, [[catalog id, quantity]], description]; descriptions are the wiki's.
        offers: [
            ["mng_ff_gift_red", "Exquisite Frostfall Gift", 50, [["TY_GIFT_FROSTFALL2020_RED", 1]], "A finely wrapped gift, perfect to share with friends new and yet-to-be! Contains a random selection of Frostfall Curiosities."],
            ["mng_ff_gift_green", "Frostfall Gift", 25, [["TY_GIFT_FROSTFALL2020_GREEN", 1]], "Wrapped with love and care, perfect to share. Contains a random selection of Frostfall Curiosities."],
            ["mng_ff_bells_of_winter", "Bells of Winter", 1500, [["AR_GOLDENBELLS_HELM_01", 1]], "Hark, I hear the bells of winter!"],
            ["mng_ff_frostfall_bells", "Frostfall Bells", 1500, [["AR_GOLDENBELLS_HELM", 1]], "You've got bows that jingle, jangle, jingle."],
            // Nine sweaters on the wiki, seven sweater chests in 1.14.7: names by number, prices the wiki's middle (960).
            ...[0, 1, 2, 3, 4, 5, 6].map((n) => [`mng_ff_sweater_${n}`, `Frostfall Sweater ${["I", "II", "III", "IV", "V", "VI", "VII"][n]}`, 960,
                [[`AR_FROSTFALL_SWEATER_CHEST_0${n}`.replace("SWEATER_CHEST_06", "SWEATER_CHEST_06"), 1]], "A festive Frostfall sweater."]),
            ...Object.entries({ CB: "Chainblades", DP: "Repeaters", GA: "Axe", IH: "Hammer", AC: "Strikers", MS: "War Pike", EB: "Sword" }).map(([w, n]) =>
                [`mng_ff_wp_${w.toLowerCase()}`, `Frostfall ${n}`, 1200, [[`WP_${w}_FROSTFALL_00`, 1]], "A newly found treasure from Silver Nikola's arsenal."]),
            ["mng_ff_mittens", "Frostfall Mittens", 1200, [["WP_AC_FROSTFALL_MITTENS_00", 1]], "Keeping fingers both safe and warm against even the coldest of Behemoths."],
            ["mng_ff_winter_cap", "Winter Cap", 1200, [["LT_FROSTFALL_00", 1]], "Everything looks better with a winter cap."],
            ["mng_ff_mistletoe", "Mistletoe Lantern", 720, [["LT_FROSTFALL_MISTLETOE", 1]], "Don't get caught below."],
            ["mng_ff_crystal", "Crystal Lantern", 720, [["LT_FROSTFALL_SNOWFLAKE", 1]], "Gleaming like fresh-fallen snow."],
            ["mng_ff_stay_frosty", "Stay Frosty", 1125, [["EM_PLAYER_EVENT_FROST17_002", 1]], "There must have been some magic in that old airship you found."],
            ["mng_ff_let_it_snowball", "Let It Snowball", 900, [["EM_PLAYER_EVENT_FROST17_001", 1]], "When the weather outside is frightful, the snowball is so delightful."],
            ["mng_ff_good_cheer", "Be Of Good Cheer!", 675, [["EM_PLAYER_EVENT_FROST17_000", 1]], "Raise a mug to new friends and old with this emote!"],
            // Not in 1.14.7: 25 Weapon Tokens (750) and the Arctic dye (500).
            ["mng_ff_frostwings", "Frostwings", 600, [["GD_FRAME_C_FROSTFALL_00", 1]], "When you feel a cold wind blowing, look up."],
            ["mng_ff_silver_star", "Silver Star", 300, [["QI_FLARE_FROSTFALL_00", 1]], "Better than a gold star."],
            ["mng_ff_northern_pole", "Northern Pole", 180, [["BNC_STANDARD_FROSTFALL_00", 1]], "A festive Frostfall standard."],
            ["mng_ff_flagstaff", "Flagstaff of the Frostwarden-General", 180, [["BNC_STANDARD_FROSTFALL_01", 1]], "A symbol of leadership carried by the commander of Skaldeskar's elite Slayer-protectors. Who also happens to be the queen."],
            // Frostfall curiosities in 1.14.7 (the gifts above open into these), 10 each like Dark Harvest's.
            ["mng_ff_beacon", "Frostfall Beacon", 10, [["TY_FIREWORK_FROSTFALL2020", 10]], "A Frostfall sparkler. 10 charges per purchase."],
            ["mng_ff_cauldron", "Frostfall Cauldron", 10, [["TY_GIFT_FROSTFALL2020_CAULDRON", 1]], "A bubbling Frostfall cauldron to share."],
            ["mng_ff_snowperson", "Adorable Snowperson", 10, [["TY_XFORM_FROSTFALLFALL2020_SNOWMAN", 5]], "Become an adorable snowperson. 5 charges per purchase."],
            ["mng_ff_snowslayer", "Snow Slayer", 10, [["TY_XFORM_FROSTFALL_SNOWSLAYER", 5]], "Become a snowy Slayer. 5 charges per purchase."],
            ["mng_ff_snowbenson", "Snow Benson", 10, [["TY_XFORM_FROSTFALL_SNOWBENSON", 5]], "Become a snowy Benson. 5 charges per purchase."],
            ["mng_ff_winter_warmer", "Winter Warmer", 10, [["TY_EMOTE_FROSTFALL2020_CHEERS", 5]], "A warming Frostfall drink. 5 charges per purchase."],
        ],
    },
    { id: "ramsgiving", name: "Ramsgiving", currency: "id_currency_event_ramsgiving", rows: /ramsgiving|rams20|benson|gruk/i, skip: /frostfall/i,
        overrides: { AC_HEAD_RAMSGIVING_00: { name: "Ramsgiving Crown", price: 4000 } } },
    { id: "saints_bond", name: "Saint's Bond", currency: "id_currency_event_saintsbond", rows: /romantic|saintsbond|flutterheart|hearts|sb20|saints19/i },
    { id: "springtide", name: "Springtide", currency: "id_currency_event_springtide", rows: /spring|puffle|eggplant/i },
    // Midsommar Madness (cosmetic hunt pass, 3 Aug - 14 Sep 2023): its rewards are these items; names from that wiki page.
    { id: "midsommar", name: "Midsommar", currency: "id_currency_notes", priceFactor: 25, rows: /midsommar/i, supplies: false,
        overrides: {
            AR_EVENT_MIDSOMMAR_HELM_00: { name: "Ritualist Horns" }, AR_EVENT_MIDSOMMAR_CHEST_00: { name: "Ritualist Robes" },
            AR_EVENT_MIDSOMMAR_ARMS_00: { name: "Ritualist Branches" }, AR_EVENT_MIDSOMMAR_LEGS_00: { name: "Ritualist Roots" },
            WP_EB_EVENT_MIDSOMMAR_00: { name: "Caladag, Sword of Legend" }, WP_GA_EVENT_MIDSOMMAR_00: { name: "Gobahn, the Axe King" },
            WP_MS_EVENT_MIDSOMMAR_00: { name: "Areadar, the Green Spear" }, WP_IH_EVENT_MIDSOMMAR_00: { name: "Gaia, the Earth Hammer" },
            WP_CB_EVENT_MIDSOMMAR_00: { name: "The Karanen, Ancient Blades" }, WP_AC_EVENT_MIDSOMMAR_00: { name: "The Everdawns" },
            WP_DP_EVENT_MIDSOMMAR_00: { name: "Growth & Decay" },
        } },
];

// Rows that are bundles, passes, contracts, daily gifts or starter kits: not sold by Ozz.
const NOT_SOLD = /^(bundle|pass_|eventpass_|contract_|gift_frostfall2020_day|prestige_|event_[a-z]+_starter|event_saintsbond_gift|single_event_quest|glider_frame_.*_x\d+|.*_x10$)/;

function CatalogIdsOfRow(row) {
    const sku = row.rowName.match(/^sku_(.+)$/);
    if (sku && Catalog.has(sku[1].toUpperCase())) return [sku[1].toUpperCase()];
    const rumour = row.rowName.match(/^(?:quest_rumour|sku_rumour)_(.+)$/);
    if (rumour) {
        const base = rumour[1].toUpperCase();
        for (const id of [base, base.replace(/_00_00$/, "_00"), base.replace(/_0\d$/, "_00"), base + "_00"]) if (Catalog.has(id)) return [id];
    }
    for (const image of [row.featureImage, row.standardImage]) {
        const ids = ByIcon.get(short(image));
        if (ids && ids.size === 1) return [...ids];
    }
    return [];
}

const Problems = [];
const Seen = new Set();
const Out = { comment: "Honest Ozz's event shops, one per seasonal event. Generated by scripts/generate_event_stores.cjs; the server sells the running event's shop.", serveUnder: ["seasonal_event"], events: {} };

function Sku(event, id, name, price, items, description, extra = {}) {
    const rows = items.map(([catalogId]) => Catalog.get(catalogId));
    items.forEach(([catalogId], i) => { if (!rows[i]) Problems.push(`${event.id}: ${catalogId} is not in the 1.14.7 catalog`); });
    if (Seen.has(id)) Problems.push(`${event.id}: duplicate SKU id ${id}`);
    Seen.add(id);
    const image = RowByName.get(id);
    const texture = Texture(short(image?.standardImage)) ?? Texture(short(image?.featureImage)) ?? (rows[0] && ItemIcon(rows[0]));
    const once = extra.once ?? rows.some((row) => row && (row.isStackable !== true || Number(row.maxQuantity) === 1));
    return {
        id, displayName: name, displayDescription: description ?? "", displayPriority: 0,
        prices: [{ currencyId: event.currency, price: Math.round(price * (event.priceFactor ?? 1)) }],
        maxAllowed: once ? 1 : null,
        ...(texture ? { images: { standard: `Engine.Texture2D'${texture}'` } } : {}),
        tags: ["seasonal_event", `event_${event.id}`],
        items: items.map(([catalogId, quantity], i) => ({ catalogId, quantity, instanced: rows[i]?.isStackable !== true })),
        duplicateInstancedItems: once ? items.map(([catalogId]) => catalogId) : [],
    };
}

for (const event of EVENTS) {
    const skus = [];
    if (event.offers) {
        for (const [id, name, price, items, description, extra] of event.offers) {
            skus.push(Sku(event, id, name, price, items, description ?? event.descriptions?.[name], extra));
        }
    } else {
        const taken = new Set();
        const counts = {};
        for (const row of Rows.filter((r) => event.rows.test(r.rowName) && !NOT_SOLD.test(r.rowName) && !(event.skip && event.skip.test(r.rowName)))) {
            const ids = CatalogIdsOfRow(row);
            if (ids.length !== 1 || taken.has(ids[0])) continue;
            const item = Catalog.get(ids[0]);
            const kind = Kind(item);
            if (!kind) continue;
            taken.add(ids[0]);
            const over = event.overrides?.[ids[0]] ?? {};
            const label = TypeLabel(item, kind);
            counts[label] = (counts[label] ?? 0) + 1;
            const name = over.name ?? (ValidName(item.displayName) ? item.displayName : `${event.name} ${label}`);
            const desc = ValidName(item.description) ? item.description : `A ${event.name} ${label.toLowerCase()} from Honest Ozz.`;
            const quantity = kind === "curiosity" ? 5 : 1;
            // A rumour row shows the generic "rumour skip" art and is a rumour, not an item: sell under sku_<catalog id>.
            const id = /^(quest_rumour|sku_rumour)_/.test(row.rowName) ? `sku_${ids[0].toLowerCase()}` : row.rowName;
            skus.push(Sku(event, id, name, over.price ?? PRICE[kind], [[ids[0], quantity]], desc));
        }
        // Several unnamed items of one type: number them (Ramsgiving Axe I, II, ...).
        const seen = {};
        for (const sku of skus) {
            const label = sku.displayName.replace(`${event.name} `, "");
            if (sku.displayName === `${event.name} ${label}` && counts[label] > 1) {
                seen[label] = (seen[label] ?? 0) + 1;
                sku.displayName += ` ${["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][seen[label] - 1] ?? seen[label]}`;
            }
        }
    }
    if (event.supplies !== false) {
        for (const [key, name, price, items, description] of SUPPLIES) skus.push(Sku(event, `mng_${event.id}_${key}`, name, price, items, description));
    }
    skus.forEach((sku, index) => { sku.displayPriority = index; });
    Out.events[event.id] = { name: event.name, currency: event.currency, skus };
}

if (Problems.length) {
    console.error("Not written:\n  " + Problems.join("\n  "));
    process.exit(1);
}
fs.writeFileSync(OutPath, JSON.stringify(Out, null, 2) + "\n", "utf8");
for (const [id, e] of Object.entries(Out.events)) {
    console.log(`${id}: ${e.skus.length} offers (${e.skus.filter((s) => !s.images).length} without art), priced in ${e.currency}`);
    if (process.argv.includes("--list")) for (const s of e.skus) console.log(`    ${s.displayName.padEnd(36)} ${String(s.prices[0].price).padStart(6)} ${s.maxAllowed === 1 ? "once  " : "repeat"} ${s.items.map((i) => i.catalogId + (i.quantity > 1 ? " x" + i.quantity : "")).join(" + ")}`);
}
console.log(`Wrote ${OutPath}`);
