#!/usr/bin/env node
/*
 * [MNG DAUNTLESS 2026-10-30] Lists the UI and banner texture paths cooked into your own Dauntless install's .pak files, so
 * generators can turn the SHORT texture names of the client's StoreItemsTable (store_item_images_1_14_7.jsonl:
 * `single_glider_clearskies.single_glider_clearskies`) into the `/Game/...` paths a server-authored store tile needs, and
 * check that a texture they reference exists.
 *
 * Read-only: it reads each pak's footer and full directory index (pak v11, UE 4.26, unencrypted index) and no asset data.
 * Writes Items_Analysis/pak_textures_1_14_7.txt, one `/Game/<dir>/<name>.<name>` object path per line.
 *
 * USAGE (from ParadoxBackend)
 *   node scripts/list_pak_textures.cjs --paks "<Dauntless>\Archon\Content\Paks" [--out <file>]
 */
const fs = require("node:fs");
const path = require("node:path");

function Arg(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const PaksDir = Arg("paks", process.env.MYSTICPARADOX_DAUNTLESS_PAKS);
const OutPath = path.resolve(Arg("out", path.join(__dirname, "..", "..", "Items_Analysis", "pak_textures_1_14_7.txt")));
if (!PaksDir || !fs.existsSync(PaksDir)) {
    console.error("usage: node scripts/list_pak_textures.cjs --paks <Dauntless>\\Archon\\Content\\Paks");
    process.exit(1);
}

const PAK_MAGIC = 0x5a6f12e1;
// Only the folders tile art comes from: UI textures (icons, store images, hunt pass art) and the banner sigil textures.
const KEEP = [/^\/Game\/UI\//i, /^\/Game\/CharacterProps\/banners\/textures\//i];

function ReadAt(fd, offset, length) {
    const Buf = Buffer.alloc(length);
    fs.readSync(fd, Buf, 0, length, offset);
    return Buf;
}

class Reader {
    constructor(buf) { this.b = buf; this.o = 0; }
    i32() { const v = this.b.readInt32LE(this.o); this.o += 4; return v; }
    u32() { const v = this.b.readUInt32LE(this.o); this.o += 4; return v; }
    i64() { const v = Number(this.b.readBigInt64LE(this.o)); this.o += 8; return v; }
    skip(n) { this.o += n; }
    fstring() {
        const Len = this.i32();
        if (Len === 0) return "";
        if (Len < 0) {
            const Value = this.b.toString("utf16le", this.o, this.o + -Len * 2 - 2);
            this.o += -Len * 2;
            return Value;
        }
        const Value = this.b.toString("latin1", this.o, this.o + Len - 1);
        this.o += Len;
        return Value;
    }
}

const Paths = new Set();
let Paks = 0;
for (const Name of fs.readdirSync(PaksDir).filter((n) => n.toLowerCase().endsWith(".pak")).sort()) {
    const Fd = fs.openSync(path.join(PaksDir, Name), "r");
    try {
        const Size = fs.fstatSync(Fd).size;
        const Tail = ReadAt(Fd, Math.max(0, Size - 512), Math.min(Size, 512));
        let Magic = -1;
        for (let i = Tail.length - 4; i >= 0; i--) if (Tail.readUInt32LE(i) === PAK_MAGIC) { Magic = i; break; }
        if (Magic < 1) { console.warn(`${Name}: no pak footer, skipped`); continue; }
        if (Tail[Magic - 1] !== 0) { console.warn(`${Name}: encrypted index, skipped`); continue; }
        const Version = Tail.readUInt32LE(Magic + 4);
        if (Version < 10) { console.warn(`${Name}: pak version ${Version} has no path hash/directory index, skipped`); continue; }
        const Index = new Reader(ReadAt(Fd, Number(Tail.readBigUInt64LE(Magic + 8)), Number(Tail.readBigUInt64LE(Magic + 16))));
        const Mount = Index.fstring().replace(/^(\.\.\/)+/, "/");
        Index.i32();                                // entry count
        Index.skip(8);                              // path hash seed
        if (Index.u32()) Index.skip(8 + 8 + 20);    // path hash index (offset, size, hash)
        if (!Index.u32()) { console.warn(`${Name}: no full directory index, skipped`); continue; }
        const Dir = new Reader(ReadAt(Fd, Index.i64(), Index.i64()));
        for (let d = Dir.i32(); d > 0; d--) {
            const DirName = Dir.fstring();
            for (let f = Dir.i32(); f > 0; f--) {
                const File = Dir.fstring();
                Dir.i32();
                if (!File.toLowerCase().endsWith(".uasset")) continue;
                const Game = `${Mount}${DirName}${File}`
                    .replace(/^\/Archon\/Content\//i, "/Game/")
                    .replace(/\/{2,}/g, "/")
                    .replace(/\.uasset$/i, "");
                if (!KEEP.some((Re) => Re.test(Game))) continue;
                const Short = Game.slice(Game.lastIndexOf("/") + 1);
                Paths.add(`${Game}.${Short}`);
            }
        }
        Paks++;
    } finally {
        fs.closeSync(Fd);
    }
}

fs.mkdirSync(path.dirname(OutPath), { recursive: true });
fs.writeFileSync(OutPath, [...Paths].sort().join("\n") + "\n");
console.log(`Read ${Paks} paks; wrote ${Paths.size} texture paths to ${OutPath}`);
