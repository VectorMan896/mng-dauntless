#!/usr/bin/env node
/*
 * MNG DAUNTLESS: saves and restores the server database (accounts, characters, inventories, progress, ...) with the
 * backend's own MongoDB driver, so no MongoDB tools need to be installed. Used by the server pack and the installer.
 *
 *   node scripts/mng-database.cjs export <folder>        writes one <collection>.jsonl per collection + _collections.json
 *   node scripts/mng-database.cjs import <folder>        REPLACES the database with the saved one
 *   node scripts/mng-database.cjs count                  prints the number of accounts and documents (0 = empty)
 *   node scripts/mng-database.cjs init-replica           makes the local MongoDB a one-member replica set "rs0"
 *
 * The connection is read from ParadoxBackend/.env (MONGODB_URI, MONGODB_DB). Documents are stored as MongoDB
 * Extended JSON, which keeps dates, ids and binary data exact.
 */
const fs = require("node:fs");
const path = require("node:path");
const { MongoClient } = require("mongodb");
const { EJSON } = require("bson");

const BackendRoot = path.resolve(__dirname, "..");

function ReadEnv() {
    const file = path.join(BackendRoot, ".env");
    const values = {};
    if (!fs.existsSync(file)) return values;
    for (const line of fs.readFileSync(file, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (!m) continue;
        values[m[1]] = m[2].trim().replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
    }
    return values;
}

const Env = ReadEnv();
const Uri = process.env.MONGODB_URI || Env.MONGODB_URI || "mongodb://127.0.0.1:27017/?replicaSet=rs0";
const DbName = process.env.MONGODB_DB || Env.MONGODB_DB || "mngdauntless";

async function Connect(uri = Uri) {
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 15000 });
    await client.connect();
    return client;
}

async function Export(folder) {
    fs.mkdirSync(folder, { recursive: true });
    const client = await Connect();
    try {
        const db = client.db(DbName);
        const collections = (await db.listCollections({}, { nameOnly: false }).toArray())
            .filter((c) => c.type === "collection" && !c.name.startsWith("system."));
        const info = { database: DbName, exportedAt: new Date().toISOString(), collections: [] };
        let total = 0;
        for (const c of collections) {
            const out = fs.openSync(path.join(folder, `${c.name}.jsonl`), "w");
            let count = 0;
            for await (const doc of db.collection(c.name).find({})) {
                fs.writeSync(out, EJSON.stringify(doc, { relaxed: false }) + "\n");
                count++;
            }
            fs.closeSync(out);
            const indexes = (await db.collection(c.name).indexes()).filter((i) => i.name !== "_id_");
            info.collections.push({ name: c.name, options: c.options ?? {}, indexes, count });
            total += count;
        }
        fs.writeFileSync(path.join(folder, "_collections.json"), EJSON.stringify(info, null, 2, { relaxed: false }));
        console.log(`Saved database "${DbName}": ${collections.length} collections, ${total} documents -> ${folder}`);
    } finally {
        await client.close();
    }
}

async function Import(folder) {
    const infoFile = path.join(folder, "_collections.json");
    if (!fs.existsSync(infoFile)) throw new Error(`No saved database in ${folder} (_collections.json missing)`);
    const info = EJSON.parse(fs.readFileSync(infoFile, "utf8"), { relaxed: false });
    const client = await Connect();
    try {
        const db = client.db(DbName);
        await db.dropDatabase();
        let total = 0;
        for (const c of info.collections) {
            await db.createCollection(c.name, c.options ?? {});
            const collection = db.collection(c.name);
            const file = path.join(folder, `${c.name}.jsonl`);
            let batch = [];
            const flush = async () => {
                if (batch.length) await collection.insertMany(batch, { ordered: true });
                total += batch.length;
                batch = [];
            };
            if (fs.existsSync(file)) {
                for (const line of fs.readFileSync(file, "utf8").split("\n")) {
                    if (!line.trim()) continue;
                    batch.push(EJSON.parse(line, { relaxed: false }));
                    if (batch.length >= 1000) await flush();
                }
            }
            await flush();
            for (const index of c.indexes ?? []) {
                const { key, v, ns, ...options } = index;
                await collection.createIndex(key, options);
            }
        }
        console.log(`Restored database "${DbName}": ${info.collections.length} collections, ${total} documents (saved ${info.exportedAt}).`);
    } finally {
        await client.close();
    }
}

async function Count() {
    const client = await Connect();
    try {
        const db = client.db(DbName);
        let total = 0;
        for (const c of await db.listCollections({}, { nameOnly: true }).toArray()) {
            total += await db.collection(c.name).estimatedDocumentCount();
        }
        const accounts = (await db.listCollections({ name: "accounts" }).toArray()).length
            ? await db.collection("accounts").countDocuments() : 0;
        console.log(JSON.stringify({ database: DbName, accounts, documents: total }));
    } finally {
        await client.close();
    }
}

async function InitReplica() {
    const sleep = (ms) => new Promise((ok) => setTimeout(ok, ms));
    let client;
    // MongoDB may still be starting after a service restart.
    for (let attempt = 0; ; attempt++) {
        try { client = await Connect("mongodb://127.0.0.1:27017/?directConnection=true"); break; }
        catch (e) { if (attempt >= 20) throw e; await sleep(1500); }
    }
    try {
        const admin = client.db("admin");
        try {
            const status = await admin.command({ replSetGetStatus: 1 });
            console.log(`Replica set already set up: ${status.set} (${status.members.map((m) => m.stateStr).join(", ")})`);
            return;
        } catch (e) {
            if (/not running with --replSet/i.test(e.message)) throw new Error("MongoDB is not started with a replica set (replication: replSetName: rs0 missing from mongod.cfg).");
            if (!/no replset config|NotYetInitialized/i.test(e.message + " " + (e.codeName ?? ""))) throw e;
        }
        await admin.command({ replSetInitiate: { _id: "rs0", members: [{ _id: 0, host: "127.0.0.1:27017" }] } });
        for (let i = 0; i < 60; i++) {
            const s = await admin.command({ replSetGetStatus: 1 });
            if (s.members.some((m) => m.stateStr === "PRIMARY")) { console.log("Replica set rs0 is ready."); return; }
            await sleep(1000);
        }
        throw new Error("The replica set did not become ready within a minute.");
    } finally {
        await client.close();
    }
}

const [, , Command, Folder] = process.argv;
const Run = { export: () => Export(path.resolve(Folder)), import: () => Import(path.resolve(Folder)), count: Count, "init-replica": InitReplica }[Command];
if (!Run || ((Command === "export" || Command === "import") && !Folder)) {
    console.error("usage: node scripts/mng-database.cjs export|import <folder> | count | init-replica");
    process.exit(1);
}
Run().catch((e) => { console.error(`Database ${Command} failed: ${e.message}`); process.exit(1); });
