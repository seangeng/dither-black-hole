import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Black Hole",
  description: "Three.js Black Hole Visualization",
  icons: {
    icon: "/blackhole.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
