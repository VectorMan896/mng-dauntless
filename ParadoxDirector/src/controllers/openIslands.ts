/*
 * [MNG DAUNTLESS 2026-11-13] Open islands: a solo hunter is sent into a running Hunting Grounds island of the same hunt that
 * has room, instead of getting a server of their own (gameservers.ts TryReuseSharedHuntServer, upstream's Public Hunt Server
 * Reuse). Parties still get their own island, and anyone can join it while it has room. The runtime gives a late joiner
 * the island's hunt id, so rewards and kill credit work (dllmain.cpp "Late-joiner PlayerHuntId backfill").
 */

export interface OpenIslandServer {
    expectedPlayers?: { playerUid: string; playerHuntId: string }[];
    joinTimes?: number[];
    startTime: Date;
    readyTime?: Date;
}

export function OpenIslandsEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
    const Mng = env.MNG_OPEN_ISLANDS?.trim();
    if (Mng) return !/^(0|off|false|no)$/i.test(Mng);
    return true;
}

export const OPEN_ISLAND_COUNT_FRESH_MS = 30_000;
export const OPEN_ISLAND_JOIN_WINDOW_MS = 120_000;

export function ParseOpenIslandPlayerCount(Text: string, NowMs: number): number | undefined {
    const [CountText, StampText] = Text.trim().split(/\s+/);
    const Count = Number(CountText);
    const StampMs = Number(StampText) * 1000;
    if(!Number.isSafeInteger(Count) || Count < 0 || !Number.isFinite(StampMs)) return undefined;
    return NowMs - StampMs <= OPEN_ISLAND_COUNT_FRESH_MS ? Count : undefined;
}

/**
 * How many players an island holds or is about to: the connected players plus everyone sent there in the last 2 minutes (they
 * may still be loading; one who already connected is counted twice for that while, which only errs on the full side). The
 * launch roster counts as sent at the server's start. Without a fresh count (an older runtime) it is the roster, as upstream.
 * Undefined = do not send anyone: nobody is connected and nobody is on the way, so the server is about to close itself.
 */
export function OpenIslandOccupancy(Server: OpenIslandServer, Connected: number | undefined, NowMs: number): number | undefined {
    const Roster = Server.expectedPlayers?.length ?? 0;
    if(Connected === undefined) return Roster;
    const Started = (Server.readyTime ?? Server.startTime).getTime();
    const LateJoins = Server.joinTimes ?? [];
    const LaunchRoster = Math.max(Roster - LateJoins.length, 0);
    const OnTheWay = (NowMs - Started < OPEN_ISLAND_JOIN_WINDOW_MS ? LaunchRoster : 0)
        + LateJoins.filter((At) => NowMs - At < OPEN_ISLAND_JOIN_WINDOW_MS).length;
    if(Connected === 0 && OnTheWay === 0) return undefined;
    return Connected + OnTheWay;
}
