import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";
import { ThemeSync } from "@/components/theme/theme-sync";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/lib/config/site";
import { THEME_STORAGE_KEY } from "@/lib/theme/preference";

import "./globals.css";
import "maplibre-gl/dist/maplibre-gl.css";

function resolveMetadataBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  if (configured) {
    try {
      return new URL(configured);
    } catch {
      // Fall through to stable default.
    }
  }

  return new URL("https://roofhub.vercel.app");
}

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.title,
    template: `%s | ${siteConfig.name}`,
  },
  description: siteConfig.description,
  metadataBase: resolveMetadataBaseUrl(),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const themeInitScript = `(() => {
    const storageKey = "${THEME_STORAGE_KEY}";
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const storedPreference = localStorage.getItem(storageKey);
    const preference =
      storedPreference === "light" || storedPreference === "dark" || storedPreference === "system"
        ? storedPreference
        : "system";
    const activeTheme = preference === "system" ? (prefersDark ? "dark" : "light") : preference;
    const root = document.documentElement;
    root.classList.toggle("dark", activeTheme === "dark");
  })();`;

  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetBrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-full">
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <ThemeSync />
        <AppShell>{children}</AppShell>
        <Toaster
          richColors
          closeButton
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: "bg-popover/98 border border-border text-popover-foreground shadow-xl",
              title: "text-sm font-semibold",
              description: "text-sm text-muted-foreground",
              actionButton:
                "bg-primary text-primary-foreground hover:bg-primary/90 rounded-md px-3 py-1.5 text-xs",
            },
          }}
        />
      </body>
    </html>
  );
}
