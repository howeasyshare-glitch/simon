// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "findoutfit",
  description: "Find your best outfit",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
