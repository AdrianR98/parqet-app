import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Script id="assettrace-theme-init" strategy="beforeInteractive">
          {`(function(){try{var mode=localStorage.getItem("assettrace-appearance-mode-v1");if(mode!=="system"&&mode!=="light"&&mode!=="dark"){mode="system";}var resolved=mode==="light"||mode==="dark"?mode:(window.matchMedia&&window.matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.dataset.assettraceTheme=resolved;document.documentElement.style.colorScheme=resolved;}catch(e){}})();`}
        </Script>
        {children}
      </body>
    </html>
  );
}
