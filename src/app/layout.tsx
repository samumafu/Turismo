import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-body",
  subsets: ["latin"],
  display: "swap",
});
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Turismo Nariño | Tu viaje empieza en el sur",
    template: "%s | Turismo Nariño",
  },
  description:
    "Descubre Pasto y Nariño. Diseña un itinerario a tu ritmo con IA, lugares documentados y mapas abiertos. Turismo Inteligente Pasto, prototipo universitario.",
  applicationName: "Turismo Inteligente Pasto",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${manrope.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
