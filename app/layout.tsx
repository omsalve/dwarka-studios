import type { Metadata } from "next";
import { Cinzel, Inter, Playfair_Display } from "next/font/google";
import { MotionProvider } from "@/components/MotionProvider";
import "./globals.css";

const cinzel = Cinzel({
  variable: "--font-cinzel",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Dwarka Studios — Gaming & Immersive Technology",
  description:
    "Ancient soul. Intelligent core. Immersive future. Dwarka Studios designs and builds interactive worlds, intelligent visuals, cinematic effects, and immersive realities.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${cinzel.variable} ${inter.variable} ${playfair.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-bg text-ink font-sans">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
