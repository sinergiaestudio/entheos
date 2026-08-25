/* eslint-disable @next/next/no-img-element -- the brand asset is intentionally served without an image optimizer */

export function BrandMark({ compact = false, pulse = false }: { compact?: boolean; pulse?: boolean }) {
  const size = compact ? 28 : pulse ? 72 : 42;
  return <span className={`${pulse ? "pulse-logo" : "brand-mark"}${compact ? " mini" : ""}`} aria-hidden="true">
    <img
      src="/entheos-mark.png"
      alt=""
      width={size}
      height={size}
      loading={!compact && !pulse ? "eager" : "lazy"}
      decoding="async"
      fetchPriority={!compact && !pulse ? "high" : "auto"}
    />
  </span>;
}
