import type { Metadata, Viewport } from "next";
import { Lexend_Deca, Nunito_Sans } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

const lexend = Lexend_Deca({ subsets: ["latin"], variable: "--font-lexend", display: "swap" });
const nunito = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Soporte BI · BHI Consultora", template: "%s · Soporte BI" },
  description: "Reclamos y consultas sobre los tableros de Power BI de BHI Consultora Regional.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#005278", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Leer el nonce hace que todas las páginas sean dinámicas: Next lo aplica a sus scripts.
  await headers();
  return (
    <html lang="es-AR" className={`${lexend.variable} ${nunito.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
