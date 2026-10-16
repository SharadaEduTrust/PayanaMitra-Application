import Link from "next/link";

/**
 * Payana Trails brand lockup.
 *
 * The mark is a circular illustrated badge, so the wordmark sits beside it in
 * the brand serif rather than inside the image — the badge's own lettering is
 * unreadable below roughly 64px.
 */
export default function Brand({
  size = 40,
  tone = "dark",
  href = "/",
  showWordmark = true,
}: {
  size?: number;
  tone?: "dark" | "light";
  href?: string | null;
  showWordmark?: boolean;
}) {
  const content = (
    <>
      <img
        className="brand-badge"
        src="/brand/payana-trails-badge.webp"
        alt="Payana Trails"
        width={size}
        height={size}
        style={{ width: size, height: size }}
      />
      {showWordmark && (
        <span className="brand-lockup">
          <span className="brand-word">Payana</span>
          <span className="brand-sub">Trails</span>
        </span>
      )}
    </>
  );

  if (!href) {
    return <span className={`brand brand-${tone}`}>{content}</span>;
  }
  return (
    <Link href={href} className={`brand brand-${tone}`} aria-label="Payana Trails — home">
      {content}
    </Link>
  );
}