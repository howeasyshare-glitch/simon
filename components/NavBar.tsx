"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../app/page.module.css";

export default function NavBar() {
  const pathname = usePathname();
  const items = [
    { href: "/", label: "Home" },
    { href: "/explore", label: "Explore" },
    { href: "/my", label: "My" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <header className={styles.topbarWrap}>
      <div className={styles.topbar}>
        <Link href="/" className={styles.brand}>FindOutfit</Link>
        <nav className={styles.nav}>
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link key={item.href} href={item.href} className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}>
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
