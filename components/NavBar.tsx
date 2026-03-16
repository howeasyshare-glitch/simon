
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "../app/page.module.css";

export default function NavBar() {
  const pathname = usePathname();
  const nav = [
    { href: "/", label: "Home" },
    { href: "/explore", label: "Explore" },
    { href: "/my", label: "My" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <header className={styles.navShell}>
      <div className={styles.navInner}>
        <Link href="/" className={styles.brandMark}>FindOutfit</Link>
        <nav className={styles.navLinks}>
          {nav.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname?.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
