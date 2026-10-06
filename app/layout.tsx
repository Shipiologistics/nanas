import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./readability.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const title = "Nanas | Trusted care, close to home in The Bahamas";
const description =
  "Find trusted people for senior care, child care, home healthcare, housekeeping, tutoring, pet care, and more across The Bahamas.";

export function generateMetadata(): Metadata {
  const metadataBase = new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  );
  const imageUrl = new URL("/og.png", metadataBase).toString();

  return {
    metadataBase,
    title,
    description,
    alternates: { canonical: "/" },
    icons: {
      icon: "/favicon.svg",
      shortcut: "/favicon.svg",
    },
    openGraph: {
      title,
      description,
      url: "/",
      siteName: "Nanas",
      locale: "en_BS",
      type: "website",
      images: [
        {
          url: imageUrl,
          width: 1536,
          height: 864,
          alt: "Nanas — trusted care, close to home",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [imageUrl],
    },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
