import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QR Restaurant Ordering System",
  description: "Pemesanan restoran melalui QR meja.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
