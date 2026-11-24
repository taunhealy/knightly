import { useState, useEffect } from 'react';
import type React from 'react';
import type { PropertyMapItem } from '@/components/PropertyMap';

export interface UseP24FavouritesOptions {
  anchorLat?: number;
  anchorLng?: number;
}

export function useP24Favourites({ anchorLat, anchorLng }: UseP24FavouritesOptions = {}) {
  const [favouritePropertyIds, setFavouritePropertyIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('homeseek_p24_favourite_ids');
        return stored ? JSON.parse(stored) : [];
      } catch {}
    }
    return [];
  });

  // Imported favourites live in session memory only. Full listing snapshots are never persisted,
  // so rented/expired listings can't be resurrected from localStorage — listings must come from a fresh scrape.
  const [importedFavourites, setImportedFavourites] = useState<PropertyMapItem[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('homeseek_imported_favourites_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('homeseek_imported_favourites_v1', JSON.stringify(importedFavourites));
    } catch {
      // Ignore storage quota errors
    }
  }, [importedFavourites]);

  useEffect(() => {
    try {
      localStorage.removeItem('homeseek_p24_favourites');
    } catch {}
  }, []);

  const [showOnlyFavourites, setShowOnlyFavourites] = useState<boolean>(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState<boolean>(false);
  const [importInputText, setImportInputText] = useState<string>('');
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [importStatusMsg, setImportStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const toggleFavouriteProperty = (prop: PropertyMapItem, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setFavouritePropertyIds((prev) => {
      const isFav = prev.includes(prop.id);
      const updated = isFav ? prev.filter((id) => id !== prop.id) : [...prev, prop.id];
      try {
        localStorage.setItem('homeseek_p24_favourite_ids', JSON.stringify(updated));
      } catch {}
      return updated;
    });

    setImportedFavourites((prev) => {
      const exists = prev.some((p) => p.id === prop.id);
      return exists ? prev.filter((p) => p.id !== prop.id) : prev;
    });
  };

  const clearAllFavourites = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setFavouritePropertyIds([]);
    setImportedFavourites([]);
    setShowOnlyFavourites(false);
    try {
      localStorage.removeItem('homeseek_p24_favourite_ids');
      localStorage.removeItem('homeseek_p24_favourites');
    } catch {}
  };

  const handleImportFavourites = async () => {
    if (!importInputText.trim()) return;
    setIsImporting(true);
    setImportStatusMsg(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/p24/import-favourites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_input: importInputText,
          anchor_lat: anchorLat,
          anchor_lng: anchorLng,
        }),
      });

      if (!res.ok) {
        throw new Error(`Import failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data.status === 'success' && Array.isArray(data.listings) && data.listings.length > 0) {
        const newListings: PropertyMapItem[] = data.listings;

        setImportedFavourites((prev) => {
          const merged = [...prev];
          for (const item of newListings) {
            const itemExt = item as PropertyMapItem & { p24_id?: string };
            const idx = merged.findIndex((m) => {
              const mExt = m as PropertyMapItem & { p24_id?: string };
              return m.id === item.id || (mExt.p24_id && mExt.p24_id === itemExt.p24_id);
            });
            if (idx >= 0) {
              merged[idx] = { ...merged[idx], ...item, is_favorite: true };
            } else {
              merged.push({ ...item, is_favorite: true });
            }
          }
          return merged;
        });

        setFavouritePropertyIds((prev) => {
          const idsSet = new Set(prev);
          newListings.forEach((item) => idsSet.add(item.id));
          const updatedIds = Array.from(idsSet);
          try {
            localStorage.setItem('homeseek_p24_favourite_ids', JSON.stringify(updatedIds));
          } catch {}
          return updatedIds;
        });

        setImportStatusMsg({
          type: 'success',
          text: `Successfully imported ${newListings.length} Property24 favourite${newListings.length === 1 ? '' : 's'}!`,
        });

        setTimeout(() => {
          setIsImportModalOpen(false);
          setImportInputText('');
          setImportStatusMsg(null);
          setShowOnlyFavourites(true);
        }, 1200);
      } else {
        setImportStatusMsg({
          type: 'error',
          text: data.message || 'No Property24 listings could be found or extracted. Please check the URLs or HTML and try again.',
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setImportStatusMsg({
        type: 'error',
        text: `Error connecting to scraper: ${msg}`,
      });
    } finally {
      setIsImporting(false);
    }
  };

  return {
    favouritePropertyIds,
    importedFavourites,
    setImportedFavourites,
    showOnlyFavourites,
    setShowOnlyFavourites,
    isImportModalOpen,
    setIsImportModalOpen,
    importInputText,
    setImportInputText,
    isImporting,
    importStatusMsg,
    toggleFavouriteProperty,
    clearAllFavourites,
    handleImportFavourites,
  };
}
