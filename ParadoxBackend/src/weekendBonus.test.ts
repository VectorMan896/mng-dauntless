// [MNG DAUNTLESS 2026-10-31] Weekend double drops (src/weekendBonus.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { WeekendDoubleOn, WithWeekendDrops, WeekendNotice } from "./weekendBonus";

const SATURDAY = new Date(2026, 9, 31, 12);
const SUNDAY = new Date(2026, 10, 1, 23);
const MONDAY = new Date(2026, 10, 2, 0, 30);
const ON = {} as NodeJS.ProcessEnv;

test("the bonus runs on Saturday and Sunday only, and can be switched off", () => {
    assert.equal(WeekendDoubleOn(SATURDAY, ON), true);
    assert.equal(WeekendDoubleOn(SUNDAY, ON), true);
    assert.equal(WeekendDoubleOn(MONDAY, ON), false);
    assert.equal(WeekendDoubleOn(SATURDAY, { MNG_WEEKEND_DOUBLE: "off" } as NodeJS.ProcessEnv), false);
});

test("Behemoth materials and Rams are doubled; kill tokens, cores and odd quantities are not", () => {
    const items = [
        { catalogId: "BREAK_BULLSEYE_QUILL", quantity: 3 },
        { catalogId: "CURRENCY_NOTES", quantity: 250 },
        { catalogId: "TOKEN_KILL_COUNT_HOST_BETA", quantity: 1 },
        { catalogId: "CONTAINER_CORE_BRONZE_CELLCORE", quantity: 1 },
        { catalogId: "BREAK_ROCK_LIMB", quantity: "2" },
    ];
    const { items: out, doubled } = WithWeekendDrops(items, SATURDAY, ON) as { items: any[]; doubled: string[] };
    assert.deepEqual(out.map((i) => i.quantity), [6, 500, 1, 1, "2"]);
    assert.equal(doubled.length, 2);
    assert.equal(items[0].quantity, 3, "the input is not changed");
    assert.deepEqual((WithWeekendDrops(items, MONDAY, ON).items as any[]).map((i) => i.quantity), [3, 250, 1, 1, "2"]);
});

test("the list of doubled items comes from MNG_WEEKEND_DOUBLE_ITEMS", () => {
    const env = { MNG_WEEKEND_DOUBLE_ITEMS: "CONTAINER_CORE_" } as NodeJS.ProcessEnv;
    const { items } = WithWeekendDrops([{ catalogId: "CONTAINER_CORE_BRONZE_CELLCORE", quantity: 1 }, { catalogId: "CURRENCY_NOTES", quantity: 5 }], SATURDAY, env) as { items: any[] };
    assert.deepEqual(items.map((i) => i.quantity), [2, 5]);
});

test("the launcher notice runs until Monday and names the bonus", () => {
    const notice = WeekendNotice(SATURDAY, ON);
    assert.ok(notice && /double/i.test(notice.announcement.text));
    assert.equal(new Date(notice!.announcement.showUntil).getDay(), 1);
    assert.equal(WeekendNotice(MONDAY, ON), undefined);
});
