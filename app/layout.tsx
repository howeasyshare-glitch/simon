import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'findoutfit',
  description: 'Find your best outfit',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <body>
        <div className="shell">
          <header className="shellHeader">
            <Link href="/"><b>findoutfit</b></Link>
            <nav className="shellNav">
              <Link href="/explore">Explore</Link>
              <Link href="/my">我的穿搭</Link>
              <Link href="/settings">設定</Link>
            </nav>
          </header>
          <div className="shellMain">{children}</div>
        </div>
      </body>
    </html>
  );
}
