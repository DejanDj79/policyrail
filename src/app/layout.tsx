import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PolicyRail",
  description: "The financial policy layer for autonomous AI agents.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
