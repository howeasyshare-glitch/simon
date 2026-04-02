"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import styles from "../app/page.module.css";
import { createClient } from "../lib/supabase/browser";

type SessionUser = {
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
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const items = [
    { href: "/", label: "Home" },
    { href: "/explore", label: "Explore" },
    { href: "/my", label: "My" },
  ];

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;
      setUser((data?.user as SessionUser | null) ?? null);
      setLoading(false);
    }

    loadUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((session?.user as SessionUser | null) ?? null);
      setLoading(false);
      router.refresh();
    });

    function handleClickOutside(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      mounted = false;
      subscription.unsubscribe();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [router, supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    setOpen(false);
    router.push("/");
    router.refresh();
  }

  const displayName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split("@")[0] ||
    "User";

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";
  const avatarLetter = displayName.slice(0, 1).toUpperCase();

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

          {loading ? (
            <div className={styles.avatarSkeleton} />
          ) : !user ? (
            <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`} className={styles.navItem}>
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
                  <div className={styles.avatar}>{avatarLetter}</div>
                )}
              </button>

              {open ? (
                <div className={styles.profileMenu}>
                  <div className={styles.profileCard}>
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className={styles.profileAvatarImage} />
                    ) : (
                      <div className={styles.profileAvatar}>{avatarLetter}</div>
                    )}
                    <div>
                      <div className={styles.profileName}>{displayName}</div>
                      <div className={styles.profileMeta}>{user.email}</div>
                    </div>
                  </div>

                  <div className={styles.profileMenuList}>
                    <Link href="/settings" className={styles.profileMenuItem} onClick={() => setOpen(false)}>
                      基本資料
                    </Link>
                    <Link href="/system" className={styles.profileMenuItem} onClick={() => setOpen(false)}>
                      設定
                    </Link>
                    <button type="button" className={styles.profileMenuButton} onClick={handleLogout}>
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
