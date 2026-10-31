#!/usr/bin/env node
/*
 * [MNG DAUNTLESS 2026-10-31] Builds game-data/event_store.json: the event merchant's shop (Honest Ozz's stall in Ramsgate),
 * priced in Harvest Coins (CURRENCY_EVENT_DARKHARVEST), which src/seasonalEvents.ts pays for each completed hunt.
 *
 * Contents and prices: the wiki's "Honest Ozz's Event Store" table (https://dauntless.fandom.com/wiki/Dark_Harvest, read
 * 31 Oct 2026 through its API). Each wiki item is matched to the client's own StoreItemsTable row (SKU id; the event rows
 * are named sku_<catalog id>) and catalog id by icon (Items_Analysis/catalog_1_14_7.jsonl). Uncertain matches are marked "?"
 * below. The "rumour" block is ours: in the live event those Unseen cosmetics came from rumour quests (Unseen gifts hidden in
 * Ramsgate), which are not served, so Ozz sells them at the price of their Bloodshot counterparts until the quests exist.
 *
 * The rumour items use sku_<catalog id> ids: the client's quest_rumour_* rows show the generic "rumour skip" art
 * (seen 31 Oct) and are rumours, not items. The tile image is the row's texture when your install's paks hold it (Items_Analysis/pak_textures_1_14_7.txt), else the
 * first item's icon. After running it, regenerate the storage policy so the server may grant the new items:
 *   node scripts/generate_event_store.cjs && npx tsx scripts/generate_inventory_storage_policy.ts
 */
const fs = require("node:fs");
const path = require("node:path");

const Root = path.resolve(__dirname, "..", "..");
const Analysis = path.join(Root, "Items_Analysis");
const OutPath = path.resolve(__dirname, "..", "game-data", "event_store.json");
const CURRENCY = "id_currency_event_darkharvest";
// The client's event_store_view_model_C asks for tagFilter "seasonal_event" and has no tabs (runtime [StoreProbe], 31 Oct).
const TAGS = ["seasonal_event", "event_darkharvest"];

// [sku id, wiki name, price in Harvest Coins, [[catalog id, quantity], ...]]
const OFFERS = [
    // Curiosities (bought again and again)
    ["single_toy_xform_dh2020", "Be On Your Gourd (Transform)", 10, [["TY_XFORM_DH2020", 5]]],
    ["single_toy_firework_dh2020", "Unseen Beacon (Sparkler)", 10, [["TY_FIREWORK_DH2020", 10]]],
    ["single_toy_thrown_dh2020", "Sinister Squash (Sparkler)", 10, [["TY_THROWN_DH2020", 10]]],              // ? bat bomb icon
    ["single_toy_xform_dh2021", "Midnight Observer (Transform)", 10, [["TY_XFORM_DH2021", 3]]],
    // Masks
    ["single_mask_unseen_shrowd", "Shady Shrowd Mask", 500, [["AR_DHMASK_CROWBEAR_HELM", 1]]],                // icon shrowd_mask
    ["single_mask_unseen_shrike", "Shrieking Shrike Mask", 500, [["AR_DHMASK_MOONFACE_HELM", 1]]],            // icon shrike_mask
    ["single_mask_unseen_riftstalker", "Sly 'Stalker Mask", 500, [["AR_DHMASK_SHADOWCAT_HELM", 1]]],          // icon riftstalker_mask
    // Lanterns, glider
    ["sku_lt_unseen_01", "Twilight's Laugh", 700, [["LT_UNSEEN_01", 1]]],
    ["single_lantern_jackolantern", "Devious Grimace", 750, [["LT_JACKOLANTERN", 1]]],
    ["sku_gd_frame_c_unseen_00", "Red-Eye", 1200, [["GD_FRAME_C_UNSEEN_00", 1]]],                 // the only Unseen glider
    // Bloodshot weapons
    ["sku_wp_eb_unseen_01", "Bloodshot Fang", 1200, [["WP_EB_UNSEEN_01", 1]]],
    ["sku_wp_ms_unseen_01", "Bloodshot Claw", 1200, [["WP_MS_UNSEEN_01", 1]]],
    ["sku_wp_cb_unseen_01", "Bloodshot Barbs", 1200, [["WP_CB_UNSEEN_01", 1]]],
    ["sku_wp_dp_unseen_01", "Bloodshot Snappers", 1200, [["WP_DP_UNSEEN_01", 1]]],
    ["sku_wp_ga_unseen_01", "Bloodshot Beheader", 1200, [["WP_GA_UNSEEN_01", 1]]],
    ["sku_wp_ih_unseen_01", "Bloodshot Biter", 1200, [["WP_IH_UNSEEN_01", 1]]],
    ["sku_wp_ac_unseen_01", "Bloodshot Sockets", 1200, [["WP_AC_UNSEEN_01", 1]]],
    // Flares
    ["single_flare_event_unseen", "Unseen Legend", 500, [["QI_FLARE_UNSEEN_01", 1]]],
    ["mng_qi_flare_event_dark19_00", "Callous Cacophony", 500, [["QI_FLARE_EVENT_DARK19_00", 1]]],
    ["single_flare_pumpkin", "Dark Harvest Pumpkin Flare", 250, [["QI_FLARE_EVENT_DARK17_000", 1]]],
    ["sku_qi_flare_unseen_02", "Bloodshot Eye (Flare)", 250, [["QI_FLARE_UNSEEN_02", 1]]],
    // Banner
    ["sku_bnc_standard_unseen_01", "Bloodshot Standard", 100, [["BNC_STANDARD_UNSEEN_01", 1]]],
    ["sku_bnc_animation_unseen_01", "Unseen Curse", 700, [["BNC_ANIMATION_UNSEEN_01", 1]]],                   // ? or BNC_ANIMATION_HP07B_UNSEEN_00
    ["sku_bnc_sigil_unseen_01", "Bloodshot Eye (Sigil)", 100, [["BNC_SIGIL_UNSEEN_01", 1]]],
    ["sku_bnc_fabric_event_unseen_01", "Bloodshot Banner", 200, [["BNC_FABRIC_EVENT_UNSEEN_01", 1]]],
    ["single_fabric_darkharvest_stitched", "Stitched Harvest Fabric", 100, [["BNC_FABRIC_EVENT_DARK17_000", 1]]],
    // Supplies (bought again and again)
    ["sku_notes_event", "1000 Rams", 50, [["CURRENCY_NOTES", 1000]]],
    ["sku_key_event", "Patrol Key", 300, [["TOKEN_DAILY_PATROL_BONUS_PURCHASED", 1]]],
    ["sku_merits_event", "5 Combat Merits", 100, [["CURRENCY_PJM_WEAPON", 5]]],
    ["sku_bounty_event", "Bounty Token", 150, [["TOKEN_BOUNTY_DRAFT", 1]]],
    ["sku_sparks_event", "5 Aethersparks", 100, [["CURRENCY_PJM_PRESTIGE_EMPTY", 5]]],
    ["sku_consumables1_event", "Tonic Pack", 200, [["QI_LANTERN_POTION", 5], ["QI_ATTACK_SPEED_POTION", 5], ["QI_DAMAGE_ENRAGEBONUS_POTION", 5]]],
    ["sku_consumables2_event", "15 Bulwark Tonics", 200, [["QI_DAMAGE_BLOCK_POTION", 15]]],
    // Style
    ["prestige_dye_nightshade_durable", "Nightshade (Dye)", 1000, [["DYE_NIGHTSHADE_DURABLE", 1]]],
    ["sku_bundle_ej_strega_00", "Granny Strega Emoji Pack", 200, [["EJ_STREGA_00", 1], ["EJ_STREGA_01", 1], ["EJ_STREGA_02", 1], ["EJ_STREGA_03", 1], ["EJ_STREGA_04", 1]]],
    // MNG stand-ins for the rumour quests (see header)
    ["sku_wp_eb_unseen_00", "Hidden Fang", 1200, [["WP_EB_UNSEEN_00", 1]]],
    ["sku_wp_ms_unseen_00", "Overbitten", 1200, [["WP_MS_UNSEEN_00", 1]]],
    ["sku_wp_cb_unseen_00", "Eye Teeth", 1200, [["WP_CB_UNSEEN_00", 1]]],
    ["sku_wp_dp_unseen_00", "Dread Snappers", 1200, [["WP_DP_UNSEEN_00", 1]]],
    ["sku_wp_ga_unseen_00", "Blind Beheader", 1200, [["WP_GA_UNSEEN_00", 1]]],
    ["sku_wp_ih_unseen_00", "Backbiter", 1200, [["WP_IH_UNSEEN_00", 1]]],
    ["sku_wp_ac_unseen_00", "Broken Sockets", 1200, [["WP_AC_UNSEEN_00", 1]]],
    ["sku_lt_1p_unseen", "Grinning Rictus", 700, [["LT_1P_UNSEEN", 1]]],
    ["sku_bnc_fabric_1p_unseen", "Blind Obedience", 200, [["BNC_FABRIC_1P_UNSEEN", 1]]],
    ["sku_bnc_standard_1p_unseen", "Triclops Standard", 100, [["BNC_STANDARD_1P_UNSEEN", 1]]],
    ["sku_qi_flare_unseen_00", "Unseen Flare", 500, [["QI_FLARE_UNSEEN_00", 1]]],
];

// Descriptions from the same wiki table (the client catalog has none for most event items: the details box stood empty).
const WIKI_DESCRIPTIONS = {
    "Unseen Flare": "A signal flare bearing the mark of the Unseen. A Dark Harvest rumour reward.",
    "Be On Your Gourd (Transform)": "Consumable. Each use transforms you into a delightful Dark Harvest pumpkin. The effect is cancelled by moving. 5 charges per purchase.",
    "Unseen Beacon (Sparkler)": "Many cultures make similar fireworks, but only the secretive Unseen cult have figured out how to add strange ciphers and a series of bats. 10 charges per purchase.",
    "Sinister Squash (Sparkler)": "Consumable. Deploy in city or island for a shower of Dark Harvest themed sparks and bats! 10 charges per purchase.",
    "Midnight Observer (Transform)": "Consumable. Each use transforms you into a mysterious creature. The effect is cancelled by moving. 3 charges per purchase.",
    "Shady Shrowd Mask": "Embrace that which others fear—while entertaining friends, neighbours and curious passerby—with the Shrowd's ominous visage.",
    "Shrieking Shrike Mask": "It's a sound no one forgets and a disguise no Ramsgate aesthete will want to miss.",
    "Sly 'Stalker Mask": "A frequent festive favourite of cool cats and killer kittens.",
    "Twilight's Laugh": "Cast sanguine light into the shadows.",
    "Red-Eye": "Mysterious Unseen Glider.",
    "Bloodshot Fang": "A curious and deadly new faction of the Unseen has made themselves known. You're unsure who is selling these deadly weapon skins, but you do know they won't be here for long.",
    "Bloodshot Claw": "A curious and deadly new faction of the Unseen has made themselves known. You're unsure who is selling these deadly weapon skins, but you do know they won't be here for long.",
    "Bloodshot Barbs": "A curious and deadly new faction of the Unseen has made themselves known. You're unsure who is selling these deadly weapon skins, but you do know they won't be here for long.",
    "Bloodshot Snappers": "A curious and deadly new faction of the Unseen has made themselves known. You're unsure who is selling these deadly weapon skins, but you do know they won't be here for long.",
    "Bloodshot Beheader": "A curious and deadly new faction of the Unseen has made themselves known. You're unsure who is selling these deadly weapon skins, but you do know they won't be here for long.",
    "Bloodshot Biter": "A curious and deadly new faction of the Unseen has made themselves known. You're unsure who is selling these deadly weapon skins, but you do know they won't be here for long.",
    "Bloodshot Sockets": "A curious and deadly new faction of the Unseen has made themselves known. You're unsure who is selling these deadly weapon skins, but you do know they won't be here for long.",
    "Unseen Legend": "The spectacularly unsettling symbol of the enigmatic Unseen cult.",
    "Callous Cacophony": "A gift from the Unseen.",
    "Dark Harvest Pumpkin Flare": "Get in the festive spirit with this Pumpkin Flare. Available for a limited time only.",
    "Devious Grimace": "Crudely carved from Dark Harvest gourds to inspire mischief and fright.",
    "Bloodshot Standard": "The all seeing standard of the Bloodshot coven.",
    "Unseen Curse": "Out of sight, in your mind.",
    "Bloodshot Banner": "The fabric falls like night itself.",
    "Stitched Harvest Fabric": "A grisly banner held together with crude stitches. Available for a limited time only.",
    "1000 Rams": "The namesake currency of Ramsgate.",
    "Patrol Key": "Used to recover lost treasures spread across the Shattered Isles.",
    "5 Combat Merits": "A currency used to unlock nodes in the Slayer's Path.",
    "Bounty Token": "Get more Hunt Pass progress by getting more bounties.",
    "5 Aethersparks": "Fragments of aetheric power that can be used to reforge a slayer's skill and produce an aetherheart.",
    "Tonic Pack": "A bundle of 5 Aetherdrive Tonics, 5 Blitz Tonics, and 5 Frenzy Tonics.",
    "15 Bulwark Tonics": "A protective tonic.",
    "Granny Strega Emoji Pack": "Contains 5 emojis, featuring your favourite mysterious alchemist.",
    "Bloodshot Eye (Flare)": "Show your loyalty to the Unseen in the skies above.",
    "Bloodshot Eye (Sigil)": "The sigil of the enigmatic Bloodshot coven.",
    "Nightshade (Dye)": "An aether-infused dye that may be applied to many different fabrics and surfaces.",
};

module.exports.DARK_HARVEST = { offers: OFFERS, descriptions: WIKI_DESCRIPTIONS };
if (require.main === module) {
    console.error("Run scripts/generate_event_stores.cjs: it builds every event's shop, Dark Harvest from this file's list.");
    process.exit(1);
}
