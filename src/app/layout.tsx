import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";

import { AppShell } from "@/components/layout/app-shell";
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
      </body>
    </html>
  );
}
