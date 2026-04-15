"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Hook that keeps a Set of favorite stream IDs in sync with the server.
 * Uses optimistic updates — toggle() flips local state immediately, then
 * POSTs to /api/me/favorites; on failure it rolls back.
 */
export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/me/favorites");
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data.favoriteStreamIds)) {
          setFavorites(new Set<number>(data.favoriteStreamIds));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = useCallback(async (streamId: number) => {
    const currentlyFav = favorites.has(streamId);
    const nextFav = !currentlyFav;

    // Optimistic
    setFavorites((prev) => {
      const next = new Set(prev);
      if (nextFav) next.add(streamId);
      else next.delete(streamId);
      return next;
    });

    try {
      const res = await fetch("/api/me/favorites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ streamId, favorite: nextFav }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.favoriteStreamIds)) {
        setFavorites(new Set<number>(data.favoriteStreamIds));
      }
    } catch {
      // Rollback
      setFavorites((prev) => {
        const next = new Set(prev);
        if (currentlyFav) next.add(streamId);
        else next.delete(streamId);
        return next;
      });
    }
  }, [favorites]);

  return { favorites, loading, toggle };
}
