import type { Metadata } from "next";
import "./globals.css";
import SessionTimeoutWatcher from "@/components/session-timeout-watcher";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  ),
  title: "Payana Mitra — Travel, thoughtfully planned",
  description: "Personalized journeys for the way you actually travel.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <SessionTimeoutWatcher />
        {children}
      </body>
    </html>
  );
}
