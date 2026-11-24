import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenTrack - Self-Hosted Issue & Project Tracker",
  description:
    "Open-source issue & project tracker with Kanban swimlanes, Cycles, Saved Views, Projects, and REST API.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark">
      <body className="bg-background text-foreground antialiased overflow-x-hidden selection:bg-foreground/15 selection:text-foreground">
        {children}
      </body>
    </html>
  );
}
