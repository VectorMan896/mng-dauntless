#!/usr/bin/env node
/*
 * [MNG DAUNTLESS 2026-11-02] Reads the original Hunt Pass level tables from the local wiki copy
 * (DautlessReforged/wiki-dump/pages, template {{HuntPassTable |LvlNFree= |LvlNElite=}}) and matches every reward to a
 * 1.14.7 catalogue item. Read-only: writes a report (JSON + readable text) and changes no game data.
 *
 * USAGE (from ParadoxBackend)
 *   node scripts/wiki_huntpass_extract.cjs [--wiki <pages dir>] [--catalog <catalog jsonl>] [--out <dir>]
 */
const fs = require("node:fs");
const path = require("node:path");

const Arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const ROOT = path.resolve(__dirname, "..", "..");
const WIKI = Arg("wiki", path.join(ROOT, "..", "wiki-dump", "pages"));
const CATALOG = Arg("catalog", path.join(ROOT, "Items_Analysis", "catalog_1_14_7.jsonl"));
const OUT = Arg("out", path.join(ROOT, "Items_Analysis", "wiki_huntpass"));

// Our pass slots and the original season each one carries (its items: the HP tag).
const PASSES = [
    { season: "season43", page: "Hunt Pass Season: Overgrowth", tag: "HP03" },
    { season: "season44", page: "Hunt Pass Season: Burndown", tag: "HP04" },
    { season: "season45", page: "Hunt Pass Season: Hidden Blades", tag: "HP05" },
    { season: "season46", page: "Hunt Pass Season: Fortune & Glory", tag: "HP06" },
    { season: "season47", page: "Hunt Pass Season: Zephyr Strike", tag: "HP06B" },
    { season: "season48", page: "Hunt Pass Season: Way of the Fist", tag: "HP07A" },
    { season: "season49", page: "Hunt Pass Season: Haunted Shadows", tag: "HP07B" },
    { season: "season50", page: "Hunt Pass Season: Myth & Legend", tag: "HP08A" },
];

const PageFile = (title) => path.join(WIKI, title.replace(/[<>:"/\\|?*]/g, "_") + ".wiki");

// ---- catalogue -------------------------------------------------------------------------------------------------
const Catalog = fs.readFileSync(CATALOG, "utf8").split(/\r?\n/).filter(Boolean).map((l) => JSON.parse(l));
const Norm = (s) => String(s ?? "").toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9']+/g, " ").trim();
const ByName = new Map();
for (const item of Catalog) {
    const k = Norm(item.displayName);
    if (!k) continue;
    if (!ByName.has(k)) ByName.set(k, []);
    ByName.get(k).push(item);
}

// What a "(Sigil)" / "(Flare)" / "(Hunt Arrival)" etc. note means, as an item id test.
const KIND_TESTS = {
    sigil: (id) => /^BNC_SIGIL/.test(id),
    flare: (id) => /^QI_FLARE/.test(id),
    standard: (id) => /^BNC_(STANDARD|FABRIC)/.test(id),   // the wiki calls banner fabrics "standards"
    fabric: (id) => /^BNC_FABRIC/.test(id),
    "banner plant": (id) => /^BNC_ANIMATION/.test(id),
    "hunt arrival": (id) => /^EM_INTRO/.test(id),
    emote: (id) => /^EM_PLAYER/.test(id),
    title: (id) => /^TITLE/.test(id),
    dye: (id) => /^DYE/.test(id),
    emoji: (id) => /^EJ_/.test(id),
};

function Candidates(name, kind, tag) {
    let list = ByName.get(Norm(name)) ?? [];
    // The wiki names dyes by colour ("Gravity"); the game calls the item "Gravity Dye".
    if (!list.length) list = (ByName.get(Norm(name + " Dye")) ?? []).filter((i) => /^DYE_/.test(i.itemId));
    if (kind && KIND_TESTS[kind]) {
        // The wiki names the kind: only an item of that kind counts (a "Hero (dye)" is not the "Hero" title).
        list = list.filter((i) => KIND_TESTS[kind](i.itemId));
        if (!list.length && kind === "dye") list = (ByName.get(Norm(name + " Dye")) ?? []).filter((i) => /^DYE_/.test(i.itemId));
    }
    // Prefer the pass's own items (id carries its HP tag) when the name is shared.
    if (list.length > 1) {
        const t = list.filter((i) => new RegExp(`_${tag}(_|$)`, "i").test(i.itemId) || new RegExp(`_${tag.replace("HP0", "HP0")}`, "i").test(i.itemId));
        if (t.length) list = t;
    }
    return list;
}

// ---- wikitext --------------------------------------------------------------------------------------------------
function TemplateParams(text, name) {
    const start = text.search(new RegExp(`\\{\\{\\s*${name}\\b`, "i"));
    if (start < 0) return null;
    let depth = 0, i = start;
    for (; i < text.length; i++) {
        if (text.startsWith("{{", i)) { depth++; i++; } else if (text.startsWith("}}", i)) { depth--; i++; if (depth === 0) break; }
    }
    const body = text.slice(start + 2, i - 1);
    // split on top-level pipes
    const parts = []; let cur = ""; let d = 0;
    for (let j = 0; j < body.length; j++) {
        const two = body.slice(j, j + 2);
        if (two === "{{" || two === "[[") { d++; cur += two; j++; continue; }
        if (two === "}}" || two === "]]") { d--; cur += two; j++; continue; }
        if (body[j] === "|" && d === 0) { parts.push(cur); cur = ""; continue; }
        cur += body[j];
    }
    parts.push(cur);
    const params = {};
    for (const p of parts.slice(1)) {
        const eq = p.indexOf("=");
        if (eq > 0) params[p.slice(0, eq).trim()] = p.slice(eq + 1).trim();
    }
    return params;
}

// One reward line -> { raw, name, kind, quantity }
function ParseEntry(raw) {
    let s = raw.replace(/<\/?(small|span|b|i)[^>]*>/gi, "").trim();
    if (!s) return null;
    let quantity = 1;
    const q = /\(x\s*([\d,]+)\)/i.exec(s);
    if (q) quantity = Number(q[1].replace(/,/g, ""));
    const noteMatch = /\)\s*$/.test(s.replace(/\(x\s*[\d,]+\)/i, "").trim()) ? /\(([^()x][^()]*)\)\s*$/.exec(s.replace(/\(x\s*[\d,]+\)/i, "").trim()) : null;
    let name = null;
    let m;
    if ((m = /\{\{\s*IconText\s*\|\s*([^}|]+)/i.exec(s))) name = m[1].trim();
    else {
        const links = [...s.matchAll(/\[\[(?!File:)([^\]|]+)(?:\|([^\]]+))?\]\]/gi)];
        if (links.length) name = (links[links.length - 1][2] ?? links[links.length - 1][1]).trim();
        else if ((m = /\{\{\s*([^}|]+?)-?\s*\}\}/.exec(s))) name = m[1].trim();
    }
    if (!name) return { raw, name: null, kind: null, quantity };
    let kind = null;
    const inName = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(name);
    if (inName) { name = inName[1].trim(); kind = inName[2].trim().toLowerCase(); }
    else if (noteMatch) kind = noteMatch[1].trim().toLowerCase();
    return { raw, name, kind, quantity };
}

function SplitCell(cell) {
    return cell.split(/<br\s*\/?>/i).map((x) => x.trim()).filter(Boolean);
}

// ---- run -------------------------------------------------------------------------------------------------------
fs.mkdirSync(OUT, { recursive: true });
const report = {};
const lines = [];
const unmatched = new Map();
for (const P of PASSES) {
    const file = PageFile(P.page);
    if (!fs.existsSync(file)) { lines.push(`## ${P.season} ${P.page}: PAGE MISSING`); continue; }
    const params = TemplateParams(fs.readFileSync(file, "utf8"), "HuntPassTable");
    if (!params) { lines.push(`## ${P.season} ${P.page}: no HuntPassTable`); continue; }
    const levels = Object.keys(params).map((k) => /^Lvl(\d+)(Free|Elite)$/.exec(k)).filter(Boolean).map((m) => Number(m[1]));
    const max = Math.max(...levels);
    const out = { page: P.page, tag: P.tag, levels: max, free: [], elite: [] };
    lines.push(`## ${P.season} = ${P.page} (${P.tag}), ${max} levels`);
    for (let lvl = 1; lvl <= max; lvl++) {
        for (const track of ["Free", "Elite"]) {
            const entries = SplitCell(params[`Lvl${lvl}${track}`] ?? "").map(ParseEntry).filter(Boolean);
            const matched = entries.map((e) => {
                const c = e.name ? Candidates(e.name, e.kind, P.tag) : [];
                const r = { ...e, ids: c.map((i) => i.itemId) };
                if (c.length !== 1) {
                    const key = `${e.name ?? e.raw}${e.kind ? ` (${e.kind})` : ""}`;
                    if (!unmatched.has(key)) unmatched.set(key, { count: 0, candidates: r.ids.slice(0, 6), passes: new Set() });
                    unmatched.get(key).count++;
                    unmatched.get(key).passes.add(P.season);
                }
                return r;
            });
            out[track.toLowerCase()].push({ level: lvl, rewards: matched });
            const txt = matched.length === 0 ? "(empty)" : matched.map((r) =>
                `${r.name ?? "?" + r.raw}${r.kind ? ` (${r.kind})` : ""} x${r.quantity} -> ${r.ids.length === 1 ? r.ids[0] : r.ids.length ? "AMBIGUOUS " + r.ids.slice(0, 4).join("/") : "NOT FOUND"}`).join(" | ");
            lines.push(`  ${String(lvl).padStart(2)} ${track.padEnd(5)} ${txt}`);
        }
    }
    report[P.season] = out;
}
lines.push("", "## Rewards without exactly one 1.14.7 item");
for (const [k, v] of [...unmatched.entries()].sort((a, b) => b[1].count - a[1].count)) {
    lines.push(`  ${String(v.count).padStart(3)}x  ${k}  [${[...v.passes].join(",")}]${v.candidates.length ? "  candidates: " + v.candidates.join(", ") : ""}`);
}
fs.writeFileSync(path.join(OUT, "wiki_huntpass.json"), JSON.stringify(report, null, 1));
fs.writeFileSync(path.join(OUT, "wiki_huntpass.txt"), lines.join("\n"));
console.log(`wrote ${OUT}`);
