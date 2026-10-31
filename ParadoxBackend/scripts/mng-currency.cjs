#!/usr/bin/env node
/*
 * [MNG DAUNTLESS 2026-10-31] Operator tool: look at and change a player's currencies (Player-Currency.bat runs it on the server
 * PC). Works on the live database; the player's game picks the new balance up on its next balance check (it polls), no restart.
 *
 *   node scripts/mng-currency.cjs                                  interactive (asks for player, currency, amount)
 *   node scripts/mng-currency.cjs list                             every player with their main balances
 *   node scripts/mng-currency.cjs show <player>                    every balance of one player
 *   node scripts/mng-currency.cjs give <player> <currency> <n>     add n (negative n takes away; never below 0)
 *   node scripts/mng-currency.cjs set  <player> <currency> <n>     set the balance to n
 *   <player>: the account's display name (any case) or its user id. "all" = every player (give/set only).
 *   <currency>: a short name below or a full CURRENCY_* id.
 *
 * Every change is written to the console and appended to ParadoxBackend/logs/currency-changes.log.
 */
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline/promises");
const { MongoClient } = require("mongodb");

const BackendRoot = path.resolve(__dirname, "..");

const SHORT = {
    rams: "CURRENCY_NOTES",
    platinum: "CURRENCY_PLATINUM_UNIV",
    cachecoins: "CURRENCY_SEASONAL_COIN",
    darkharvest: "CURRENCY_EVENT_DARKHARVEST",
    frostfall: "CURRENCY_EVENT_FROSTFALL",
    saintsbond: "CURRENCY_EVENT_SAINTSBOND",
    springtide: "CURRENCY_EVENT_SPRINGTIDE",
    ramsgiving: "CURRENCY_EVENT_RAMSGIVING",
    celldust: "CURRENCY_CELLDUST",
    gilded: "CURRENCY_MARKS_GILDED",
    steel: "CURRENCY_MARKS_STEEL",
    merit: "CURRENCY_PJM_WEAPON",
};
const MAIN = ["rams", "platinum", "cachecoins", "darkharvest"];

function ReadEnv() {
    const file = path.join(BackendRoot, ".env");
    const values = {};
    if (!fs.existsSync(file)) return values;
    for (const line of fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) values[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
    return values;
}
const Env = ReadEnv();
const Uri = process.env.MONGODB_URI || Env.MONGODB_URI || "mongodb://127.0.0.1:27017/?replicaSet=rs0";
const DbName = process.env.MONGODB_DB || Env.MONGODB_DB || "mngdauntless";

function CurrencyId(name) {
    const key = String(name ?? "").trim();
    const id = SHORT[key.toLowerCase()] ?? key.toUpperCase();
    if (id === "CURRENCY_PLATINUM") throw new Error("Use \"platinum\" (CURRENCY_PLATINUM_UNIV): CURRENCY_PLATINUM is only the total of the platinum buckets.");
    if (!/^CURRENCY_[A-Z0-9_]{1,100}$/.test(id)) throw new Error(`Unknown currency "${name}". Short names: ${Object.keys(SHORT).join(", ")}, or a CURRENCY_* id.`);
    return id;
}

function Amount(text) {
    const n = Number(text);
    if (!Number.isSafeInteger(n)) throw new Error(`"${text}" is not a whole number.`);
    return n;
}

function PlatinumTotal(balances) {
    return Object.entries(balances ?? {}).filter(([k]) => k.startsWith("CURRENCY_PLATINUM_")).reduce((s, [, v]) => s + (Number(v) || 0), 0);
}

async function Players(db, who) {
    const accounts = db.collection("accounts");
    if (String(who).toLowerCase() === "all") return accounts.find({}).toArray();
    const found = await accounts.findOne({ $or: [{ userId: who }, { displayNameNormalized: String(who).toLowerCase() }] });
    if (!found) throw new Error(`No player "${who}". Run "list" to see the names.`);
    return [found];
}

function Log(line) {
    const dir = path.join(BackendRoot, "logs");
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, "currency-changes.log"), `${new Date().toISOString()} ${line}\n`);
    console.log(line);
}

async function Change(db, mode, who, currencyName, amountText) {
    const currency = CurrencyId(currencyName);
    const amount = Amount(amountText);
    if (mode === "set" && amount < 0) throw new Error("A balance cannot be set below 0.");
    const wallets = db.collection("wallets");
    for (const player of await Players(db, who)) {
        const id = player.userId;
        const wallet = await wallets.findOne({ _id: id });
        if (!wallet) { console.log(`${player.displayName}: has no wallet yet (never logged in) - skipped`); continue; }
        const before = Number(wallet.balances?.[currency] ?? 0);
        const after = mode === "set" ? amount : Math.max(0, before + amount);
        // Conditional on the balance read, so a purchase in between is never overwritten: retry once with the fresh value.
        const res = await wallets.updateOne({ _id: id, [`balances.${currency}`]: wallet.balances?.[currency] ?? { $exists: false } },
            { $set: { [`balances.${currency}`]: after } });
        if (res.modifiedCount === 0 && before !== after) {
            console.log(`${player.displayName}: balance changed while editing, try again`);
            continue;
        }
        Log(`${mode} ${player.displayName} (${id}) ${currency}: ${before} -> ${after}`);
    }
}

async function List(db) {
    const wallets = new Map((await db.collection("wallets").find({}).toArray()).map((w) => [w._id, w.balances ?? {}]));
    const rows = (await db.collection("accounts").find({}).toArray()).map((a) => {
        const b = wallets.get(a.userId) ?? {};
        return [a.displayName, ...MAIN.map((k) => k === "platinum" ? PlatinumTotal(b) : Number(b[SHORT[k]] ?? 0))];
    });
    console.log(["player", ...MAIN].map((h, i) => i ? h.padStart(12) : h.padEnd(24)).join(""));
    for (const r of rows) console.log(r.map((v, i) => i ? String(v).padStart(12) : String(v).padEnd(24)).join(""));
}

async function Show(db, who) {
    for (const player of await Players(db, who)) {
        const wallet = await db.collection("wallets").findOne({ _id: player.userId });
        console.log(`${player.displayName} (${player.userId})`);
        for (const [k, v] of Object.entries(wallet?.balances ?? {}).sort()) console.log(`  ${k.padEnd(40)} ${v}`);
        console.log(`  ${"(platinum total)".padEnd(40)} ${PlatinumTotal(wallet?.balances)}`);
    }
}

async function Interactive(db) {
    await List(db);
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    try {
        console.log(`\nCurrencies: ${Object.keys(SHORT).join(", ")} (or a CURRENCY_* id)`);
        const who = (await rl.question("Player name (or all): ")).trim();
        const currency = (await rl.question("Currency: ")).trim();
        const mode = (await rl.question("Give (g) or set (s)? [g]: ")).trim().toLowerCase().startsWith("s") ? "set" : "give";
        const amount = (await rl.question(mode === "set" ? "New balance: " : "Amount (negative takes away): ")).trim();
        await Change(db, mode, who, currency, amount);
    } finally {
        rl.close();
    }
}

(async () => {
    const [cmd, ...rest] = process.argv.slice(2);
    const client = new MongoClient(Uri, { serverSelectionTimeoutMS: 15000 });
    await client.connect();
    try {
        const db = client.db(DbName);
        if (!cmd) await Interactive(db);
        else if (cmd === "list") await List(db);
        else if (cmd === "show" && rest.length === 1) await Show(db, rest[0]);
        else if ((cmd === "give" || cmd === "set") && rest.length === 3) await Change(db, cmd, ...rest);
        else throw new Error("Usage: list | show <player> | give <player> <currency> <n> | set <player> <currency> <n>");
    } finally {
        await client.close();
    }
})().catch((err) => {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
});
