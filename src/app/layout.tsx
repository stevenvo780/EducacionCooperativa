import type { Metadata } from "next";
// import { Inter } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/AuthProvider";

// const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "AgoraSync",
  description: "Collaborative Learning Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="">
        <AuthProvider>
            {children}
        </AuthProvider>
      </body>
    </html>
  );
}
