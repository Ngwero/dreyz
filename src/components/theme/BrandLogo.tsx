"use client";

import Image from "next/image";
import { useTheme } from "@/components/theme/ThemeProvider";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  width?: number;
  height?: number;
  priority?: boolean;
}

export function BrandLogo({
  className,
  width = 180,
  height = 170,
  priority = false,
}: BrandLogoProps) {
  const { theme } = useTheme();
  const src = theme === "dark" ? "/logo-dark.png" : "/logo.png";

  return (
    <Image
      key={src}
      src={src}
      alt="Dreyz Interior Design School — Learn | Design | Inspire"
      width={width}
      height={height}
      className={cn("object-contain", className)}
      priority={priority}
    />
  );
}
