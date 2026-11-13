import { test } from "node:test";
import assert from "node:assert/strict";
import { OpenIslandOccupancy, OpenIslandsEnabled, ParseOpenIslandPlayerCount } from "./openIslands";

const NOW = Date.parse("2026-11-13T12:00:00Z");
const P = (Uid: string) => ({ playerUid: Uid, playerHuntId: "ShatteredIsles_IslandA" });

test("switch: on by default, MNG_OPEN_ISLANDS=off wins over the upstream flag", () => {
    assert.equal(OpenIslandsEnabled({}), true);
    assert.equal(OpenIslandsEnabled({ ENABLE_PUBLIC_HUNT_REUSE: "0" }), true);
    assert.equal(OpenIslandsEnabled({ MNG_OPEN_ISLANDS: "off" }), false);
    assert.equal(OpenIslandsEnabled({ MNG_OPEN_ISLANDS: "on" }), true);
});

test("player count file: fresh counts only", () => {
    assert.equal(ParseOpenIslandPlayerCount(`3 ${NOW / 1000 - 5}\n`, NOW), 3);
    assert.equal(ParseOpenIslandPlayerCount(`3 ${NOW / 1000 - 60}`, NOW), undefined);
    assert.equal(ParseOpenIslandPlayerCount("garbage", NOW), undefined);
    assert.equal(ParseOpenIslandPlayerCount("", NOW), undefined);
});

test("occupancy: no count falls back to the roster", () => {
    const Server = { expectedPlayers: [P("a"), P("b")], startTime: new Date(NOW - 600_000) };
    assert.equal(OpenIslandOccupancy(Server, undefined, NOW), 2);
});

test("occupancy: players who left free their slot", () => {
    const Server = { expectedPlayers: [P("a"), P("b"), P("c"), P("d")], joinTimes: [NOW - 900_000, NOW - 800_000, NOW - 700_000], startTime: new Date(NOW - 1_000_000) };
    assert.equal(OpenIslandOccupancy(Server, 1, NOW), 1);
});

test("occupancy: players on the way count until they could have loaded", () => {
    const Fresh = { expectedPlayers: [P("a")], startTime: new Date(NOW - 30_000) };
    assert.equal(OpenIslandOccupancy(Fresh, 0, NOW), 1, "the launching player is still loading");
    const Joined = { expectedPlayers: [P("a"), P("b")], joinTimes: [NOW - 10_000], startTime: new Date(NOW - 600_000) };
    assert.equal(OpenIslandOccupancy(Joined, 1, NOW), 2);
});

test("occupancy: an empty island nobody is heading to is not offered (it is about to close)", () => {
    const Server = { expectedPlayers: [P("a")], startTime: new Date(NOW - 600_000) };
    assert.equal(OpenIslandOccupancy(Server, 0, NOW), undefined);
});
