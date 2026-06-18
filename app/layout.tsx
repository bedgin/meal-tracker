import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meal Tracker",
  description: "Track your daily calories and protein",
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
