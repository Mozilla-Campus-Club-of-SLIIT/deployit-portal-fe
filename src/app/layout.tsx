import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Deploy(it) Portal",
  description: "A Cloud Run powered ephemeral web-terminal laboratory.",
  icons: {
    icon: "/devops.png",
  },
};

import { AuthProvider } from "@/context/AuthContext";
import { LabProvider } from "@/context/LabContext";
import ProvisioningBanner from "@/components/ProvisioningBanner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
        <AuthProvider>
          <LabProvider>
            {children}
          </LabProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
