import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { fetchWorkspace, getDefaultApiBaseUrl, saveWorkspace, type MobileProperty } from './api';

export interface AuthUserState {
  uid: string;
  email?: string;
  displayName?: string;
  idToken?: string | null;
}

interface SearchPrefill {
  suburbs?: string[];
  minPrice?: number;
  maxPrice?: number;
  bedrooms?: string;
}

interface HomeSeekContextValue {
  apiBaseUrl: string;
  setApiBaseUrl: (url: string) => void;
  authUser: AuthUserState;
  setAuthUser: (u: AuthUserState) => void;
  compareList: MobileProperty[];
  toggleCompare: (prop: MobileProperty) => void;
  replaceCompare: (oldId: string, newProp: MobileProperty) => void;
  removeCompare: (id: string) => void;
  clearCompare: () => void;
  favourites: MobileProperty[];
  toggleFavourite: (prop: MobileProperty) => void;
  isFavourite: (id: string) => boolean;
  hiddenIds: string[];
  toggleHide: (id: string) => void;
  personalPreferences: string;
  setPersonalPreferences: (val: string) => void;
  searchPrefill: SearchPrefill | null;
  setSearchPrefill: (val: SearchPrefill | null) => void;
}

const HomeSeekContext = createContext<HomeSeekContextValue | null>(null);

export const HomeSeekProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiBaseUrl, setApiBaseUrl] = useState<string>(getDefaultApiBaseUrl());
  const [authUser, setAuthUser] = useState<AuthUserState>({ uid: 'local-dev-user', displayName: 'CapeTownExplorer' });
  const [compareList, setCompareList] = useState<MobileProperty[]>([]);
  const [favourites, setFavourites] = useState<MobileProperty[]>([]);
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);
  const [personalPreferences, setPersonalPreferences] = useState<string>(
    'Work from home (part-time), 100% Private (no landlord on-site), Quiet sanctuary (no traffic)'
  );
  const [searchPrefill, setSearchPrefill] = useState<SearchPrefill | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    let active = true;
    hydratedRef.current = false;
    fetchWorkspace(apiBaseUrl, authUser.idToken, authUser.uid)
      .then((res) => {
        if (!active || !res) return;
        if (Array.isArray(res.favourites)) setFavourites(res.favourites);
        if (Array.isArray(res.compare_list)) setCompareList(res.compare_list);
        if (Array.isArray(res.hidden_ids)) setHiddenIds(res.hidden_ids);
        if (typeof res.preferences === 'string' && res.preferences.trim()) {
          setPersonalPreferences(res.preferences);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (active) hydratedRef.current = true;
      });
    return () => {
      active = false;
    };
  }, [apiBaseUrl, authUser.uid, authUser.idToken]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    const t = setTimeout(() => {
      saveWorkspace(
        apiBaseUrl,
        {
          favourites,
          compare_list: compareList,
          hidden_ids: hiddenIds,
          preferences: personalPreferences,
        },
        authUser.idToken,
        authUser.uid
      ).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [apiBaseUrl, authUser.uid, authUser.idToken, favourites, compareList, hiddenIds, personalPreferences]);

  const toggleCompare = (prop: MobileProperty) => {
    setCompareList((prev) => {
      if (prev.some((p) => p.id === prop.id)) {
        return prev.filter((p) => p.id !== prop.id);
      }
      if (prev.length >= 4) return prev;
      return [...prev, prop];
    });
  };

  const replaceCompare = (oldId: string, newProp: MobileProperty) => {
    setCompareList((prev) => {
      const cleaned = prev.filter((p) => p.id !== newProp.id || p.id === oldId);
      const idx = cleaned.findIndex((p) => p.id === oldId);
      if (idx >= 0) {
        return cleaned.map((p, i) => (i === idx ? newProp : p));
      }
      if (cleaned.length < 4) return [...cleaned, newProp];
      return cleaned;
    });
  };

  const removeCompare = (id: string) => {
    setCompareList((prev) => prev.filter((p) => p.id !== id));
  };

  const clearCompare = () => setCompareList([]);

  const toggleFavourite = (prop: MobileProperty) => {
    setFavourites((prev) =>
      prev.some((p) => p.id === prop.id) ? prev.filter((p) => p.id !== prop.id) : [prop, ...prev]
    );
  };

  const isFavourite = (id: string) => favourites.some((p) => p.id === id);

  const toggleHide = (id: string) => {
    setHiddenIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <HomeSeekContext.Provider
      value={{
        apiBaseUrl,
        setApiBaseUrl,
        authUser,
        setAuthUser,
        compareList,
        toggleCompare,
        replaceCompare,
        removeCompare,
        clearCompare,
        favourites,
        toggleFavourite,
        isFavourite,
        hiddenIds,
        toggleHide,
        personalPreferences,
        setPersonalPreferences,
        searchPrefill,
        setSearchPrefill,
      }}
    >
      {children}
    </HomeSeekContext.Provider>
  );
};

export function useHomeSeek() {
  const ctx = useContext(HomeSeekContext);
  if (!ctx) throw new Error('useHomeSeek must be used within HomeSeekProvider');
  return ctx;
}
