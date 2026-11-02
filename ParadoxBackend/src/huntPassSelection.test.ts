/*
 * MNG DAUNTLESS (modified version of Mystic Paradox). Licensed under the GNU Affero General Public License v3.0.
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PickHuntPassId, ServedSelection } from "./huntPassSelection";
import { HuntPassAllOpen, OpenHuntPassIds } from "./seasonWindow";

const OPEN = ["season43", "season44", "season45"];

test("a save names its pass in the usual fields, nested, or as a bare string; closed passes are refused", () => {
    assert.equal(PickHuntPassId({ progression_id: "season45" }, OPEN), "season45"); // what the game server sends
    assert.equal(PickHuntPassId({ huntpass_id: "season44" }, OPEN), "season44");
    assert.equal(PickHuntPassId({ selectedHuntPassId: " season45 " }, OPEN), "season45");
    assert.equal(PickHuntPassId({ payload: { anything: "season44" } }, OPEN), "season44");
    assert.equal(PickHuntPassId("season43", OPEN), "season43");
    assert.equal(PickHuntPassId({ huntpass_id: "season19" }, OPEN), undefined);
    assert.equal(PickHuntPassId({ huntpass_id: "ExperienceTrack_Player" }, OPEN), undefined);
    assert.equal(PickHuntPassId(null, OPEN), undefined);
    assert.equal(PickHuntPassId({}, OPEN), undefined);
});

test("the saved pick is served while it is open; otherwise the rotation pass", () => {
    assert.equal(ServedSelection("season45", OPEN, "season43"), "season45");
    assert.equal(ServedSelection(undefined, OPEN, "season43"), "season43");
    assert.equal(ServedSelection("season50", OPEN, "season43"), "season43");
});

test("all passes open only with MYSTICPARADOX_HUNTPASS_ALL_OPEN, and then the whole rotation list", () => {
    const Saved = { open: process.env.MYSTICPARADOX_HUNTPASS_ALL_OPEN, rot: process.env.MYSTICPARADOX_HUNTPASS_ROTATION };
    try {
        process.env.MYSTICPARADOX_HUNTPASS_ROTATION = "season43,season44";
        delete process.env.MYSTICPARADOX_HUNTPASS_ALL_OPEN;
        assert.equal(HuntPassAllOpen(), false);
        assert.deepEqual(OpenHuntPassIds(), []);
        process.env.MYSTICPARADOX_HUNTPASS_ALL_OPEN = "on";
        assert.deepEqual(OpenHuntPassIds(), ["season43", "season44"]);
    } finally {
        if (Saved.open === undefined) delete process.env.MYSTICPARADOX_HUNTPASS_ALL_OPEN; else process.env.MYSTICPARADOX_HUNTPASS_ALL_OPEN = Saved.open;
        if (Saved.rot === undefined) delete process.env.MYSTICPARADOX_HUNTPASS_ROTATION; else process.env.MYSTICPARADOX_HUNTPASS_ROTATION = Saved.rot;
    }
});
