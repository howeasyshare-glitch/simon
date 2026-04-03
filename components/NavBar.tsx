"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import styles from "../app/page.module.css";
import { supabase } from "../lib/supabase/client";

type AuthUser = {
  email?: string;
  user_metadata?: {
    avatar_url?: string;
    full_name?: string;
    name?: string;
    picture?: string;
  };
};

export default function NavBar() {
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const items = [
    { href: "/", label: "Home" },
    { href: "/explore", label: "Explore" },
    { href: "/my", label: "My" },
  ];

  useEffect(() => {
    let mounted = true;

    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setUser((data.user as AuthUser) || null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((session?.user as AuthUser) || null);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

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

  async function handleLogout() {
    await supabase.auth.signOut();
    setOpen(false);
    window.location.href = "/";
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "User";

  const avatarUrl =
    user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";

  const avatarFallback = String(displayName).trim().charAt(0).toUpperCase() || "U";

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

          {!user ? (
            <Link href="/login" className={styles.navItem}>
              Login
            </Link>
          ) : (
            <div className={styles.profileWrap} ref={menuRef}>
              <button
                type="button"
                className={styles.avatarButton}
                onClick={() => setOpen((v) => !v)}
                aria-label="Open profile menu"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={displayName} className={styles.avatarImage} />
                ) : (
                  <div className={styles.avatar}>{avatarFallback}</div>
                )}
              </button>

              {open ? (
                <div className={styles.profileMenu}>
                  <div className={styles.profileCard}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className={styles.profileAvatarImage} />
                    ) : (
                      <div className={styles.profileAvatar}>{avatarFallback}</div>
                    )}

                    <div>
                      <div className={styles.profileName}>{displayName}</div>
                      <div className={styles.profileMeta}>{user.email}</div>
                    </div>
                  </div>

                  <div className={styles.profileMenuList}>
                    <Link
                      href="/settings"
                      className={styles.profileMenuItem}
                      onClick={() => setOpen(false)}
                    >
                      基本資料
                    </Link>
                    <Link
                      href="/system"
                      className={styles.profileMenuItem}
                      onClick={() => setOpen(false)}
                    >
                      系統設定
                    </Link>
                    <button
                      type="button"
                      className={styles.profileMenuItemButton}
                      onClick={handleLogout}
                    >
                      登出
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
