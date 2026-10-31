#!/usr/bin/env node
// MNG DAUNTLESS: sets the launcher version everywhere it is stored and opens a CHANGELOG-MNG.md entry.
// Usage (from the repository root):
//   node scripts/mng-bump-launcher-version.mjs patch|minor|major|<x.y.z> ["One-line summary"]
// Files: ParadoxLauncher/package.json, ParadoxLauncher/src-tauri/tauri.conf.json, ParadoxLauncher/src-tauri/Cargo.toml,
// the launcher entry of ParadoxLauncher/src-tauri/Cargo.lock, and CHANGELOG-MNG.md.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const Root = join(dirname(fileURLToPath(import.meta.url)), "..");
const Launcher = join(Root, "ParadoxLauncher");
const [, , Bump, ...SummaryParts] = process.argv;
if (!Bump) {
    console.error("usage: node scripts/mng-bump-launcher-version.mjs patch|minor|major|<x.y.z> [summary]");
    process.exit(1);
}

const PackagePath = join(Launcher, "package.json");
const Current = JSON.parse(readFileSync(PackagePath, "utf8")).version;
const [Ma, Mi, Pa] = Current.split(".").map(Number);
const Next = /^\d+\.\d+\.\d+$/.test(Bump) ? Bump
    : Bump === "major" ? `${Ma + 1}.0.0`
    : Bump === "minor" ? `${Ma}.${Mi + 1}.0`
    : Bump === "patch" ? `${Ma}.${Mi}.${Pa + 1}`
    : null;
if (!Next) { console.error(`Unknown bump "${Bump}"`); process.exit(1); }

function Replace(path, pattern, replacement) {
    const text = readFileSync(path, "utf8");
    const next = text.replace(pattern, replacement);
    if (next === text) throw new Error(`No version found to replace in ${path}`);
    writeFileSync(path, next);
}

Replace(PackagePath, /("version":\s*")[^"]+(")/, `$1${Next}$2`);
Replace(join(Launcher, "src-tauri", "tauri.conf.json"), /("version":\s*")[^"]+(")/, `$1${Next}$2`);
Replace(join(Launcher, "src-tauri", "Cargo.toml"), /^(version\s*=\s*")[^"]+(")/m, `$1${Next}$2`);
Replace(join(Launcher, "src-tauri", "Cargo.lock"), /(name = "launcher"\r?\nversion = ")[^"]+(")/, `$1${Next}$2`);

const ChangelogPath = join(Root, "CHANGELOG-MNG.md");
const Header = "# MNG DAUNTLESS changelog\n\nNewest first. Launcher versions; the server, runtime and data change with them.\n";
const Existing = existsSync(ChangelogPath) ? readFileSync(ChangelogPath, "utf8") : Header;
const Body = Existing.startsWith("# MNG DAUNTLESS changelog") ? Existing.slice(Header.length) : Existing;
const Today = new Date().toISOString().slice(0, 10);
const Summary = SummaryParts.join(" ").trim() || "(describe this release)";
writeFileSync(ChangelogPath, `${Header}\n## ${Next} - ${Today}\n\n- ${Summary}\n${Body.startsWith("\n") ? Body : "\n" + Body}`);

console.log(`Launcher version ${Current} -> ${Next}. Edit CHANGELOG-MNG.md to list the changes.`);
