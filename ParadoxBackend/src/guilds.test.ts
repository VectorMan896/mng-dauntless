/*
 * MNG DAUNTLESS (modified version of Mystic Paradox). Licensed under the GNU Affero General Public License v3.0.
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
    AcceptInvite, CreateGuild, DeleteInvite, DisbandGuild, GetMyGuild, GuildReply, InvitePlayer, IsGuildMember, KickMember, LeaveGuild,
    MemoryGuildStore, ReceivedInvites, SentInvites, SetRank, ValidateGuild,
} from "./guilds";

const payload = (r: GuildReply): any => (r.body as any)?.payload;
const code = (r: GuildReply): string | null => (r.body as any)?.code ?? null;

async function guildOf(store: MemoryGuildStore, leader = "LEAD") {
    const r = await CreateGuild(store, leader, { leader_account_id: leader, name: "Flowery", nameplate: "FLOWRY" });
    assert.equal(r.status, 200);
    return payload(r).id as string;
}

async function join(store: MemoryGuildStore, by: string, who: string) {
    const inv = await InvitePlayer(store, by, who);
    assert.equal(inv.status, 200, JSON.stringify(inv.body));
    const acc = await AcceptInvite(store, who, payload(inv).id);
    assert.equal(acc.status, 200, JSON.stringify(acc.body));
}

test("no guild is 204; creating one makes the creator its leader, in the live shape", async () => {
    const store = new MemoryGuildStore();
    assert.equal((await GetMyGuild(store, "LEAD")).status, 204);
    await guildOf(store);
    const g = payload(await GetMyGuild(store, "LEAD"));
    assert.equal(g.name, "Flowery");
    assert.equal(g.nameplate, "FLOWRY");
    assert.equal(g.leader_account_id, "LEAD");
    assert.equal(g.maximum_guild_members, 100);
    assert.deepEqual(g.members.map((m: any) => [m.phx_account_id, m.rank]), [["LEAD", "leader"]]);
    assert.match(g.created_date, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d$/);
});

test("validate: names and nameplates are checked and must be free (any case)", async () => {
    const store = new MemoryGuildStore();
    assert.equal(code(await ValidateGuild(store, { name: "abc", nameplate: "AB" })), "ObedientAdorableQuillshot");
    assert.equal(code(await ValidateGuild(store, { name: "Has Space", nameplate: "AB" })), "ObedientAdorableQuillshot");
    assert.equal(code(await ValidateGuild(store, { name: "Goood", nameplate: "A" })), "DutifulAdorableQuillshot");
    assert.equal(code(await ValidateGuild(store, { name: "Aaaaaaaa", nameplate: "AB" })), "LetteredAdorableQuillshot");
    assert.equal((await ValidateGuild(store, { name: "Flowery", nameplate: "FLOWRY" })).status, 200);
    await guildOf(store);
    assert.equal(code(await ValidateGuild(store, { name: "flowery", nameplate: "OTHER" })), "SeizedAdorableQuillshot");
    assert.equal(code(await ValidateGuild(store, { name: "Another", nameplate: "flowry" })), "CapturedAdorableQuillshot");
    assert.equal(code(await CreateGuild(store, "SOMEONE", { name: "FLOWERY", nameplate: "XY" })), "SeizedAdorableQuillshot");
});

test("one guild per account", async () => {
    const store = new MemoryGuildStore();
    await guildOf(store);
    assert.equal(code(await CreateGuild(store, "LEAD", { name: "Second", nameplate: "TWO" })), "OccupiedAdorableQuillshot");
});

test("invite and accept: the invite lists, the joiner is a member, other invites go", async () => {
    const store = new MemoryGuildStore();
    const id = await guildOf(store);
    await CreateGuild(store, "OTHERLEAD", { name: "Others", nameplate: "OTH" });
    const inv = await InvitePlayer(store, "LEAD", "NEWBIE");
    assert.equal(payload(inv).phx_account_id, "NEWBIE");
    await InvitePlayer(store, "OTHERLEAD", "NEWBIE");
    assert.equal(code(await InvitePlayer(store, "LEAD", "NEWBIE")), "RedundantAdorableQuillshot");
    const received = payload(await ReceivedInvites(store, "NEWBIE")).invites;
    assert.equal(received.length, 2);
    assert.equal(received[0].guild_name, "Flowery");
    assert.equal(received[0].inviter_account_id, "LEAD");
    assert.equal(payload(await SentInvites(store, "LEAD")).invites[0].phx_account_id, "NEWBIE");
    const joined = await AcceptInvite(store, "NEWBIE", payload(inv).id);
    assert.equal(payload(joined).members.find((m: any) => m.phx_account_id === "NEWBIE").rank, "member");
    assert.equal(payload(await ReceivedInvites(store, "NEWBIE")).invites.length, 0);
    assert.equal(await IsGuildMember(store, "NEWBIE", id), true);
    assert.equal(code(await InvitePlayer(store, "OTHERLEAD", "NEWBIE")), "ClonedAdorableQuillshot");
});

test("someone else's invite cannot be accepted; decline removes it", async () => {
    const store = new MemoryGuildStore();
    await guildOf(store);
    const inv = payload(await InvitePlayer(store, "LEAD", "NEWBIE")).id;
    assert.equal(code(await AcceptInvite(store, "THIEF", inv)), "UninvitedAdorableQuillshot");
    assert.equal(code(await DeleteInvite(store, "THIEF", inv)), "UninvitedAdorableQuillshot");
    assert.equal((await DeleteInvite(store, "NEWBIE", inv)).status, 200);
    assert.equal(code(await AcceptInvite(store, "NEWBIE", inv)), "UninvitedAdorableQuillshot");
});

test("ranks: members cannot invite or kick; officers invite and kick members only; only the leader sets ranks", async () => {
    const store = new MemoryGuildStore();
    await guildOf(store);
    await join(store, "LEAD", "OFF");
    await join(store, "LEAD", "MEM");
    assert.equal(code(await InvitePlayer(store, "MEM", "X")), "SlyAdorableQuillshot");
    assert.equal(code(await SentInvites(store, "MEM")), "SlyAdorableQuillshot");
    assert.equal(payload(await SetRank(store, "LEAD", "OFF", "officer")).rank, "officer");
    assert.equal(code(await SetRank(store, "OFF", "MEM", "officer")), "SlyAdorableQuillshot");
    assert.equal(code(await SetRank(store, "LEAD", "MEM", "boss")), "DocileAdorableQuillshot");
    assert.equal((await InvitePlayer(store, "OFF", "X")).status, 200);
    assert.equal(code(await KickMember(store, "OFF", "LEAD")), "SlyAdorableQuillshot");
    assert.equal(code(await KickMember(store, "MEM", "OFF")), "SlyAdorableQuillshot");
    assert.equal((await KickMember(store, "OFF", "MEM")).status, 200);
    assert.equal((await GetMyGuild(store, "MEM")).status, 204);
});

test("handing over: the new leader leads, the old one stays as officer; a leader cannot demote or leave", async () => {
    const store = new MemoryGuildStore();
    await guildOf(store);
    await join(store, "LEAD", "HEIR");
    assert.equal(code(await SetRank(store, "LEAD", "LEAD", "member")), "ChiefAdorableQuillshot");
    assert.equal(code(await LeaveGuild(store, "LEAD")), "ChiefAdorableQuillshot");
    assert.equal((await SetRank(store, "LEAD", "HEIR", "leader")).status, 200);
    const g = payload(await GetMyGuild(store, "HEIR"));
    assert.equal(g.leader_account_id, "HEIR");
    assert.equal(g.members.find((m: any) => m.phx_account_id === "LEAD").rank, "officer");
    assert.equal((await LeaveGuild(store, "LEAD")).status, 200);
    assert.equal((await GetMyGuild(store, "LEAD")).status, 204);
});

test("disband: only the leader, everything goes; the last leader leaving disbands too", async () => {
    const store = new MemoryGuildStore();
    const id = await guildOf(store);
    await join(store, "LEAD", "MEM");
    await InvitePlayer(store, "LEAD", "PENDING");
    assert.equal(code(await DisbandGuild(store, "MEM", id)), "SlyAdorableQuillshot");
    assert.equal(code(await DisbandGuild(store, "OUTSIDER", id)), "ExcludedAdorableQuillshot");
    assert.equal((await DisbandGuild(store, "LEAD", id)).status, 200);
    assert.equal((await GetMyGuild(store, "MEM")).status, 204);
    assert.equal(payload(await ReceivedInvites(store, "PENDING")).invites.length, 0);
    assert.equal((await ValidateGuild(store, { name: "Flowery", nameplate: "FLOWRY" })).status, 200);

    const solo = new MemoryGuildStore();
    await guildOf(solo);
    assert.equal((await LeaveGuild(solo, "LEAD")).status, 200);
    assert.equal(solo.guilds.size, 0);
});

test("a guild whose leader's account was deleted gets the earliest officer as leader", async () => {
    const store = new MemoryGuildStore();
    await guildOf(store);
    await join(store, "LEAD", "FIRST");
    await join(store, "LEAD", "OFF");
    await SetRank(store, "LEAD", "OFF", "officer");
    store.memberships.delete("LEAD"); // what the account deletion plan does
    const g = payload(await GetMyGuild(store, "FIRST"));
    assert.equal(g.leader_account_id, "OFF");
    assert.equal(g.members.find((m: any) => m.phx_account_id === "OFF").rank, "leader");
});

test("a full guild refuses invites and joins", async () => {
    const store = new MemoryGuildStore();
    await guildOf(store);
    const late = payload(await InvitePlayer(store, "LEAD", "LATE")).id;
    for (let i = 1; i < 100; i++) await join(store, "LEAD", `M${i}`);
    assert.equal(code(await InvitePlayer(store, "LEAD", "ONEMORE")), "StuffedAdorableQuillshot");
    assert.equal(code(await AcceptInvite(store, "LATE", late)), "StuffedAdorableQuillshot");
});
