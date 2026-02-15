"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function ProfilePage() {
  const { status } = useSession();
  const router = useRouter();
  const fetchingRef = useRef(false);

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
      return;
    }
    if (status === "authenticated" && !fetchingRef.current) {
      fetchingRef.current = true;
      fetch("/api/users/me")
        .then((res) => res.json())
        .then((data) => {
          if (data.user?.username) {
            router.replace(`/profile/${data.user.username}`);
          }
        })
        .catch(() => router.replace("/login"));
    }
  }, [status, router]);

  return null;
}
