import Image from "next/image";
import { cn } from "@/lib/utils";
// Static import: served from /_next/static (basePath-aware and outside the login gate).
import mascot from "@/public/images/krypto-profile.png";

export const BRAND_NAME = "Krypto";
export const MASCOT_ALT = "Krypto, mascote cão cibernético";

/** Round mascot avatar. Decorative next to the brand name, meaningful on its own. */
export function BrandMark({ size = 28, decorative = true, className }: { size?: number; decorative?: boolean; className?: string }) {
  return (
    <Image
      src={mascot}
      alt={decorative ? "" : MASCOT_ALT}
      width={size}
      height={size}
      sizes={`${size}px`}
      className={cn("shrink-0 rounded-full ring-1 ring-brand/40", className)}
    />
  );
}

export function Brand({ className, nameClassName }: { className?: string; nameClassName?: string }) {
  return (
    <span className={cn("flex items-center gap-2 font-semibold tracking-tight", className)}>
      <BrandMark />
      <span className={nameClassName}>{BRAND_NAME}</span>
    </span>
  );
}
