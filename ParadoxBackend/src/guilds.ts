/*
 * MNG DAUNTLESS (modified version of Mystic Paradox). Licensed under the GNU Affero General Public License v3.0.
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// [MNG DAUNTLESS 2026-11-01] Guilds: create, invite, accept/decline, ranks, kick, leave, disband (routes/guild.ts).
//
// The 1.14.7 client's own config (DefaultGame.ini [OnlineGuildsPhoenix], the *_v2 endpoints on guild-prod) and the verbs in its
// exe give the API; the shapes and the error codes are the live service's, from EisigesEis/DauntlessEndpointDocumentation
// (Guild/*.md):
//   GET    /guild                          my guild (204 when none)
//   POST   /guild/validate                 {leader_account_id, name, nameplate} -> payload {} or a 400/409 error
//   POST   /guild                          same body -> creates it (payload: the guild)
//   DELETE /guild/{guildId}                disband (leader)
//   PUT    /guild/rank/{accountId}/{rank}  member | officer | leader (leader; "leader" hands the guild over)
//   PUT    /guild/invite/{accountId}       invite (officer, leader)
//   GET    /guild/invite/player            invites I received
//   GET    /guild/invite/guild             invites my guild sent (officer, leader)
//   POST   /guild/invite/accept/{inviteId} join (payload: the guild)
//   DELETE /guild/invite/{inviteId}        decline mine, or withdraw one my guild sent
//   DELETE /guild/player/{accountId}       kick (officer: members only; leader: anyone)
//   DELETE /guild/player                   leave (not the leader)
// Live rank permissions: leader = members view/update/delete, invites view/create/delete, guild.delete; officer = members view/
// delete, invites view/create/delete; member = members.view.
//
// Storage: guilds (one document per guild), guildMembers (_id = the account: one guild per account, enforced by the key) and
// guildInvites (one per guild and invitee).

import { randomUUID } from "node:crypto";
import { GetMongoDb } from "./persistence/mongo/client";
import { Collections } from "./persistence/mongo/collections";

export type GuildRank = "member" | "officer" | "leader";
export const GUILD_RANKS: readonly GuildRank[] = ["member", "officer", "leader"];

export interface GuildRecord {
    id: string;
    name: string;
    nameplate: string;
    leaderId: string;
    created: string;
    modified: string;
}
export interface GuildMemberRecord { accountId: string; guildId: string; rank: GuildRank; joined: string; modified: string }
export interface GuildInviteRecord { id: string; guildId: string; inviteeId: string; inviterId: string; created: string }

export interface GuildStore {
    guild(id: string): Promise<GuildRecord | undefined>;
    guildByName(name: string): Promise<GuildRecord | undefined>;
    guildByNameplate(nameplate: string): Promise<GuildRecord | undefined>;
    /** Insert a new guild; false when its name or nameplate was taken meanwhile. */
    insertGuild(guild: GuildRecord): Promise<boolean>;
    saveGuild(guild: GuildRecord): Promise<void>;
    deleteGuild(id: string): Promise<void>;
    membership(accountId: string): Promise<GuildMemberRecord | undefined>;
    members(guildId: string): Promise<GuildMemberRecord[]>;
    /** Insert a membership; false when the account is already in a guild. */
    insertMember(member: GuildMemberRecord): Promise<boolean>;
    saveMember(member: GuildMemberRecord): Promise<void>;
    deleteMember(accountId: string): Promise<void>;
    deleteMembersOf(guildId: string): Promise<void>;
    invite(id: string): Promise<GuildInviteRecord | undefined>;
    invitesFor(accountId: string): Promise<GuildInviteRecord[]>;
    invitesOf(guildId: string): Promise<GuildInviteRecord[]>;
    /** Insert an invite; false when the guild already invited that account. */
    insertInvite(invite: GuildInviteRecord): Promise<boolean>;
    deleteInvite(id: string): Promise<void>;
    deleteInvitesFor(accountId: string): Promise<void>;
    deleteInvitesOf(guildId: string): Promise<void>;
}

export const MAX_GUILD_MEMBERS = (() => {
    const n = Number(process.env.MNG_GUILD_MAX_MEMBERS);
    return Number.isInteger(n) && n >= 2 && n <= 500 ? n : 100;
})();

// ---- responses ----

export interface GuildReply { status: number; body?: unknown }
const Ok = (payload: unknown = {}): GuildReply => ({ status: 200, body: { code: null, message: "OK", payload } });
const Fail = (status: number, code: string, message: string): GuildReply => ({ status, body: { code, message, payload: null } });

// The live service's error codes (Guild/*.md).
const E = {
    notInGuild: (a: string) => Fail(404, "ExcludedAdorableQuillshot", `Account ${a} is not in a guild.`),
    notInThisGuild: (a: string, g: string) => Fail(403, "ExcludedAdorableQuillshot", `Account ${a} is not in guild ${g}.`),
    privileges: () => Fail(403, "SlyAdorableQuillshot", "Insufficient guild privileges."),
    full: (g: string) => Fail(409, "StuffedAdorableQuillshot", `Guild ${g} is full.`),
    alreadyMember: (a: string, g: string) => Fail(409, "ClonedAdorableQuillshot", `Account ${a} is already in guild ${g}.`),
    alreadyInvited: (a: string, g: string) => Fail(409, "RedundantAdorableQuillshot", `Account ${a} is already invited to guild ${g}.`),
    inviteNotFound: (i: string) => Fail(404, "UninvitedAdorableQuillshot", `Guild invitation ${i} not found.`),
    occupied: (a: string) => Fail(409, "OccupiedAdorableQuillshot", `Account ${a} is already in a guild.`),
    invalidRank: (r: string) => Fail(400, "DocileAdorableQuillshot", `Invalid rank ${r}. Valid values are member, officer, leader.`),
    leaderDemote: () => Fail(409, "ChiefAdorableQuillshot", "Guild leader cannot be demoted. Promote a different member to leader instead."),
    leaderLeave: () => Fail(409, "ChiefAdorableQuillshot", "Guild leader cannot leave the guild. Use /guild/rank to change leaders."),
    nameTaken: (n: string) => Fail(409, "SeizedAdorableQuillshot", `Guild name ${n} is already in use.`),
    nameplateTaken: (n: string) => Fail(409, "CapturedAdorableQuillshot", `Guild nameplate ${n} is already in use.`),
    nameInvalid: () => Fail(400, "ObedientAdorableQuillshot", "Guild name must contain 4-32 english letters and digits."),
    nameplateInvalid: () => Fail(400, "DutifulAdorableQuillshot", "Guild nameplate must contain 2-7 english letters and digits."),
    nameRepeats: () => Fail(400, "LetteredAdorableQuillshot", "Guild name may not contain more than 6 of the same letter in a row."),
    badTarget: () => Fail(400, "ProcessRequestFailed", "Missing or invalid account id."),
};

/** The live service's date format: ISO without the zone ("2022-11-30T19:22:56"). */
const LiveDate = (iso: string): string => iso.replace(/\.\d+Z$|Z$/, "");
const Now = (): string => new Date().toISOString();
const ValidId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_.:-]{1,128}$/.test(id);

// The client's own limits (its messages: name 4-32, nameplate 2-7 english letters and digits); the live rule on repeats.
export function GuildNameProblem(name: unknown, nameplate: unknown): GuildReply | undefined {
    if (typeof name !== "string" || !/^[A-Za-z0-9]{4,32}$/.test(name)) return E.nameInvalid();
    if (/([A-Za-z])\1{6}/i.test(name)) return E.nameRepeats();
    if (typeof nameplate !== "string" || !/^[A-Za-z0-9]{2,7}$/.test(nameplate)) return E.nameplateInvalid();
    return undefined;
}

// ---- views ----

async function GuildView(store: GuildStore, guild: GuildRecord): Promise<unknown> {
    const Members = await store.members(guild.id);
    return {
        created_date: LiveDate(guild.created),
        id: guild.id,
        last_modified_date: LiveDate(guild.modified),
        leader_account_id: guild.leaderId,
        maximum_guild_members: MAX_GUILD_MEMBERS,
        members: Members
            .sort((a, b) => a.joined.localeCompare(b.joined))
            .map((m) => ({ joined_date: LiveDate(m.joined), last_modified_date: LiveDate(m.modified), phx_account_id: m.accountId, rank: m.rank })),
        name: guild.name,
        nameplate: guild.nameplate,
    };
}

/**
 * The account's guild and membership. Repairs a guild whose leader is gone (an account deleted): the earliest officer, else the
 * earliest member, becomes leader; a guild with nobody left is removed.
 */
async function MyGuild(store: GuildStore, accountId: string): Promise<{ guild: GuildRecord; me: GuildMemberRecord } | undefined> {
    const Me = await store.membership(accountId);
    if (!Me) return undefined;
    const Guild = await store.guild(Me.guildId);
    if (!Guild) { await store.deleteMember(accountId); return undefined; }
    if (Guild.leaderId !== accountId && !(await store.membership(Guild.leaderId))) await RepairLeader(store, Guild);
    const Fresh = (await store.membership(accountId)) ?? Me;
    return { guild: (await store.guild(Guild.id)) ?? Guild, me: Fresh };
}

async function RepairLeader(store: GuildStore, guild: GuildRecord): Promise<void> {
    const Members = (await store.members(guild.id)).sort((a, b) => a.joined.localeCompare(b.joined));
    const Heir = Members.find((m) => m.rank === "officer") ?? Members[0];
    if (!Heir) { await store.deleteInvitesOf(guild.id); await store.deleteGuild(guild.id); return; }
    const At = Now();
    await store.saveMember({ ...Heir, rank: "leader", modified: At });
    await store.saveGuild({ ...guild, leaderId: Heir.accountId, modified: At });
}

// ---- operations ----

export async function GetMyGuild(store: GuildStore, accountId: string): Promise<GuildReply> {
    const Mine = await MyGuild(store, accountId);
    if (!Mine) return { status: 204 };
    return Ok(await GuildView(store, Mine.guild));
}

export async function ValidateGuild(store: GuildStore, body: any): Promise<GuildReply> {
    const Problem = GuildNameProblem(body?.name, body?.nameplate);
    if (Problem) return Problem;
    if (await store.guildByName(body.name)) return E.nameTaken(body.name);
    if (await store.guildByNameplate(body.nameplate)) return E.nameplateTaken(body.nameplate);
    return Ok({});
}

export async function CreateGuild(store: GuildStore, accountId: string, body: any): Promise<GuildReply> {
    const Checked = await ValidateGuild(store, body);
    if (Checked.status !== 200) return Checked;
    if (await MyGuild(store, accountId)) return E.occupied(accountId);
    const At = Now();
    const Guild: GuildRecord = { id: randomUUID(), name: body.name, nameplate: body.nameplate, leaderId: accountId, created: At, modified: At };
    if (!(await store.insertGuild(Guild))) return E.nameTaken(body.name);
    if (!(await store.insertMember({ accountId, guildId: Guild.id, rank: "leader", joined: At, modified: At }))) {
        await store.deleteGuild(Guild.id);
        return E.occupied(accountId);
    }
    await store.deleteInvitesFor(accountId);
    return Ok(await GuildView(store, Guild));
}

export async function DisbandGuild(store: GuildStore, accountId: string, guildId: string): Promise<GuildReply> {
    const Mine = await MyGuild(store, accountId);
    if (!Mine || Mine.guild.id !== guildId) return E.notInThisGuild(accountId, guildId);
    if (Mine.me.rank !== "leader") return E.privileges();
    await store.deleteInvitesOf(guildId);
    await store.deleteMembersOf(guildId);
    await store.deleteGuild(guildId);
    return Ok({});
}

export async function SetRank(store: GuildStore, accountId: string, targetId: string, rankRaw: string): Promise<GuildReply> {
    const Rank = String(rankRaw ?? "").toLowerCase() as GuildRank;
    if (!GUILD_RANKS.includes(Rank)) return E.invalidRank(String(rankRaw));
    const Mine = await MyGuild(store, accountId);
    if (!Mine) return E.notInGuild(accountId);
    if (!ValidId(targetId)) return E.badTarget();
    if (targetId === accountId && Mine.me.rank === "leader" && Rank !== "leader") return E.leaderDemote();
    if (Mine.me.rank !== "leader") return E.privileges();
    const Target = await store.membership(targetId);
    if (!Target || Target.guildId !== Mine.guild.id) return E.notInThisGuild(targetId, Mine.guild.id);
    const At = Now();
    if (Rank === "leader" && targetId !== accountId) {
        // Handing the guild over: the old leader stays on as an officer.
        await store.saveMember({ ...Mine.me, rank: "officer", modified: At });
        await store.saveGuild({ ...Mine.guild, leaderId: targetId, modified: At });
    }
    const Updated = { ...Target, rank: Rank, modified: At };
    await store.saveMember(Updated);
    return Ok({ guild: Mine.guild.id, joined_date: LiveDate(Updated.joined), last_modified_date: LiveDate(At), phx_account_id: targetId, rank: Rank });
}

export async function InvitePlayer(store: GuildStore, accountId: string, targetId: string): Promise<GuildReply> {
    const Mine = await MyGuild(store, accountId);
    if (!Mine) return E.notInGuild(accountId);
    if (Mine.me.rank === "member") return E.privileges();
    if (!ValidId(targetId)) return E.badTarget();
    const Target = await store.membership(targetId);
    if (Target) return E.alreadyMember(targetId, Target.guildId);
    if ((await store.members(Mine.guild.id)).length >= MAX_GUILD_MEMBERS) return E.full(Mine.guild.id);
    const Invite: GuildInviteRecord = { id: randomUUID(), guildId: Mine.guild.id, inviteeId: targetId, inviterId: accountId, created: Now() };
    if (!(await store.insertInvite(Invite))) return E.alreadyInvited(targetId, Mine.guild.id);
    return Ok({ guild: Invite.guildId, id: Invite.id, invite_date: Invite.created, inviter_account_id: accountId, phx_account_id: targetId });
}

export async function ReceivedInvites(store: GuildStore, accountId: string): Promise<GuildReply> {
    const Invites = await store.invitesFor(accountId);
    const Out: unknown[] = [];
    for (const Invite of Invites.sort((a, b) => a.created.localeCompare(b.created))) {
        const Guild = await store.guild(Invite.guildId);
        if (!Guild) { await store.deleteInvite(Invite.id); continue; }
        Out.push({ guild_id: Guild.id, guild_name: Guild.name, id: Invite.id, invite_date: LiveDate(Invite.created), inviter_account_id: Invite.inviterId });
    }
    return Ok({ invites: Out });
}

export async function SentInvites(store: GuildStore, accountId: string): Promise<GuildReply> {
    const Mine = await MyGuild(store, accountId);
    if (!Mine) return E.notInGuild(accountId);
    if (Mine.me.rank === "member") return E.privileges();
    const Invites = (await store.invitesOf(Mine.guild.id)).sort((a, b) => a.created.localeCompare(b.created));
    return Ok({
        guild_id: Mine.guild.id,
        invites: Invites.map((i) => ({ id: i.id, invite_date: LiveDate(i.created), inviter_account_id: i.inviterId, phx_account_id: i.inviteeId })),
    });
}

export async function AcceptInvite(store: GuildStore, accountId: string, inviteId: string): Promise<GuildReply> {
    const Invite = await store.invite(inviteId);
    if (!Invite || Invite.inviteeId !== accountId) return E.inviteNotFound(inviteId);
    const Guild = await store.guild(Invite.guildId);
    if (!Guild) { await store.deleteInvite(inviteId); return E.inviteNotFound(inviteId); }
    if (await MyGuild(store, accountId)) return E.occupied(accountId);
    if ((await store.members(Guild.id)).length >= MAX_GUILD_MEMBERS) return E.full(Guild.id);
    const At = Now();
    if (!(await store.insertMember({ accountId, guildId: Guild.id, rank: "member", joined: At, modified: At }))) return E.occupied(accountId);
    await store.deleteInvitesFor(accountId);
    return Ok(await GuildView(store, Guild));
}

export async function DeleteInvite(store: GuildStore, accountId: string, inviteId: string): Promise<GuildReply> {
    const Invite = await store.invite(inviteId);
    if (!Invite) return E.inviteNotFound(inviteId);
    if (Invite.inviteeId !== accountId) {
        // Withdrawing an invite the guild sent: an officer or the leader of that guild.
        const Mine = await MyGuild(store, accountId);
        if (!Mine || Mine.guild.id !== Invite.guildId) return E.inviteNotFound(inviteId);
        if (Mine.me.rank === "member") return E.privileges();
    }
    await store.deleteInvite(inviteId);
    return Ok({});
}

export async function KickMember(store: GuildStore, accountId: string, targetId: string): Promise<GuildReply> {
    const Mine = await MyGuild(store, accountId);
    if (!Mine) return E.notInGuild(accountId);
    if (!ValidId(targetId) || targetId === accountId) return E.badTarget();
    const Target = await store.membership(targetId);
    if (!Target || Target.guildId !== Mine.guild.id) return E.notInThisGuild(targetId, Mine.guild.id);
    const Allowed = Mine.me.rank === "leader" || (Mine.me.rank === "officer" && Target.rank === "member");
    if (!Allowed) return E.privileges();
    await store.deleteMember(targetId);
    return Ok({});
}

export async function LeaveGuild(store: GuildStore, accountId: string): Promise<GuildReply> {
    const Mine = await MyGuild(store, accountId);
    if (!Mine) return E.notInGuild(accountId);
    if (Mine.me.rank === "leader") {
        // The last one out may go: the guild goes with them.
        if ((await store.members(Mine.guild.id)).length > 1) return E.leaderLeave();
        return DisbandGuild(store, accountId, Mine.guild.id);
    }
    await store.deleteMember(accountId);
    return Ok({});
}

/** Whether the account is in that guild (guild chat rooms, Guild-<guildId>). */
export async function IsGuildMember(store: GuildStore, accountId: string, guildId: string): Promise<boolean> {
    const Me = await store.membership(accountId);
    return Me !== undefined && Me.guildId === guildId;
}

// ---- stores ----

export class MemoryGuildStore implements GuildStore {
    readonly guilds = new Map<string, GuildRecord>();
    readonly memberships = new Map<string, GuildMemberRecord>();
    readonly invites = new Map<string, GuildInviteRecord>();
    async guild(id: string) { return this.guilds.get(id); }
    async guildByName(name: string) { return [...this.guilds.values()].find((g) => g.name.toLowerCase() === name.toLowerCase()); }
    async guildByNameplate(p: string) { return [...this.guilds.values()].find((g) => g.nameplate.toLowerCase() === p.toLowerCase()); }
    async insertGuild(g: GuildRecord) {
        if ((await this.guildByName(g.name)) || (await this.guildByNameplate(g.nameplate))) return false;
        this.guilds.set(g.id, { ...g }); return true;
    }
    async saveGuild(g: GuildRecord) { this.guilds.set(g.id, { ...g }); }
    async deleteGuild(id: string) { this.guilds.delete(id); }
    async membership(a: string) { const m = this.memberships.get(a); return m && { ...m }; }
    async members(g: string) { return [...this.memberships.values()].filter((m) => m.guildId === g).map((m) => ({ ...m })); }
    async insertMember(m: GuildMemberRecord) { if (this.memberships.has(m.accountId)) return false; this.memberships.set(m.accountId, { ...m }); return true; }
    async saveMember(m: GuildMemberRecord) { this.memberships.set(m.accountId, { ...m }); }
    async deleteMember(a: string) { this.memberships.delete(a); }
    async deleteMembersOf(g: string) { for (const [k, m] of this.memberships) if (m.guildId === g) this.memberships.delete(k); }
    async invite(id: string) { return this.invites.get(id); }
    async invitesFor(a: string) { return [...this.invites.values()].filter((i) => i.inviteeId === a); }
    async invitesOf(g: string) { return [...this.invites.values()].filter((i) => i.guildId === g); }
    async insertInvite(i: GuildInviteRecord) {
        if ([...this.invites.values()].some((x) => x.guildId === i.guildId && x.inviteeId === i.inviteeId)) return false;
        this.invites.set(i.id, { ...i }); return true;
    }
    async deleteInvite(id: string) { this.invites.delete(id); }
    async deleteInvitesFor(a: string) { for (const [k, i] of this.invites) if (i.inviteeId === a) this.invites.delete(k); }
    async deleteInvitesOf(g: string) { for (const [k, i] of this.invites) if (i.guildId === g) this.invites.delete(k); }
}

const IsDuplicate = (err: unknown): boolean => (err as { code?: number })?.code === 11000;

export class MongoGuildStore implements GuildStore {
    private indexes: Promise<void> | undefined;
    private async db() {
        const Db = await GetMongoDb();
        this.indexes ??= (async () => {
            await Db.collection(Collections.Guilds).createIndex({ nameLower: 1 }, { unique: true });
            await Db.collection(Collections.Guilds).createIndex({ nameplateLower: 1 }, { unique: true });
            await Db.collection(Collections.GuildMembers).createIndex({ guildId: 1 });
            await Db.collection(Collections.GuildInvites).createIndex({ guildId: 1, inviteeId: 1 }, { unique: true });
            await Db.collection(Collections.GuildInvites).createIndex({ inviteeId: 1 });
        })();
        await this.indexes;
        return Db;
    }
    private static guildOf(d: any): GuildRecord | undefined {
        return d ? { id: d._id, name: d.name, nameplate: d.nameplate, leaderId: d.leaderId, created: d.created, modified: d.modified } : undefined;
    }
    private static memberOf(d: any): GuildMemberRecord | undefined {
        return d ? { accountId: d._id, guildId: d.guildId, rank: d.rank, joined: d.joined, modified: d.modified } : undefined;
    }
    private static inviteOf(d: any): GuildInviteRecord | undefined {
        return d ? { id: d._id, guildId: d.guildId, inviteeId: d.inviteeId, inviterId: d.inviterId, created: d.created } : undefined;
    }
    private static guildDoc(g: GuildRecord) {
        return { name: g.name, nameLower: g.name.toLowerCase(), nameplate: g.nameplate, nameplateLower: g.nameplate.toLowerCase(), leaderId: g.leaderId, created: g.created, modified: g.modified };
    }
    async guild(id: string) { return MongoGuildStore.guildOf(await (await this.db()).collection(Collections.Guilds).findOne({ _id: id as any })); }
    async guildByName(name: string) { return MongoGuildStore.guildOf(await (await this.db()).collection(Collections.Guilds).findOne({ nameLower: name.toLowerCase() })); }
    async guildByNameplate(p: string) { return MongoGuildStore.guildOf(await (await this.db()).collection(Collections.Guilds).findOne({ nameplateLower: p.toLowerCase() })); }
    async insertGuild(g: GuildRecord) {
        try { await (await this.db()).collection(Collections.Guilds).insertOne({ _id: g.id as any, ...MongoGuildStore.guildDoc(g) }); return true; }
        catch (err) { if (IsDuplicate(err)) return false; throw err; }
    }
    async saveGuild(g: GuildRecord) { await (await this.db()).collection(Collections.Guilds).updateOne({ _id: g.id as any }, { $set: MongoGuildStore.guildDoc(g) }); }
    async deleteGuild(id: string) { await (await this.db()).collection(Collections.Guilds).deleteOne({ _id: id as any }); }
    async membership(a: string) { return MongoGuildStore.memberOf(await (await this.db()).collection(Collections.GuildMembers).findOne({ _id: a as any })); }
    async members(g: string) { return (await (await this.db()).collection(Collections.GuildMembers).find({ guildId: g }).toArray()).map((d) => MongoGuildStore.memberOf(d)!); }
    async insertMember(m: GuildMemberRecord) {
        try { await (await this.db()).collection(Collections.GuildMembers).insertOne({ _id: m.accountId as any, guildId: m.guildId, rank: m.rank, joined: m.joined, modified: m.modified }); return true; }
        catch (err) { if (IsDuplicate(err)) return false; throw err; }
    }
    async saveMember(m: GuildMemberRecord) {
        await (await this.db()).collection(Collections.GuildMembers).updateOne({ _id: m.accountId as any }, { $set: { guildId: m.guildId, rank: m.rank, joined: m.joined, modified: m.modified } });
    }
    async deleteMember(a: string) { await (await this.db()).collection(Collections.GuildMembers).deleteOne({ _id: a as any }); }
    async deleteMembersOf(g: string) { await (await this.db()).collection(Collections.GuildMembers).deleteMany({ guildId: g }); }
    async invite(id: string) { return MongoGuildStore.inviteOf(await (await this.db()).collection(Collections.GuildInvites).findOne({ _id: id as any })); }
    async invitesFor(a: string) { return (await (await this.db()).collection(Collections.GuildInvites).find({ inviteeId: a }).toArray()).map((d) => MongoGuildStore.inviteOf(d)!); }
    async invitesOf(g: string) { return (await (await this.db()).collection(Collections.GuildInvites).find({ guildId: g }).toArray()).map((d) => MongoGuildStore.inviteOf(d)!); }
    async insertInvite(i: GuildInviteRecord) {
        try { await (await this.db()).collection(Collections.GuildInvites).insertOne({ _id: i.id as any, guildId: i.guildId, inviteeId: i.inviteeId, inviterId: i.inviterId, created: i.created }); return true; }
        catch (err) { if (IsDuplicate(err)) return false; throw err; }
    }
    async deleteInvite(id: string) { await (await this.db()).collection(Collections.GuildInvites).deleteOne({ _id: id as any }); }
    async deleteInvitesFor(a: string) { await (await this.db()).collection(Collections.GuildInvites).deleteMany({ inviteeId: a }); }
    async deleteInvitesOf(g: string) { await (await this.db()).collection(Collections.GuildInvites).deleteMany({ guildId: g }); }
}

let DefaultStore: GuildStore | undefined;
export function GetGuildStore(): GuildStore { return DefaultStore ??= new MongoGuildStore(); }
/** Tests only. */
export function SetGuildStoreForTests(store: GuildStore | undefined): void { DefaultStore = store; }
