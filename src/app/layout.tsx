import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import AdminReturnRestoreGuard from "../components/navigation/AdminReturnRestoreGuard";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="de"
      data-theme="dark"
      data-assettrace-theme="dark"
      style={{ colorScheme: "dark" }}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ThemeDocumentSync />
        <AdminReturnRestoreGuard />
        {children}
      </body>
    </html>
  );
}
