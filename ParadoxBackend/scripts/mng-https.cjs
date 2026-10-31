#!/usr/bin/env node
/*
 * [MNG DAUNTLESS 2026-10-31] HTTPS for the server: a free Let's Encrypt certificate for the server's own name (a subdomain of
 * the owner's domain, for example play.example.com, whose DNS "A" record points at this PC's public address). Set-Up-HTTPS.bat
 * runs "setup" once; Start-Server runs "renew" on every start, before the backend starts.
 *
 *   node scripts/mng-https.cjs setup [--domain play.example.com] [--email you@example.com] [--staging]
 *   node scripts/mng-https.cjs renew      renews the certificate when it has less than 30 days left (nothing to do when HTTPS
 *                                         was never set up)
 *   node scripts/mng-https.cjs status
 *
 * Proof of the name (Let's Encrypt "http-01"): Let's Encrypt fetches http://<domain>/.well-known/acme-challenge/<token> on TCP
 * port 80 of this PC, which this script answers itself for that minute. Port 80 must reach this PC (the region-ping port: it is
 * already open on a server players can use) and be free, so the backend must be stopped (setup checks; Start-Server renews
 * before starting it).
 *
 * Files: Mystic-Paradox\certs\ (fullchain.pem, privkey.pem, account.pem; never published). Settings written to
 * ParadoxBackend\.env: MNG_DOMAIN, HTTPS_PORT=443, PARADOX_CERT_PEM_PATH, PARADOX_KEY_PEM_PATH, PARADOX_KEY_PASSPHRASE (empty),
 * MYSTICPARADOX_TLS_TERMINATED_BY_PROXY=off, UPDATE_PUBLIC_BASE_URL=https://<domain>, REALTIME_XMPP_ALLOWED_HOSTS (+ the domain).
 * Players reach the backend on https://<domain> (TCP 443: open it on the router; Set-Up-HTTPS.bat adds the Windows rule).
 */
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const dns = require("node:dns/promises");
const crypto = require("node:crypto");
const readline = require("node:readline/promises");
const acme = require("acme-client");

const BackendRoot = path.resolve(__dirname, "..");
const EnvPath = path.join(BackendRoot, ".env");
const CertDir = path.resolve(BackendRoot, "..", "certs");
const Files = { chain: path.join(CertDir, "fullchain.pem"), key: path.join(CertDir, "privkey.pem"), account: path.join(CertDir, "account.pem") };
const RENEW_DAYS = 30;

function Arg(name) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 ? process.argv[i + 1] : undefined;
}

// ---- .env ----
function ReadEnv() {
    const values = {};
    if (!fs.existsSync(EnvPath)) return values;
    for (const line of fs.readFileSync(EnvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
        if (m) values[m[1]] = m[2].trim();
    }
    return values;
}

// Sets every uncommented KEY= line (or appends one) and keeps the rest of the file as it is. No BOM.
function SetEnv(pairs) {
    let lines = fs.existsSync(EnvPath) ? fs.readFileSync(EnvPath, "utf8").replace(/^﻿/, "").split(/\r?\n/) : [];
    for (const [key, value] of Object.entries(pairs)) {
        let found = false;
        lines = lines.map((line) => {
            if (new RegExp(`^\\s*${key}\\s*=`).test(line)) { found = true; return `${key}=${value}`; }
            return line;
        });
        if (!found) lines.push(`${key}=${value}`);
    }
    fs.writeFileSync(EnvPath, lines.join("\r\n").replace(/(\r\n)*$/, "\r\n"), "utf8");
}

// ---- the http-01 answer on port 80 ----
function ServeChallenges(answers) {
    return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
            const token = (req.url ?? "").split("/.well-known/acme-challenge/")[1];
            const answer = token ? answers.get(token) : undefined;
            res.writeHead(answer ? 200 : 404, { "content-type": "text/plain" });
            res.end(answer ?? "");
        });
        server.once("error", (err) => reject(err.code === "EADDRINUSE"
            ? new Error("Port 80 is in use: stop the server first (Stop-Server.bat), then run this again")
            : err));
        server.listen(80, () => resolve(server));
    });
}

// ---- certificate ----
function CertExpiry() {
    if (!fs.existsSync(Files.chain)) return undefined;
    try {
        return new Date(new crypto.X509Certificate(fs.readFileSync(Files.chain)).validTo);
    } catch {
        return undefined;
    }
}

function DaysLeft(date) {
    return date ? Math.floor((date.getTime() - Date.now()) / 86400000) : -1;
}

async function Issue(domain, email, staging) {
    fs.mkdirSync(CertDir, { recursive: true });
    if (!fs.existsSync(Files.account)) fs.writeFileSync(Files.account, await acme.crypto.createPrivateKey());
    const client = new acme.Client({
        directoryUrl: staging ? acme.directory.letsencrypt.staging : acme.directory.letsencrypt.production,
        accountKey: fs.readFileSync(Files.account),
    });
    const answers = new Map();
    const server = await ServeChallenges(answers);
    try {
        const [key, csr] = await acme.crypto.createCsr({ commonName: domain });
        console.log(`Asking Let's Encrypt${staging ? " (staging: a test certificate)" : ""} for a certificate for ${domain}...`);
        const cert = await client.auto({
            csr,
            email: email || undefined,
            termsOfServiceAgreed: true,
            challengePriority: ["http-01"],
            skipChallengeVerification: true,   // our own check from inside the router often fails (no NAT loopback)
            challengeCreateFn: async (_authz, challenge, keyAuthorization) => { answers.set(challenge.token, keyAuthorization); },
            challengeRemoveFn: async (_authz, challenge) => { answers.delete(challenge.token); },
        });
        fs.writeFileSync(Files.key, key);
        fs.writeFileSync(Files.chain, cert);
        console.log(`Certificate saved (valid until ${CertExpiry()?.toISOString().slice(0, 10)}).`);
    } catch (err) {
        throw new Error(`${err.message}\n  Check: the DNS record of ${domain} points at this PC's public address, and TCP port 80 of the router `
            + "reaches this PC.");
    } finally {
        server.close();
    }
}

function HttpsSettings(domain, env) {
    const hosts = new Set(String(env.REALTIME_XMPP_ALLOWED_HOSTS ?? "localhost,127.0.0.1").split(",").map((h) => h.trim()).filter(Boolean));
    hosts.add(domain);
    return {
        MNG_DOMAIN: domain,
        HTTPS_PORT: "443",
        PARADOX_CERT_PEM_PATH: Files.chain,
        PARADOX_KEY_PEM_PATH: Files.key,
        PARADOX_KEY_PASSPHRASE: "",
        MYSTICPARADOX_TLS_TERMINATED_BY_PROXY: "off",
        UPDATE_PUBLIC_BASE_URL: `https://${domain}`,
        REALTIME_XMPP_ALLOWED_HOSTS: [...hosts].join(","),
    };
}

async function Setup() {
    const env = ReadEnv();
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = async (q, def) => ((await rl.question(def ? `${q} [${def}]: ` : `${q}: `)).trim() || def || "");
    const domain = (Arg("domain") || await ask("The server's name (the subdomain, for example play.example.com)", env.MNG_DOMAIN)).toLowerCase();
    const email = Arg("email") ?? await ask("Email for Let's Encrypt expiry warnings (optional, Enter to skip)", "");
    rl.close();
    if (!/^([a-z0-9-]+\.)+[a-z]{2,}$/.test(domain)) throw new Error(`"${domain}" is not a domain name`);

    try {
        const addresses = await dns.resolve4(domain);
        console.log(`${domain} points at ${addresses.join(", ")} (it must be this PC's public address).`);
    } catch {
        throw new Error(`${domain} has no DNS "A" record yet: add it at your domain provider (it can take a few minutes to show up)`);
    }
    await Issue(domain, email, process.argv.includes("--staging"));
    SetEnv(HttpsSettings(domain, ReadEnv()));
    console.log("");
    console.log(`HTTPS is set up for https://${domain}. Start the server (Start-Server.bat) to use it.`);
}

async function Renew() {
    const env = ReadEnv();
    if (!env.MNG_DOMAIN) return;   // HTTPS was never set up: nothing to do
    const left = DaysLeft(CertExpiry());
    if (left > RENEW_DAYS) {
        console.log(`[HTTPS] https://${env.MNG_DOMAIN}: certificate valid for ${left} more days`);
        return;
    }
    console.log(`[HTTPS] certificate ${left < 0 ? "missing" : `ends in ${left} days`}: renewing`);
    await Issue(env.MNG_DOMAIN, "", false);
    SetEnv(HttpsSettings(env.MNG_DOMAIN, ReadEnv()));
}

function Status() {
    const env = ReadEnv();
    if (!env.MNG_DOMAIN) { console.log("HTTPS is not set up (run Set-Up-HTTPS.bat)."); return; }
    const expiry = CertExpiry();
    console.log(`Server:      https://${env.MNG_DOMAIN}`);
    console.log(`Certificate: ${expiry ? `valid until ${expiry.toISOString().slice(0, 10)} (${DaysLeft(expiry)} days)` : "missing"}`);
    console.log(`HTTPS port:  ${env.HTTPS_PORT || "(not set)"}`);
}

const cmd = process.argv[2];
(cmd === "setup" ? Setup() : cmd === "renew" ? Renew() : cmd === "status" ? Promise.resolve(Status()) : Promise.reject(new Error("Usage: setup | renew | status")))
    .catch((err) => { console.error(`Error: ${err.message}`); process.exitCode = 1; });
