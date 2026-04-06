import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/lib/config/site";

import "./globals.css";

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
  metadataBase: new URL("https://nestmap.vercel.app"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${manrope.variable} ${jetBrainsMono.variable} dark h-full antialiased`}
    >
      <body className="bg-background text-foreground min-h-full">
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
