import mngLogo from "../assets/brand/mng-logo.png";

/** The MNG DAUNTLESS logo, used across the launcher brand surfaces. Wrapped in an svg so the existing `.x svg` sizing rules apply. */
export function AetherMark({ size, className, title = "MNG DAUNTLESS" }: { size?: number; className?: string; title?: string | null }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-label={title ?? undefined}
      aria-hidden={title ? undefined : true}
    >
      <image href={mngLogo} x="0" y="0" width="64" height="64" preserveAspectRatio="xMidYMid meet" />
    </svg>
  );
}
