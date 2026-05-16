import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { BrowserGate } from "@/components/patterns/BrowserGate";
import { ErrorBoundary } from "@/components/patterns/ErrorBoundary";
import { OutboxProvider } from "@/components/providers/OutboxProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Project R",
  description: "Plataforma de gestão de treino e desempenho",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ErrorBoundary>
          <BrowserGate>
            <OutboxProvider>{children}</OutboxProvider>
          </BrowserGate>
        </ErrorBoundary>
      </body>
    </html>
  );
}
