import Link from "next/link";

export interface BrandProps {
  size?: number;
  tone?: "dark" | "light";
  href?: string | null;
  variant?: "responsive" | "desktop" | "mobile" | "badge";
  showWordmark?: boolean;
  className?: string;
}

/**
 * Payana Mitra brand emblem lockup.
 *
 * Supports both desktop (horizontal lockup) and mobile (stacked lockup) emblems,
 * as well as the circular badge mark for icon-only contexts.
 * Automatically adapts between tones ('dark' for light backgrounds, 'light' for dark backgrounds).
 */
export default function Brand({
  size = 76,
  tone = "dark",
  href = "/",
  variant = "responsive",
  showWordmark = true,
  className = "",
}: BrandProps) {
  const isBadgeOnly = !showWordmark || variant === "badge";

  const badgeSrc = "/brand/payana-mitra-badge.webp";
  const desktopSrc =
    tone === "light"
      ? "/brand/payana-mitra-desktop-light.webp"
      : "/brand/payana-mitra-desktop.webp";
  const mobileSrc =
    tone === "light"
      ? "/brand/payana-mitra-mobile-light.webp"
      : "/brand/payana-mitra-mobile.webp";

  const sizeStyle: React.CSSProperties = {
    height: size,
    width: "auto",
  };

  let emblemContent: React.ReactNode;

  if (isBadgeOnly) {
    emblemContent = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="brand-badge"
        src={badgeSrc}
        alt="Payana Mitra"
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
    );
  } else if (variant === "desktop") {
    emblemContent = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="brand-emblem brand-emblem-desktop"
        src={desktopSrc}
        alt="Payana Mitra"
        style={sizeStyle}
      />
    );
  } else if (variant === "mobile") {
    emblemContent = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className="brand-emblem brand-emblem-mobile"
        src={mobileSrc}
        alt="Payana Mitra"
        style={sizeStyle}
      />
    );
  } else {
    emblemContent = (
      <picture className="brand-emblem-picture">
        <source media="(min-width: 640px)" srcSet={desktopSrc} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="brand-emblem"
          src={mobileSrc}
          alt="Payana Mitra"
          style={sizeStyle}
        />
      </picture>
    );
  }

  const wrapperClass = `brand brand-${tone} ${className}`.trim();

  if (!href) {
    return <span className={wrapperClass}>{emblemContent}</span>;
  }
  return (
    <Link href={href} className={wrapperClass} aria-label="Payana Mitra — home">
      {emblemContent}
    </Link>
  );
}