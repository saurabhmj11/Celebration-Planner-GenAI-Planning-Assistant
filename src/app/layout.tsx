import type { Metadata, Viewport } from "next";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Celebration & Event Planner | GenAI Event Planning Assistant",
  description:
    "Plan weddings, birthdays, anniversaries, and community events with AI-generated theme ideas, smart budget tracking, phased timelines, and vendor checklists — all in one celebration command center.",
  keywords: [
    "event planner",
    "wedding planner",
    "birthday party",
    "budget tracker",
    "vendor checklist",
    "AI event ideas",
    "celebration timeline",
  ],
  icons: {
    icon: [
      {
        url: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>✨</text></svg>",
      },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Celebration & Event Planner",
  },
  openGraph: {
    title: "Celebration & Event Planner",
    description:
      "GenAI-powered planning assistant for weddings, birthdays, and community events — budgets, timelines, vendor checklists, and personalized ideas.",
    siteName: "Celebration & Event Planner",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#7c3aed",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full scroll-smooth" suppressHydrationWarning>
      <body className="h-full antialiased selection:bg-brand-500 selection:text-white">
        {/* Premium display + body typography (React hoists these into <head>) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* Light/dark/system theme — persists via localStorage, class strategy
            consumed by the .dark inversion layer in globals.css. */}
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  );
}
