"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DashboardIndexPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/plans");
  }, [router]);
  return null;
}
