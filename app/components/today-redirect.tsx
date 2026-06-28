"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TodayRedirect() {
  const router = useRouter();
  useEffect(() => {
    const d = new Date();
    const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    router.replace(`/?date=${local}`);
  }, [router]);
  return null;
}
