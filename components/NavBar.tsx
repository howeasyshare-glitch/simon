"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "../app/page.module.css";

export default function NavBar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const items = [
    { href: "/", label: "Home" },
    { href: "/explore", label: "Explore" },
    { href: "/my", label: "My" },
  ];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className={styles.topbarWrap}>
      <div className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          FindOutfit
        </Link>

        <div className={styles.topbarRight}>
          <nav className={styles.nav}>
            {items.map((item) => {
              const active =
                item.href === "/"
                  ? pathname === "/"
                  : pathname === item.href || pathname?.startsWith(item.href + "/");

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className={styles.profileWrap} ref={menuRef}>
            <button
              type="button"
              className={styles.avatarButton}
              onClick={() => setOpen((v) => !v)}
              aria-label="Open profile menu"
            >
              <div className={styles.avatar}>U</div>
            </button>

            {open ? (
              <div className={styles.profileMenu}>
                <div className={styles.profileCard}>
                  <div className={styles.profileAvatar}>U</div>
                  <div>
                    <div className={styles.profileName}>User</div>
                    <div className={styles.profileMeta}>findoutfit demo account</div>
                  </div>
                </div>

                <div className={styles.profileMenuList}>
                  <Link href="/settings" className={styles.profileMenuItem} onClick={() => setOpen(false)}>
                    基本資料
                  </Link>
                  <Link href="/system" className={styles.profileMenuItem} onClick={() => setOpen(false)}>
                    設定
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
