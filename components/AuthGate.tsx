"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "../lib/supabase/browser";
import styles from "../app/page.module.css";

type Props = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => createClient(), []);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function check() {
      const { data } = await supabase.auth.getUser();
      if (!mounted) return;

      if (data?.user) {
        setAllowed(true);
        setLoading(false);
      } else {
        router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      }
    }

    check();
    return () => {
      mounted = false;
    };
  }, [pathname, router, supabase]);

  if (loading) {
    return (
      <div className={styles.authGateLoading}>
        <div>驗證登入狀態中...</div>
      </div>
    );
  }

  if (!allowed) return null;
  return <>{children}</>;
}
