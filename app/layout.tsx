import { AppShell } from "@/components/app-shell";
import { ThemeProvider } from "@/components/theme-provider";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const sans = Space_Grotesk({
  variable: "--font-body-sans",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const mono = JetBrains_Mono({
  variable: "--font-operator-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Just Proxy Guard",
  description: "Tenant-aware proxy guard for Grafana Mimir and agent traffic.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();
  const signedInUser = session?.user?.email || session?.user?.name || null;

  return (
    <html lang="en" className="light" data-theme="light" suppressHydrationWarning>
      <body className={`${sans.variable} ${mono.variable} min-h-screen bg-background text-foreground antialiased`}>
        <ThemeProvider>
          <AppShell signedInUser={signedInUser}>{children}</AppShell>
        </ThemeProvider>
      </body>
    </html>
  );
}

