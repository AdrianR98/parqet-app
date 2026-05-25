import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import ThemeDocumentSync from "../components/theme/ThemeDocumentSync";
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

const ADMIN_RETURN_RESTORE_SCRIPT = `
(() => {
  try {
    const pendingKey = "assettrace:admin-return-pending";
    const reloadedForKey = "assettrace:admin-return-reloaded-for";
    const staticFilePattern = /\\.(?:css|js|png|jpg|jpeg|gif|svg|ico|webp|avif|map|txt|xml)$/i;

    const isReloadablePath = (pathname) => {
      if (typeof pathname !== "string" || !pathname.startsWith("/")) return false;
      if (pathname.startsWith("/admin")) return false;
      if (pathname.startsWith("/api")) return false;
      if (pathname.startsWith("/_next")) return false;
      if (staticFilePattern.test(pathname)) return false;
      return true;
    };

    const checkAdminReturn = () => {
      try {
        const pathname = window.location.pathname;
        const pending = window.sessionStorage.getItem(pendingKey);
        const reloadedFor = window.sessionStorage.getItem(reloadedForKey);

        if (pending !== "1") return;
        if (!isReloadablePath(pathname)) return;

        if (reloadedFor === pathname) {
          window.sessionStorage.removeItem(pendingKey);
          window.sessionStorage.removeItem(reloadedForKey);
          return;
        }

        window.sessionStorage.setItem(reloadedForKey, pathname);
        window.location.reload();
      } catch (_error) {}
    };

    checkAdminReturn();
    window.setTimeout(checkAdminReturn, 0);
    window.setTimeout(checkAdminReturn, 100);

    window.addEventListener("pageshow", checkAdminReturn);
    window.addEventListener("popstate", () => window.setTimeout(checkAdminReturn, 0));
    window.addEventListener("focus", checkAdminReturn);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) checkAdminReturn();
    });
  } catch (_error) {}
})();
`;

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
