/*
 * Original work Copyright (C) 2026 gwog :3 (SyST3MDeV/Undaunted)
 * Modified work Copyright (C) 2026 MysticFox / Pranav Karande (pranav158/Mystic-Paradox)
 *
 * Licensed under the GNU Affero General Public License v3.0.
 * You may obtain a copy of the License at the root of this repository.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 * Additional terms under AGPLv3 Section 7 apply. See ADDITIONAL_TERMS.md.
 */

// [MNG DAUNTLESS 2026-11-01] Guilds (guild-prod.steelyard.ca), stubs replaced by the real thing: src/guilds.ts has the API, the
// rules and the storage. Every call logs one [Guild] line with its result.

import { Router } from "express";
import { logger } from "../logger";
import { HasParadoxBackendAuth } from "../middleware/HasParadoxBackendAuth";
import {
    AcceptInvite, CreateGuild, DeleteInvite, DisbandGuild, GetGuildStore, GetMyGuild, GuildReply, InvitePlayer, KickMember,
    LeaveGuild, ReceivedInvites, SentInvites, SetRank, ValidateGuild,
} from "../guilds";

export const guildRouter = Router();

type Handler = (accountId: string, req: any) => Promise<GuildReply>;

// Creating a guild goes through the game server (gameserver key, no player login): the player is named in the body as
// leader_account_id. Only routes that pass fromGameserver accept that; everything else needs the player's own session.
function Route(label: string, handler: Handler, fromGameserver?: (req: any) => unknown) {
    return async (req: any, res: any) => {
        const IsGameserver = req.AuthData?.IsGameserver === true;
        if (IsGameserver && fromGameserver) {
            logger.info(`[Guild] ${label} from gameserver body=${JSON.stringify(req.body ?? null).slice(0, 300)}`);
        }
        const AccountId: unknown = IsGameserver ? fromGameserver?.(req) : req.AuthData?.userId;
        if (typeof AccountId !== "string" || !AccountId) {
            logger.warn(`[Guild] ${label} refused: ${IsGameserver ? "gameserver request without a player" : "no player session"}`);
            res.status(403).json({ code: "SlyAdorableQuillshot", message: "A player session is required.", payload: null });
            return;
        }
        try {
            const Reply = await handler(AccountId, req);
            const Code = (Reply.body as { code?: string } | undefined)?.code;
            logger.info(`[Guild] ${label} by ${AccountId} -> ${Reply.status}${Code ? ` ${Code}` : ""}`);
            if (Reply.status === 204) { res.status(204).send(); return; }
            res.status(Reply.status).json(Reply.body);
        } catch (err) {
            logger.error(`[Guild] ${label} by ${AccountId} failed: ${err}`);
            res.status(500).json({ code: "ProcessRequestFailed", message: "Guild request failed.", payload: null });
        }
    };
}

const Store = () => GetGuildStore();

// Order matters: the fixed paths before the /guild/:guildId and /guild/invite/:inviteId patterns.
guildRouter.get("/guild", HasParadoxBackendAuth, Route("get", (a) => GetMyGuild(Store(), a)));
guildRouter.post("/guild/validate", HasParadoxBackendAuth, Route("validate", (a, req) => ValidateGuild(Store(), req.body)));
guildRouter.post("/guild", HasParadoxBackendAuth, Route("create", (a, req) => CreateGuild(Store(), a, req.body),
    (req) => req.body?.leader_account_id));
guildRouter.get("/guild/invite/player", HasParadoxBackendAuth, Route("invites received", (a) => ReceivedInvites(Store(), a)));
guildRouter.get("/guild/invite/guild", HasParadoxBackendAuth, Route("invites sent", (a) => SentInvites(Store(), a)));
guildRouter.post("/guild/invite/accept/:inviteId", HasParadoxBackendAuth, Route("accept", (a, req) => AcceptInvite(Store(), a, req.params.inviteId)));
guildRouter.put("/guild/invite/:accountId", HasParadoxBackendAuth, Route("invite", (a, req) => InvitePlayer(Store(), a, req.params.accountId)));
guildRouter.delete("/guild/invite/:inviteId", HasParadoxBackendAuth, Route("decline/withdraw", (a, req) => DeleteInvite(Store(), a, req.params.inviteId)));
guildRouter.put("/guild/rank/:accountId/:rank", HasParadoxBackendAuth, Route("rank", (a, req) => SetRank(Store(), a, req.params.accountId, req.params.rank)));
guildRouter.delete("/guild/player/:accountId", HasParadoxBackendAuth, Route("kick", (a, req) => KickMember(Store(), a, req.params.accountId)));
guildRouter.delete("/guild/player", HasParadoxBackendAuth, Route("leave", (a) => LeaveGuild(Store(), a)));
guildRouter.delete("/guild/:guildId", HasParadoxBackendAuth, Route("disband", (a, req) => DisbandGuild(Store(), a, req.params.guildId)));

// Anything else under /guild the client asks for: logged so it can be added.
guildRouter.all(/^\/guild(\/.*)?$/, (req: any, res: any) => {
    logger.warn(`[Guild] unhandled ${req.method} ${req.path} body=${JSON.stringify(req.body ?? null).slice(0, 300)}`);
    res.status(404).json({ code: "ProcessRequestFailed", message: "Unknown guild request.", payload: null });
});
