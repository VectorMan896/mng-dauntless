# MNG DAUNTLESS: seasonal events (research, 31 Oct 2026)

Sources: the Dauntless fandom wiki (read through its API: `api.php?action=parse&page=<Page>&prop=wikitext&format=json`;
pages Seasonal Events, Dark Harvest, Frostfall, Frostfall: Event Quests, Saint's Bond, Friendship Coins, Springtide,
Carrot Chips, Ramsgiving, Ramsgiving: Event Quests, Golden Rams, Honest Ozz, Linnea Silver), and our own exports of the
1.14.7 client (`Items_Analysis/catalog_1_14_7.jsonl`, `store_item_images_1_14_7.jsonl`, the runtime's `[CityEvent]`
and `[StoreProbe]` logs).

## The five events

| Event | Real-world | Dates (live game) | Currency (wiki) | Catalog id | NPCs |
|---|---|---|---|---|---|
| Dark Harvest | Halloween | mid Oct - early Nov (2023: 19 Oct - 2 Nov) | Harvest Coins | CURRENCY_EVENT_DARKHARVEST | Honest Ozz; Mysterious Notes (Unseen cipher quests) |
| Ramsgiving | Thanksgiving | mid Nov - end Nov (2023: 16 - 30 Nov) | Golden Rams | CURRENCY_EVENT_RAMSGIVING | Honest Ozz; Benson the Ram (Ramsgate plaza) |
| Frostfall | Christmas | mid Dec - early Jan | Frostfall Coins | CURRENCY_EVENT_FROSTFALL | Honest Ozz; Linnea Silver (Silver Sword questline) |
| Saint's Bond | Valentine's | February | Friendship Coins (2021: "Hearts of Rage") | CURRENCY_EVENT_SAINTSBOND | Honest Ozz; Lady Luck (2022 quests) |
| Springtide | Easter | March - April | Carrot Chips | CURRENCY_EVENT_SPRINGTIDE | Honest Ozz |

Honest Ozz (Oswaldo "Honest Ozz" Masipag) is the events trader for all of them: event quests and the event store, in
Ramsgate (and Conundrum Rocks). In 1.14.7 his shop screen is `event_store_view_model_C`, store tag `seasonal_event`,
no tabs (runtime [StoreProbe], 31 Oct).

## What 1.14.7 has for each

Ramsgate dressing: the 1.14.7 Ramsgate streams event sub-levels only for **Dark Harvest** (`city_01_event_dark_harvest`)
and **Frostfall** (`city_01_event_frostfall`), plus the shared stall (`city_01_event_stall`, Ozz) and hunt-pass dressing
(season_16a/16b/17a). Saint's Bond, Springtide and Ramsgiving have no dressing in this build: only the stall can be shown.

Store rows in the client's StoreItemsTable (SKU ids the client has art for):

| Event | Rows | Examples |
|---|---|---|
| Frostfall | 58 | single_armour_frostfall_sweater_chest_00..03, single_weapon_frostfall, event_frostfall_starter, gift_frostfall2020_day_1..12, eventpass_frostfall_* |
| Saint's Bond (romantic) | 82 | single_armour_*_romantic, quest_rumour_wp_*_romantic, contract_*_romantic, glider_frame_b_flutterheart, single_emote_hearts, event_saintsbond_gift |
| Springtide | 51 | single_armour_helm_pufflehop_00/01, single_pet_pufflehop_spring, single_toy_*_springtide2021, sku_rumour_wp_cb_springtide_01..03, quest_rumour_wp_cb/dp_event_spring_00, event_springtide_starter |
| Ramsgiving | 42 | single_armour_ramsgiving(2020)_helm, single_weapon_ramsgiving(2020)_hammer, sku_gd_frame_c_ramsgiving_00, sku_bundle_ej_benson_00, single_toy_*_ramsgiving2020, event_ramsgiving_starter |
| Midsommar (summer; not on the wiki's event list) | 18 | sku_wp_*_event_midsommar_00 (7 weapons), sku_ar_event_midsommar_* (armour set), sku_gd_frame_a_midsommar_00, sku_title_event_midsommar_00 |

## Dark Harvest (done: see CHANGELOG-MNG.md)

- Earning: Unseen Summons event hunt (Shrowd + 8 braziers; Nevermore difficulty with Bloodshot Shrowd), breaking
  Behemoth parts (bonus for Umbral), Shrowd Effigies on the islands. 2023 also: cipher quests at the Mysterious Notes,
  Unseen gifts hidden in Ramsgate unlock rumours (Unseen weapon skins), free Unseen Neophyte event pass.
- Rewards: The Unseen Crown (7 of 8 braziers lit, Nevermore), titles The Reaper / Lord of Shadow / The Unseen Eternal.
- Ozz's store: 36 items, list and prices in `ParadoxBackend/scripts/generate_event_store.cjs` (served).
- Store (platinum): Dark Harvest Starter Kit (300 Harvest Coins + Oculus Umbra lantern), Unseen armour bundle.

## Frostfall

- Earning: Ozz's event quests (below); Snowball Fight and Snowforts island events (Coldrunner Key, The Snowblind
  Waste); Farslayer Gifts on the islands (10 coins each, respawn on island reload); breaking a part on Frostmarch,
  Coldrunner Key, The Snowblind Waste or Vylmark (1 drop per Behemoth, more on higher islands).
- Event hunt: The Cheerless Charrogg.
- Quests (Ozz): I The Fall of Frost (collect 25 coins from part breaks; 10 coins + 250 Rams), II The Gift of Giving
  (share a Frostfall Gift; 20 + 500), III The Joys of Commerce (spend 50 coins; 30 + 750), IV The Cheer of Slayers
  (concoct a Gift of Explosive Cheer with Granny Strega, finish The Cheerless Charrogg; 40 + 1000), V The Spirit of
  Competition (finish a snowball island event; 50 + 1500 + Champion of Frostfall Present). Next: Rumour: Crown of Good Cheer.
- Linnea Silver: the Silver Sword questline (needs the Reforge node and a crafted Hypothermica); rewards the Legendary
  Silver Sword, the Frostfall Crown and the title The Silver Sword.
- Ozz's store (Frostfall Coins):

| Item | Type | Price |
|---|---|---|
| Exquisite Frostfall Gift | Curiosity (random Frostfall curiosity, restocks hourly) | 50 |
| Frostfall Gift | Curiosity (restocks hourly) | 25 |
| Bells of Winter | Helm transmog | 1500 |
| Frostfall Bells | Helm transmog | 1500 |
| Sweet Skates Sweater | Armour transmog | 1500 |
| The Gateway Sweater | Armour transmog | 1200 |
| Cheer Up, Charrogg! Sweater | Armour transmog | 1200 |
| Silver's Softest Sweater | Armour transmog | 960 |
| Nine Pups a-Puppin' | Armour transmog | 960 |
| Warlord's Winter Wool | Armour transmog | 960 |
| Two Gnashers Gnashing | Armour transmog | 720 |
| Three Rams a-Ramming | Armour transmog | 720 |
| Twelve Flakes a-Falling | Armour transmog | 720 |
| Frostfall Chainblades / Repeaters / Axe / Hammer / Strikers / War Pike / Sword | Weapon transmogs | 1200 each |
| Frostfall Mittens | Strikers transmog | 1200 |
| Winter Cap | Lantern transmog | 1200 |
| Mistletoe Lantern | Lantern transmog | 720 |
| Crystal Lantern | Lantern transmog | 720 |
| Stay Frosty | Arrival emote | 1125 |
| Let It Snowball | Emote | 900 |
| Be Of Good Cheer! | Emote | 675 |
| 25 Weapon Tokens | Currency (one-time) | 750 |
| Frostwings | Glider | 600 |
| Arctic | Dye | 500 |
| Silver Star | Flare | 300 |
| Northern Pole | Banner standard | 180 |
| Flagstaff of the Frostwarden-General | Banner standard | 180 |
| Rams, Patrol Keys, Combat Merits, Bounty Tokens, Aethersparks, tonics | Supplies | (as Dark Harvest) |

- Store (platinum, 2023): Frostfall Starter Kit (Winter's Bite lantern + 300 Frostfall Coins), Silver Nikola armour,
  Holiday Calendar offers 1 - 24 Dec.

## Ramsgiving

- Earning (2021-2023): King Gruk's Rampage event mission (from 2022), breaking Behemoth heads/horns (2021: 2/5/10 coins
  at 80/15/5 %, high-level islands only), Gruk-Gruk Rumble island event on Conundrum Rocks (15), bounties (2020-21:
  1-3, then 5 each), daily coin flip (2020: 5; it also gave 4-6 extra bounty tokens).
- Quests (Ozz, then Benson the Ram): I Ram Slam (break 5 heads/horns), II Ozz's Shop (spend 50), III Curiosities (use 3
  Gift of Giving), IV A Very Hungry Ram (visit Benson), V Rampage (finish King Gruk's Rampage); each 1000 Rams, 200
  weapon XP, 20 Golden Rams. VI Rivalry (removed 2023) gave the Ramsgiving Crown, sold by Ozz for 4000 from 2023.
  Feeding Time: repeatable, uses a Bundle of Ram Food from Ozz.
- 2021: five "ramslators" by the rams in Ramsgate unlocked the rumour Benson's Battleblasters.
- Ozz's store: Benson-themed curiosities and cosmetics, the Ramsgiving Crown (4000), supplies. No price list on the wiki.
- Store (platinum): Desperado, Ramsguard Scout and Ramsguard Commander sets; Good King Benson and Ram-At-Arms Disguise
  helms; Wham, Bam, Thank You Ram arrival emote; Ramsgiving Starter Pack (Benson, Battle Buddy lantern + 300 Golden Rams).

## Saint's Bond

- Earning (Friendship Coins): bounties 20, daily coin flip 50, part break 5 (10 during enrage).
- 2020: 7 contracts, 2021-22: 7 rumours: slay 60 Behemoths with a weapon type (30 with a friend) for that weapon's
  Saint's Bond skin (the romantic weapon set).
- 2021-22: Bonds of Honour event pass (10 levels). 2022: 4 Lady Luck quests -> Heartgem Crown. Double Slayer Link XP.
- Ozz's store: Saint's Bond curiosities, Flower Power emote, Saint's Gift fabric, Gift of Naming (100 coins, limit 3;
  grants 1 of 9 titles to whoever uses it), emojis, banner items, a flare. No price list on the wiki.

## Springtide

- Earning (Carrot Chips): Pufflehop Rescue event hunt (eggs, herding pufflehops, fending off styxians; chips by
  performance) and its quest (100), any hunt (2020: 50), Escalations (2021: 50), part breaks (10, max 5 per Behemoth;
  2023+: Neutral or Terra only). Wearing Puffletoppers / Ruffletoppers / Fluffletoppers doubles the chips.
- Rumours: Pufflepoppers (repeaters), Pufflecroppers (chain blades); 2023 rumours give 10 % off the store skin per step.
- Quest: Springtime Eggventures -> Egg Head head accessory and title (Egg Head / Hard Boiled).
- 2023: The Golden Claws event weapon; Springtide Starter Kit (Spark of Genius lantern + 300 Carrot Chips).
- Ozz's store: Springtide cosmetics (Puffletoppers etc.). No price list on the wiki.

## What MNG serves (31 Oct)

| Event | Calendar | Hunt pay | Ozz's shop | Ramsgate |
|---|---|---|---|---|
| Dark Harvest | 14 Oct - 7 Nov | 100 Harvest Coins | 46 (wiki list and prices) | dressing + stall |
| Ramsgiving | 16 Nov - 1 Dec | 100 Golden Rams | 33 (client rows, Crown 4000) | stall |
| Frostfall | 9 Dec - 6 Jan | 100 Frostfall Coins | 42 (wiki list and prices) | dressing + stall |
| Saint's Bond | 6 - 20 Feb | 100 Friendship Coins | 51 (client rows) | stall |
| Springtide | 26 Mar - 23 Apr | 100 Carrot Chips | 21 (client rows) | stall |
| Midsommar | 3 Aug - 14 Sep | none | 18 for Rams (Midsommar Madness items) | stall |

Calendars: ParadoxBackend/src/seasonalEvents.ts (server), scripts/mng-seasonal-events.mjs (Game.ini), ParadoxLauncher/src/lib/
seasonalEvent.ts (launcher art). Shops: ParadoxBackend/scripts/generate_event_stores.cjs. The launcher notices carry the
running event (src/seasonalEvents.ts SeasonalEventNotice).

Event hunts present in the 1.14.7 tables but not offered by the client: Unseen Summons, King Gruk, Anniversary, Pufflehop
Rescue, a Charrogg entry (TODO-MNG.md). Not served: island events, quests, rumours, the Silver Sword questline.
