import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeDocumentSync from "../components/theme/ThemeDocumentSync";
import { buildAdminReturnRestoreScript } from "../lib/admin-return-restore-guard";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AssetTrace",
  description: "Analyse- und Transparenzschicht für Parqet-Daten",
};

const PRE_HYDRATION_THEME_SCRIPT = `
(() => {
  try {
    const key = "assettrace-appearance-mode-v1";
    const raw = window.localStorage.getItem(key);
    const appearance = raw === "light" || raw === "dark" || raw === "system" ? raw : "system";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme = appearance === "system" ? (prefersDark ? "dark" : "light") : appearance;
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.assettraceTheme = resolvedTheme;
    root.dataset.appearance = appearance;
    root.style.colorScheme = resolvedTheme;
  } catch (_error) {}
})();
`;

const ADMIN_RETURN_RESTORE_SCRIPT = buildAdminReturnRestoreScript();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      suppressHydrationWarning
      data-theme="dark"
      data-assettrace-theme="dark"
      data-appearance="system"
      style={{ colorScheme: "dark" }}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: PRE_HYDRATION_THEME_SCRIPT }} />
        <script dangerouslySetInnerHTML={{ __html: ADMIN_RETURN_RESTORE_SCRIPT }} />
        <ThemeDocumentSync />
        {children}
      </body>
    </html>
  );
}
