import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Construction Operations SaaS",
  description: "Construction project and operations management platform",
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
