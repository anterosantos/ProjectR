import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { BrowserGate } from "@/components/patterns/BrowserGate";
import { ErrorBoundary } from "@/components/patterns/ErrorBoundary";
import { OutboxProvider } from "@/components/providers/OutboxProvider";

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const darkModeScript = `
  (function() {
    try {
      var mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) document.documentElement.classList.add('dark');
      mq.addEventListener('change', function(e) {
        document.documentElement.classList.toggle('dark', e.matches);
      });
    } catch(e) {}
  })();
`;

export const metadata: Metadata = {
  title: "SPARTA",
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
      lang="pt-PT"
      className={`${interTight.variable} ${jetBrainsMono.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: darkModeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:top-4 focus:left-4 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:border-2 focus:border-border focus:shadow-lg"
        >
          Saltar para o conteúdo
        </a>
        <ErrorBoundary>
          <BrowserGate>
            <OutboxProvider>{children}</OutboxProvider>
          </BrowserGate>
        </ErrorBoundary>
      </body>
    </html>
  );
}
