import { useCallback, useEffect, useRef, useState, type ComponentType, type SVGProps } from "react";
import { AboutIcon, HomeIcon, HostRealmIcon, LibraryIcon, RefreshIcon, ServersIcon, SettingsIcon } from "../components/icons";
import { AetherMark } from "../components/AetherMark";
import { useAuth } from "../auth/AuthContext";
import { useServer } from "../servers/ServerContext";
import { serverNaming } from "../servers/serverNames";
import { MNG_PLAYER_SERVERS, RealmInvitesProvider, useRealmInvites } from "../servers/RealmInvites";
import { ServicesProvider, useServices, type ServiceHealth } from "../services/ServicesContext";
import { useMediaQuery, useUiPrefs } from "../lib/prefs";
import { prefersReducedMotion, withViewTransition } from "../lib/platform";
import { buildName, formatClock } from "../lib/sessions";
import { OPTIONAL_PANELS } from "../lib/optionalPanels";
import { NoticeTags } from "../components/NoticeBanner";
import { HomeTab } from "./dashboard/HomeTab";
import { LibraryTab } from "./dashboard/LibraryTab";
import { ServersTab } from "./dashboard/ServersTab";
import { HostRealmTab } from "./dashboard/HostRealmTab";
import { AccountTab } from "./dashboard/AccountTab";
import { SettingsTab } from "./dashboard/SettingsTab";
import { AboutTab } from "./dashboard/AboutTab";

export type Tab = "home" | "library" | "servers" | "host" | "account" | "settings" | "about";

type NavItem = { id: Tab; label: string; icon: ComponentType<SVGProps<SVGSVGElement>> };

// [2026-10-14] "Host realm" exists only when a build ships an optional module's panel (src/p2p/*Panel.tsx). A public build
// has no such tab, so no nav item and no route to it.
const HOST_NAV_ITEM: NavItem = { id: "host", label: "Host MNG Server", icon: HostRealmIcon };
const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: HomeIcon },
  { id: "library", label: "Library", icon: LibraryIcon },
  // [2026-10-16] "Realms" (was "Servers & realms"): local servers are gone, so the page lists the official server and realms.
  { id: "servers", label: "MNG Server", icon: ServersIcon },
  // [MNG DAUNTLESS 2026-10-31] No "Host MNG Server" page: MNG DAUNTLESS is one community server, not player-hosted ones.
  ...(MNG_PLAYER_SERVERS && OPTIONAL_PANELS.length > 0 ? [HOST_NAV_ITEM] : []),
  { id: "settings", label: "Settings", icon: SettingsIcon },
  { id: "about", label: "About", icon: AboutIcon },
];

const SERVICE_TITLE: Record<ServiceHealth, string> = {
  checking: "Checking services",
  online: "Services online",
  degraded: "Service attention",
  unreachable: "Connection lost",
};

const SERVICE_SHORT: Record<ServiceHealth, string> = {
  checking: "CHECKING",
  online: "ONLINE",
  degraded: "ATTENTION",
  unreachable: "OFFLINE",
};

// [2026-10-13 realms S5] The card shows the SELECTED server's backend, so a local server is named instead of "Mystic Paradox".
function serviceDetail(health: ServiceHealth, serverName: string | null): string {
  const name = serverName ?? "MNG DAUNTLESS";
  switch (health) {
    case "checking": return `Contacting ${name}…`;
    case "online": return serverName ? `${serverName} backend healthy` : "Backend healthy";
    case "degraded": return serverName ? `${serverName} reports an issue` : "Backend reports an issue";
    default: return serverName ? `Can't reach ${serverName}` : "Can't reach the service";
  }
}

function ServicesCard() {
  const { health, checkedAt, refreshing, supportedChangelist, pingMs, refresh } = useServices();
  const { selected } = useServer();
  // Only a server other than the built-in official one is named (a realm by its realm name, servers/serverNames.ts).
  const serverName = selected && selected.kind !== "official" ? serverNaming(selected).primary : null;
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    // [2026-10-14] Escape closes the panel and returns focus to its trigger, so keyboard focus is not left in the hidden panel.
    const close = (event: PointerEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key !== "Escape") return;
        setOpen(false);
        triggerRef.current?.focus();
        return;
      }
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("keydown", close);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("keydown", close);
    };
  }, [open]);

  const healthDetail = serviceDetail(health, serverName);
  // [MNG DAUNTLESS 2026-10-31] The ping, when the server answered: good under 80 ms, fair under 150, slow above.
  const ping = health === "online" && pingMs != null ? `${pingMs} ms` : null;
  const pingQuality = pingMs == null ? "" : pingMs < 80 ? "good" : pingMs < 150 ? "fair" : "slow";
  const detail = refreshing
    ? "Refreshing…"
    : checkedAt ? [healthDetail, ping, formatClock(checkedAt)].filter(Boolean).join(" · ") : healthDetail;
  const supportedBuild = supportedChangelist ? `${buildName(supportedChangelist) ?? "CL"} · ${supportedChangelist}` : "Unknown";

  return (
    <div className="services-wrap" ref={wrapRef}>
      <div className="glass glass-strong services-pop" data-open={open} role="dialog" aria-label="Service status" aria-hidden={!open}>
        <div className="pop-title">
          <span>Service status</span>
          <button type="button" className={`icon-button${refreshing ? " spinning" : ""}`} onClick={() => void refresh()} disabled={refreshing} aria-label="Refresh service status" tabIndex={open ? 0 : -1}>
            <RefreshIcon />
          </button>
        </div>
        <dl className="pop-rows">
          {serverName && (<><dt>Server</dt><dd className="truncate" title={serverName}>{serverName}</dd></>)}
          <dt>Backend</dt>
          <dd>{SERVICE_TITLE[health].replace("Services ", "")}</dd>
          <dt>Ping</dt>
          <dd className={ping ? `ping ${pingQuality}` : undefined}>{ping ?? "—"}</dd>
          <dt>Accepted build</dt>
          <dd>{supportedBuild}</dd>
          <dt>Last check</dt>
          <dd>{checkedAt ? formatClock(checkedAt) : "—"}</dd>
        </dl>
      </div>
      {/* [MNG DAUNTLESS 2026-10-31] Top-right status: the server and its state in small capitals, the detail under it, and a
          round status button (the reference design's "game - in game" corner). */}
      <button
        ref={triggerRef}
        type="button"
        className="services"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        aria-label={`${SERVICE_TITLE[health]}. ${detail}. Show service status.`}
      >
        <span className="services-copy">
          <span className="services-title" aria-live="polite">{(serverName ?? "MNG DAUNTLESS").toUpperCase()} · {SERVICE_SHORT[health]}</span>
          <span className="services-sub">{detail}</span>
        </span>
        <span className="services-orb" aria-hidden="true"><span className={`status-dot ${health}`} /></span>
      </button>
    </div>
  );
}

function Shell() {
  const { account } = useAuth();
  // [2026-10-16] Realm invites waiting for an answer: counted on the Realms item.
  const { invites } = useRealmInvites();
  const prefs = useUiPrefs();
  // [2026-10-31] The top bar fits its labels down to about 1020 px (the default window is 1120).
  const narrow = useMediaQuery("(max-width: 1019px)");
  const compact = prefs.sidebar === "compact" || (prefs.sidebar === "auto" && narrow);
  const [tab, setTab] = useState<Tab>(initialTab);
  const mainRef = useRef<HTMLElement>(null);

  const navigate = useCallback((next: Tab) => {
    if (next === tab) return;
    withViewTransition(() => setTab(next));
    mainRef.current?.scrollTo({ top: 0 });
  }, [tab]);

  const displayName = account?.displayName ?? "Slayer";
  const accountLine = account?.status === "active" && account.approvalStatus === "approved" ? "Signed in" : "Check account";

  let page;
  switch (tab) {
    case "home": page = <HomeTab onOpenAccount={() => navigate("account")} onNavigate={navigate} />; break;
    case "library": page = <LibraryTab />; break;
    case "servers": page = <ServersTab />; break;
    case "host": page = <HostRealmTab />; break;
    case "account": page = <AccountTab />; break;
    case "settings": page = <SettingsTab />; break;
    default: page = <AboutTab />;
  }

  // [MNG DAUNTLESS 2026-10-31] Layout (the owner's reference design): a slim left rail of round icon buttons - the MNG mark,
  // Home on its own, the other pages in one grouped pill - and a top-right corner with the server's state and the account
  // avatar. The original had a 252 px sidebar. Every rail button names itself in a tooltip and an aria-label.
  const renderNavItem = ({ id, label, icon: ItemIcon }: NavItem) => {
    const count = id === "servers" ? invites.length : 0;
    const tip = count > 0 ? `${label} · ${count === 1 ? "1 invite" : `${count} invites`}` : label;
    return (
      <button
        key={id}
        type="button"
        className="nav-item"
        aria-current={tab === id ? "page" : undefined}
        onClick={() => navigate(id)}
        data-tip={tip}
        aria-label={tip}
      >
        <ItemIcon />
        {count > 0 && <span className="nav-badge" aria-hidden="true">{count}</span>}
      </button>
    );
  };
  const [homeItem, ...otherItems] = NAV_ITEMS;

  return (
    <div className="shell" data-compact={compact}>
      <aside className="rail" data-tauri-drag-region>
        <div className="brand-mark" title="MNG DAUNTLESS"><AetherMark title={null} /></div>
        <nav className="nav" aria-label="Launcher navigation">
          <div className="nav-group nav-group-solo">{renderNavItem(homeItem)}</div>
          <div className="nav-group">{otherItems.map(renderNavItem)}</div>
        </nav>
      </aside>

      <div className="corner">
        {/* [2026-10-15] The launcher's tags (EXPERIMENTAL BUILD and the like). */}
        <NoticeTags className="brand-tags" />
        <ServicesCard />
        <button
          type="button"
          className="me"
          aria-current={tab === "account" ? "page" : undefined}
          onClick={() => navigate("account")}
          data-tip={`${displayName} · ${accountLine}`}
          aria-label={`${displayName}: ${accountLine}. Open your account.`}
        >
          <span className="avatar" aria-hidden="true">{displayName.slice(0, 1).toUpperCase()}</span>
          <span className={`me-dot${accountLine === "Signed in" ? " ok" : ""}`} aria-hidden="true" />
        </button>
      </div>

      <main className="main" ref={mainRef} aria-label="Launcher content">
        {/* [2026-10-15] The sticky announcement, above the tab's page (outside it, so it does not replay on a tab change). */}
        {/* [MNG DAUNTLESS 2026-10-31] Each page shows the announcements itself, on its art: Home above the cards, the other
            pages under their title. The strip above the page (NoticeDock) sat on a plain dark band outside the art. */}
        <div key={tab} className={`page-host${supportsViewTransitions() ? "" : " page-enter"}`}>
          {page}
        </div>
      </main>
    </div>
  );
}

// Dev browser preview only: `?tab=library` opens a tab directly for screenshots.
function initialTab(): Tab {
  if (!import.meta.env.DEV) return "home";
  const requested = new URLSearchParams(window.location.search).get("tab");
  return NAV_ITEMS.find((item) => item.id === requested)?.id ?? "home";
}

// With View Transitions the page cross-fade is the entry animation; otherwise a CSS rise.
function supportsViewTransitions(): boolean {
  return typeof document !== "undefined" && "startViewTransition" in document && !prefersReducedMotion();
}

export function DashboardShell() {
  return (
    <ServicesProvider>
      <RealmInvitesProvider>
        <Shell />
      </RealmInvitesProvider>
    </ServicesProvider>
  );
}
