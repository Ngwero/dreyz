import type { Metadata } from "next";
import { Plus_Jakarta_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AuthProvider } from "@/components/auth/AuthProvider";
import { FlashHost } from "@/components/ui/FlashHost";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dreyz Interior Design School | Learn · Design · Inspire",
  description:
    "Turn your passion for interiors into a career. Dreyz Interior Design School in Kyaliwajjala offers hands-on training, industry placement, and a certificate that gets you hired.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('dreyz-theme');
    var theme = stored === 'dark' ? 'dark' : 'light';
    if (theme === 'dark') document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jakarta.variable} ${jetbrains.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="min-h-full overflow-x-hidden font-sans">
        <ThemeProvider>
          <AuthProvider>
            <FlashHost />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
