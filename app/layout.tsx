import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zerou — do vermelho ao zero",
  description: "Fale, digite ou fotografe seus gastos. A IA organiza, avisa quando você gasta demais e ajuda a sair das dívidas.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Zerou", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0f1115" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
