'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  CheckCircle,
  Info,
  X,
  CircleNotch,
  CaretRight,
  Sliders,
} from '@phosphor-icons/react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/lib/auth-context';
import { Navbar } from '@/components/Navbar';
import { getPropertyBarNoiseExposure, getPropertyBusyRoadExposure, type PropertyMapItem, type PropertyMapProps, type ProximityAnchor } from '@/components/PropertyMap';
import { resolveLocationCoords, getDistanceKm, searchSuburbs, searchPlacesAndAttractions, type PlaceSuggestion, isLandlordOnSiteProperty, getDwellingPrivacyInfo, getAgencyReputationInfo, setEmpiricalMarketMedians } from '@/lib/geo';
import {
  toggleCompareProperty,
} from '@/lib/pro-plan';

import {
  PRESET_TRAILHEADS_AND_HUBS,
  DEFAULT_SAVED_SEARCHES,
  INITIAL_SHOWCASE_PROPERTIES,
  type CommuteAnchor,
  type SavedSearch,
} from '@/constants/locations';
import { CommentsModal } from '@/components/search/CommentsModal';
import { FavouritesImportModal } from '@/components/search/FavouritesImportModal';
import type { GhostListingItem } from '@/constants/capeTownGeo';
import { TopTenRankerModal, type WalkableTarget } from '@/components/search/TopTenRankerModal';
import { Mapbox3DModal, type Mapbox3DTarget } from '@/components/search/Mapbox3DModal';
import { AiPropertyReportModal } from '@/components/search/AiPropertyReportModal';
import { SearchCriteriaBar } from '@/components/search/SearchCriteriaBar';
import { SearchResultsList } from '@/components/search/SearchResultsList';
import { useListingComments } from '@/hooks/useListingComments';
import { useAiPropertyReport } from '@/hooks/useAiPropertyReport';
import { useP24Favourites } from '@/hooks/useP24Favourites';
import {
  getRectifiedUrl,
  resolveProperty24Url,
  resolveGoogleMapsUrl,
  openProperty24Url,
  doesPropMatchSuburbs,
  mapLiveScrapeItem,
} from '@/lib/listingUrls';
import {
  generatePropertyAiAudit,
  isPropertyInHighRiskCrimeZone,
  getCrimePerimeterInfo,
  getRiskAdjustedValuation,
  isMainRoadProperty,
  type CrimePerimeterInfo,
} from '@/lib/forensicAudit';
export {
  isPropertyInHighRiskCrimeZone,
  getCrimePerimeterInfo,
  getRiskAdjustedValuation,
  isMainRoadProperty,
  type CrimePerimeterInfo,
};
const PropertyMap = dynamic<PropertyMapProps>(
  () => import('@/components/PropertyMap'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-zinc-100 flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-zinc-400">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-semibold">Loading Map Engine...</span>
        </div>
      </div>
    ),
  }
);

export default function SearchMapPage() {
  const { user, profile, logout } = useAuth();

  // Search Criteria State (Default to Cape Town Southern Suburbs Trailside, not George)
  const [selectedSuburbs, setSelectedSuburbs] = useState<string[]>(['Rondebosch', 'Newlands', 'Tokai']);
  const [suburbInput, setSuburbInput] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [autoIndex, setAutoIndex] = useState(0);

  const autocompleteSuggestions = useMemo(() => {
    return searchSuburbs(suburbInput, selectedSuburbs);
  }, [suburbInput, selectedSuburbs]);
  const [minPrice, setMinPrice] = useState('11000');
  const [maxPrice, setMaxPrice] = useState('18000');
  const [isBudgetMenuOpen, setIsBudgetMenuOpen] = useState(false);
  const [minSqm, setMinSqm] = useState<number>(0);
  const [isSizeMenuOpen, setIsSizeMenuOpen] = useState(false);
  const budgetMenuRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);
  const savedSearchMenuRef = useRef<HTMLDivElement>(null);
  const anchorMenuRef = useRef<HTMLDivElement>(null);
  const [bedrooms, setBedrooms] = useState('0.5+');

  // Clickable Feature Filters (Deterministic toggles for listings & map markers visibility)
  const [safeishFilter, setSafeishFilter] = useState<boolean>(true); // Safe-ish: ON by default (hides listings inside High-Risk crime radii)
  const [offMainRoadFilter, setOffMainRoadFilter] = useState<boolean>(true); // Off-Main Rd: ON by default (excludes noisy arterial road properties)
  const [offBarsFilter, setOffBarsFilter] = useState<boolean>(false); // Off-Bars/Clubs: excludes properties within close bar/nightlife radius
  const [withinRadiusFilter, setWithinRadiusFilter] = useState<boolean>(false); // Within Radius: OFF by default (properties outside radius stay visible, ranked lower)
  const [locationRadiusKm, setLocationRadiusKm] = useState<number>(5.0); // Selected location buffer radius in km
  const [fibreFilter, setFibreFilter] = useState<boolean>(false);
  const [parkingFilter, setParkingFilter] = useState<boolean>(false);
  const [petFriendlyFilter, setPetFriendlyFilter] = useState<boolean>(false);
  const [privateOnlyFilter, setPrivateOnlyFilter] = useState<boolean>(false);
  const [belowMarketFilter, setBelowMarketFilter] = useState<boolean>(false);

  // Hidden / Dismissed Listings State & Visibility Toggle
  const [hiddenPropertyIds, setHiddenPropertyIds] = useState<string[]>([]);
  const [showHidden, setShowHidden] = useState<boolean>(false);

  // Manual Address Submission State (for listings with withheld/unknown addresses)
  const [editingAddressPropId, setEditingAddressPropId] = useState<string | null>(null);
  const [manualAddressInput, setManualAddressInput] = useState('');
  const [isSubmittingAddress, setIsSubmittingAddress] = useState(false);
  const [manualAddressError, setManualAddressError] = useState<string | null>(null);

  const handleSubmitManualAddress = async (prop: PropertyMapItem) => {
    const clean = manualAddressInput.trim();
    if (clean.length < 4) {
      setManualAddressError('Enter a street name/number (e.g. 14 Derwent Rd).');
      return;
    }
    setIsSubmittingAddress(true);
    setManualAddressError(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/listings/submit-address`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing_id: prop.id,
          address: clean,
          suburb: (prop as any).suburb || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setManualAddressError(data?.detail || 'Could not save address.');
        return;
      }
      setProperties((prev) =>
        prev.map((p) =>
          p.id === prop.id
            ? {
              ...p,
              address: data.address || clean,
              is_address_withheld: false,
              lat: typeof data.lat === 'number' ? data.lat : p.lat,
              lng: typeof data.lng === 'number' ? data.lng : p.lng,
              ...(data.noise_risk ? { noise_risk: data.noise_risk } : {}),
              ...(typeof data.is_main_road === 'boolean' ? { is_main_road: data.is_main_road } : {}),
              ...(data.acoustic_audit ? { acoustic_audit: data.acoustic_audit } : {}),
            }
            : p
        )
      );
      setEditingAddressPropId(null);
      setManualAddressInput('');
      if (typeof data.lat === 'number' && typeof data.lng === 'number') {
        setFocusTarget({ lat: data.lat, lng: data.lng, zoom: 16.8, timestamp: Date.now() });
      }
    } catch (err) {
      setManualAddressError('Network error saving address.');
    } finally {
      setIsSubmittingAddress(false);
    }
  };

  const {
    commentCounts,
    recentComments,
    commentModalProp,
    setCommentModalProp,
    listingComments,
    isLoadingComments,
    newCommentText,
    setNewCommentText,
    isPostingComment,
    editingCommentId,
    setEditingCommentId,
    editingCommentText,
    setEditingCommentText,
    commentError,
    activeCommentUid,
    activeCommentNickname,
    openCommentsModal,
    handleCreateComment,
    handleUpdateComment,
    handleDeleteComment,
  } = useListingComments({
    userUid: user?.uid,
    profileNickname: profile?.nickname,
  });

  const toggleHideProperty = (id: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setHiddenPropertyIds((prev) => {
      const isHidden = prev.includes(id);
      const updated = isHidden ? prev.filter((pId) => pId !== id) : [...prev, id];
      try {
        localStorage.setItem('homeseek_hidden_properties', JSON.stringify(updated));
      } catch { }
      return updated;
    });
  };

  const unhideAllProperties = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setHiddenPropertyIds([]);
    try {
      localStorage.removeItem('homeseek_hidden_properties');
    } catch { }
  };

  // Area Templates State (Groups of Suburbs)
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>(DEFAULT_SAVED_SEARCHES);
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<string>('preset-cape-trailside');
  const [isSavedSearchMenuOpen, setIsSavedSearchMenuOpen] = useState(false);
  const [areaMenuFilter, setAreaMenuFilter] = useState('');
  const [newSearchName, setNewSearchName] = useState('');
  const [isSavingSearch, setIsSavingSearch] = useState(false);

  // Fit & AI Analysis State
  const [enableFitScore, setEnableFitScore] = useState<boolean>(true);
  const [isAiModalOpen, setIsAiModalOpen] = useState<boolean>(false);
  const [personalPreferences, setPersonalPreferences] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('homeseek_personal_preferences');
        if (saved !== null) return saved;
      } catch { }
    }
    return '';
  });
  const [deepAiRunCount, setDeepAiRunCount] = useState<number>(0);
  // Card Photo Gallery & RealView™ Rectifier States
  const [cardImageIndices, setCardImageIndices] = useState<Record<string, number>>({});
  const [cardGalleries, setCardGalleries] = useState<Record<string, string[]>>({});

  const fetchCardGallery = async (propId: string, url: string): Promise<{ photos: string[]; features: any } | null> => {
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${backendBase}/api/listing-photos?url=${encodeURIComponent(url)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success' && Array.isArray(data.photos) && data.photos.length > 0) {
          setCardGalleries((prev) => ({ ...prev, [propId]: data.photos }));
        }
        if (data.status === 'success' && data.features) {
          const f = data.features;
          setProperties((prev) =>
            prev.map((p) =>
              p.id === propId
                ? {
                  ...p,
                  description: f.description || p.description,
                  has_garage: Boolean(p.has_garage || f.has_garage),
                  has_secure_bay: Boolean(p.has_secure_bay || f.has_secure_bay),
                  parking_type: f.has_garage || p.has_garage ? 'garage' : f.has_secure_bay || p.has_secure_bay ? 'secure_bay' : p.parking_type,
                  stove_type: f.stove_type || p.stove_type,
                  has_inverter: Boolean(p.has_inverter || f.has_inverter),
                  pet_friendly: f.pet_friendly !== null && f.pet_friendly !== undefined ? Boolean(p.pet_friendly || f.pet_friendly) : p.pet_friendly,
                  dwelling_privacy: !p.vision_verified && f.dwelling_privacy && f.dwelling_privacy !== 'independent' ? f.dwelling_privacy : p.dwelling_privacy,
                  is_landlord_on_site: !p.vision_verified && typeof f.is_landlord_on_site === 'boolean' ? Boolean(p.is_landlord_on_site || f.is_landlord_on_site) : p.is_landlord_on_site,
                  agency_name: f.agency_name || p.agency_name,
                  agency_rating: f.agency_rating ?? p.agency_rating,
                  agency_review_count: f.agency_review_count ?? p.agency_review_count,
                  agency_risk_level: f.agency_risk_level || p.agency_risk_level,
                  agency_flags: Array.isArray(f.agency_flags) && f.agency_flags.length > 0 ? f.agency_flags : p.agency_flags,
                  agency_complaint_sample: f.agency_complaint_sample || p.agency_complaint_sample,
                  agency_hellopeter_rating: f.agency_hellopeter_rating ?? p.agency_hellopeter_rating,
                }
                : p
            )
          );
        }
        return { photos: Array.isArray(data.photos) ? data.photos : [], features: data.features || {} };
      }
    } catch (err) {
      console.warn("Could not fetch gallery for", propId, err);
    }
    return null;
  };

  // Deep AI Analysis Execution State
  const [isRunningDeepAi, setIsRunningDeepAi] = useState<boolean>(false);
  const [hasLoadedPersistedState, setHasLoadedPersistedState] = useState<boolean>(false);

  // Load saved area templates and last active search state from localStorage
  useEffect(() => {
    try {
      const storedAreas = localStorage.getItem('homeseek_area_templates');
      if (storedAreas) {
        const parsed = JSON.parse(storedAreas);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const merged = parsed.map((item: SavedSearch) => {
            const def = DEFAULT_SAVED_SEARCHES.find(d => d.id === item.id);
            if (def) {
              return {
                ...item,
                ...def,
              };
            }
            return item;
          });
          DEFAULT_SAVED_SEARCHES.forEach((def) => {
            if (!merged.some((m: SavedSearch) => m.id === def.id)) {
              merged.push(def);
            }
          });
          setSavedSearches(merged);
        }
      }

      const storedStateRaw = localStorage.getItem('homeseek_last_search_state');
      if (storedStateRaw) {
        const saved = JSON.parse(storedStateRaw);
        if (saved && typeof saved === 'object') {
          if (typeof saved.activeSavedSearchId === 'string') setActiveSavedSearchId(saved.activeSavedSearchId);
          if (Array.isArray(saved.selectedSuburbs) && saved.selectedSuburbs.length > 0) setSelectedSuburbs(saved.selectedSuburbs);
          if (typeof saved.minPrice === 'string') setMinPrice(saved.minPrice);
          if (typeof saved.maxPrice === 'string') setMaxPrice(saved.maxPrice);
          if (typeof saved.minSqm === 'number') setMinSqm(saved.minSqm);
          if (typeof saved.bedrooms === 'string') setBedrooms(saved.bedrooms);
          if (typeof saved.activeAnchorId === 'string') setActiveAnchorId(saved.activeAnchorId);
          if (typeof saved.safeishFilter === 'boolean') setSafeishFilter(saved.safeishFilter);
          if (typeof saved.offMainRoadFilter === 'boolean') setOffMainRoadFilter(saved.offMainRoadFilter);
          if (typeof saved.offBarsFilter === 'boolean') setOffBarsFilter(saved.offBarsFilter);
          if (typeof saved.withinRadiusFilter === 'boolean') setWithinRadiusFilter(saved.withinRadiusFilter);
          if (typeof saved.locationRadiusKm === 'number') setLocationRadiusKm(saved.locationRadiusKm);
          if (typeof saved.fibreFilter === 'boolean') setFibreFilter(saved.fibreFilter);
          if (typeof saved.parkingFilter === 'boolean') setParkingFilter(saved.parkingFilter);
          if (typeof saved.petFriendlyFilter === 'boolean') setPetFriendlyFilter(saved.petFriendlyFilter);
          if (typeof saved.privateOnlyFilter === 'boolean') setPrivateOnlyFilter(saved.privateOnlyFilter);
          if (typeof saved.belowMarketFilter === 'boolean') setBelowMarketFilter(saved.belowMarketFilter);
          if (typeof saved.sortBy === 'string') setSortBy(saved.sortBy);
          if (typeof saved.isListCollapsed === 'boolean') setIsListCollapsed(saved.isListCollapsed);
        }
      }

      const storedHidden = localStorage.getItem('homeseek_hidden_properties');
      if (storedHidden) {
        const parsed = JSON.parse(storedHidden);
        if (Array.isArray(parsed)) {
          setHiddenPropertyIds(parsed);
        }
      }

      // Override with URL query params when arriving from Alerts ("View") or Profile Favourites
      if (typeof window !== 'undefined' && window.location.search) {
        const qp = new URLSearchParams(window.location.search);
        const qSuburbs = qp.get('suburbs');
        if (qSuburbs) {
          const list = qSuburbs
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          if (list.length > 0) {
            setSelectedSuburbs(list);
            const coords = resolveLocationCoords(list[0]);
            if (coords) {
              setFocusTarget({ lat: coords.lat, lng: coords.lng, zoom: 13.5, timestamp: Date.now() });
            }
          }
        }
        const qMinP = qp.get('minPrice');
        if (qMinP !== null) setMinPrice(qMinP);
        const qMaxP = qp.get('maxPrice');
        if (qMaxP !== null) setMaxPrice(qMaxP);
        const qBeds = qp.get('beds');
        if (qBeds) setBedrooms(qBeds);
        const qSqm = qp.get('minSqm');
        if (qSqm) setMinSqm(parseInt(qSqm, 10) || 0);
        if (qp.has('safeish')) setSafeishFilter(qp.get('safeish') === '1');
        if (qp.has('offMain')) setOffMainRoadFilter(qp.get('offMain') === '1');
        if (qp.has('offBars')) setOffBarsFilter(qp.get('offBars') === '1');
        if (qp.has('fibre')) setFibreFilter(qp.get('fibre') === '1');
        if (qp.has('parking')) setParkingFilter(qp.get('parking') === '1');
        if (qp.has('pet')) setPetFriendlyFilter(qp.get('pet') === '1');
        if (qp.has('private')) setPrivateOnlyFilter(qp.get('private') === '1');
        const qPropId = qp.get('propertyId');
        if (qPropId) setSelectedPropertyId(qPropId);
      }
    } catch (e) { }
    setHasLoadedPersistedState(true);
  }, []);

  const applySavedSearch = (preset: SavedSearch) => {
    setSelectedPropertyId(null);
    setSelectedSuburbs(preset.suburbs);
    if (preset.anchorId) setActiveAnchorId(preset.anchorId);
    setActiveSavedSearchId(preset.id);
    setIsSavedSearchMenuOpen(false);

    // Pan map to the primary suburb or anchor of the selected preset
    if (preset.suburbs && preset.suburbs.length > 0) {
      const coords = resolveLocationCoords(preset.suburbs[0]);
      if (coords && coords.lat && coords.lng) {
        setFocusTarget({ lat: coords.lat, lng: coords.lng, zoom: 13.5, timestamp: Date.now() });
      }
    }
  };

  const [backendSyncError, setBackendSyncError] = useState<string | null>(null);
  const [isInitialSyncing, setIsInitialSyncing] = useState<boolean>(false);
  const [syncRetryTick, setSyncRetryTick] = useState<number>(0);
  const [ghostRetryTick, setGhostRetryTick] = useState<number>(0);

  // Auto-load live/cached listings from backend whenever selectedSuburbs changes (with startup retry)
  useEffect(() => {
    if (!hasLoadedPersistedState || selectedSuburbs.length === 0) return;
    let isCancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const syncSuburbListings = async (attempt = 0) => {
      if (attempt === 0) setIsInitialSyncing(true);
      try {
        const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const res = await fetch(`${backendBase}/api/search/live-scrape`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            suburbs: selectedSuburbs,
            min_price: parseInt(minPrice) || 0,
            max_price: parseInt(maxPrice) || 999999,
            bedrooms: bedrooms,
            anchor_lat: activeAnchor ? activeAnchor.lat : null,
            anchor_lng: activeAnchor ? activeAnchor.lng : null,
          }),
        });
        if (isCancelled) return;
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        if (isCancelled) return;
        setBackendSyncError(null);
        if (data.rate_guard?.circuit_open) {
          const secs = data.rate_guard.cooldown_remaining_seconds || 180;
          const mins = Math.max(1, Math.ceil(secs / 60));
          setRateGuardUntil(Date.now() + secs * 1000);
          setScrapeStatusText(
            data.listings?.length > 0
              ? `🛡️ P24 Rate-Limit Shield Active (${mins}m cooldown). Serving ${data.listings.length} cached listings.`
              : `🛡️ P24 Rate-Limit Shield Active (${mins}m cooldown). Pausing outbound scrapes to protect your IP.`
          );
        } else if (data.rate_guard && !data.rate_guard.circuit_open) {
          setRateGuardUntil(0);
        }
        if (data.batch_meta) {
          const meta = data.batch_meta;
          const staleSubs: string[] = Array.isArray(meta.stale_suburbs) ? meta.stale_suburbs : [];
          const ageSecs = typeof meta.oldest_age_seconds === 'number' ? meta.oldest_age_seconds : 0;
          if (meta.is_stale || staleSubs.length > 0 || ageSecs >= 86400) {
            setStaleDataInfo({
              isStale: true,
              oldestAgeSeconds: ageSecs,
              staleSuburbs: staleSubs,
            });
          } else {
            setStaleDataInfo(null);
          }
        }
        if (Array.isArray(data.listings) && data.listings.length > 0) {
          const mapped: PropertyMapItem[] = data.listings.map(mapLiveScrapeItem);
          setProperties((prev) => {
            const incomingIds = new Set(mapped.map((m) => m.id));
            const outsideQueried = prev.filter(
              (p) => !incomingIds.has(p.id) && !doesPropMatchSuburbs(p, selectedSuburbs)
            );
            return [...mapped, ...outsideQueried];
          });
        }
        if (!isCancelled) setIsInitialSyncing(false);
      } catch {
        if (isCancelled) return;
        if (attempt < 2) {
          retryTimer = setTimeout(() => {
            if (!isCancelled) syncSuburbListings(attempt + 1);
          }, attempt === 0 ? 2500 : 5000);
        } else {
          setIsInitialSyncing(false);
          setBackendSyncError('Listings server is offline or still starting up.');
        }
      }
    };
    syncSuburbListings(0);
    return () => {
      isCancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [hasLoadedPersistedState, selectedSuburbs.join('|'), minPrice, maxPrice, bedrooms, syncRetryTick]);

  // Independent Ghost Layer fetch — ALWAYS runs regardless of active/stale/empty listings state
  useEffect(() => {
    if (!hasLoadedPersistedState || selectedSuburbs.length === 0) return;
    let isCancelled = false;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const syncGhostListings = async (attempt = 0) => {
      try {
        const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
        const gParams = new URLSearchParams({
          suburbs: selectedSuburbs.join(','),
          min_price: String(parseInt(minPrice) || 0),
          max_price: String(parseInt(maxPrice) || 999999),
          bedrooms: String(bedrooms || 'any'),
        });
        const gRes = await fetch(`${backendBase}/api/listings/ghost?${gParams.toString()}`);
        if (isCancelled) return;
        if (!gRes.ok) throw new Error(`HTTP ${gRes.status}`);
        const gData = await gRes.json();
        if (isCancelled) return;
        let fetchedGhosts: GhostListingItem[] = Array.isArray(gData.listings) ? gData.listings : [];
        // If strict budget/bed filter returned 0 ghosts, fall back to all historical ghosts in selected suburbs
        if (fetchedGhosts.length === 0) {
          const fallbackParams = new URLSearchParams({ suburbs: selectedSuburbs.join(',') });
          const fbRes = await fetch(`${backendBase}/api/listings/ghost?${fallbackParams.toString()}`);
          if (fbRes.ok && !isCancelled) {
            const fbData = await fbRes.json();
            if (Array.isArray(fbData.listings)) {
              fetchedGhosts = fbData.listings;
            }
          }
        }
        if (!isCancelled) {
          setGhostListings(fetchedGhosts);
        }
      } catch {
        if (!isCancelled && attempt < 2) {
          retryTimer = setTimeout(() => {
            if (!isCancelled) syncGhostListings(attempt + 1);
          }, attempt === 0 ? 2500 : 5000);
        }
      }
    };
    syncGhostListings(0);
    return () => {
      isCancelled = true;
      if (retryTimer) clearTimeout(retryTimer);
    };
  }, [hasLoadedPersistedState, selectedSuburbs.join('|'), minPrice, maxPrice, bedrooms, ghostRetryTick]);

  const handleSaveCurrentSearch = () => {
    if (!newSearchName.trim()) return;
    const newPreset: SavedSearch = {
      id: `custom-${Date.now()}`,
      name: `📍 ${newSearchName.trim()}`,
      suburbs: [...selectedSuburbs],
      minPrice,
      maxPrice,
      bedrooms,
      anchorId: activeAnchorId,
      isCustom: true,
    };
    const updated = [newPreset, ...savedSearches];
    setSavedSearches(updated);
    setActiveSavedSearchId(newPreset.id);
    setNewSearchName('');
    setIsSavingSearch(false);
    try {
      localStorage.setItem('homeseek_area_templates', JSON.stringify(updated));
    } catch (e) { }
  };

  const handleDeleteSavedSearch = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedSearches.filter(s => s.id !== id);
    setSavedSearches(updated);
    if (activeSavedSearchId === id && updated.length > 0) {
      applySavedSearch(updated[0]);
    }
    try {
      localStorage.setItem('homeseek_area_templates', JSON.stringify(updated));
    } catch (e) { }
  };

  // Trigger Top 10 Data-Driven Ranker ($0) across matching properties with active filters, walkable targets & preferences
  const handleRunDeepAiAnalysis = () => {
    setIsRunningDeepAi(true);
    setEnableFitScore(true);
    setSortBy('fit');
    setScrapeStatusText('Ranking Top 10 matches using walkable places, acoustics, privacy & market value...');
    setTimeout(() => {
      setIsRunningDeepAi(false);
      setDeepAiRunCount((c) => c + 1);
      setIsAiModalOpen(false);

      if (displayProperties.length > 0) {
        setSelectedPropertyId(displayProperties[0].id);
      }

      setScrapeStatusText('✨ Top 10 ranked locally ($0) using your criteria & walkable spots.');
      setTimeout(() => setScrapeStatusText(''), 4000);
    }, 300);
  };

  // Desirable Locations & Trailheads State
  const [anchors, setAnchors] = useState<CommuteAnchor[]>(PRESET_TRAILHEADS_AND_HUBS);
  const [activeAnchorId, setActiveAnchorId] = useState<string>('trail-newlands');
  const [isAnchorMenuOpen, setIsAnchorMenuOpen] = useState(false);
  const [newAnchorLabel, setNewAnchorLabel] = useState('');
  const [isAnchorInputFocused, setIsAnchorInputFocused] = useState(false);
  const [anchorAutoIndex, setAnchorAutoIndex] = useState(0);

  const anchorSuggestions = useMemo(() => {
    return searchPlacesAndAttractions(newAnchorLabel);
  }, [newAnchorLabel]);

  // Live Scraped Properties State
  const [properties, setProperties] = useState<PropertyMapItem[]>(INITIAL_SHOWCASE_PROPERTIES);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [hoveredPropertyId, setHoveredPropertyId] = useState<string | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; zoom?: number; timestamp: number } | null>(null);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatusText, setScrapeStatusText] = useState('');
  const [rateGuardUntil, setRateGuardUntil] = useState<number>(0);
  const [isRateGuardActive, setIsRateGuardActive] = useState(false);
  useEffect(() => {
    const remaining = rateGuardUntil - Date.now();
    if (remaining <= 0) {
      setIsRateGuardActive(false);
      return;
    }
    setIsRateGuardActive(true);
    const timer = setTimeout(() => setIsRateGuardActive(false), remaining);
    return () => clearTimeout(timer);
  }, [rateGuardUntil]);
  const [staleDataInfo, setStaleDataInfo] = useState<{
    isStale: boolean;
    oldestAgeSeconds: number;
    staleSuburbs: string[];
  } | null>(null);
  const [ghostListings, setGhostListings] = useState<GhostListingItem[]>([]);
  const [preview3DTarget, setPreview3DTarget] = useState<Mapbox3DTarget | null>(null);
  const [walkablePlaces, setWalkablePlaces] = useState<WalkableTarget[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('homeseek_walkable_places');
        return saved ? JSON.parse(saved) : [];
      } catch {
        return [];
      }
    }
    return [];
  });
  const handleAddWalkablePlace = (place: WalkableTarget) => {
    setWalkablePlaces((prev) => {
      if (prev.some((p) => p.id === place.id || p.label.toLowerCase() === place.label.toLowerCase())) {
        return prev;
      }
      const next = [...prev, place];
      try {
        localStorage.setItem('homeseek_walkable_places', JSON.stringify(next));
      } catch { }
      return next;
    });
  };
  const handleRemoveWalkablePlace = (id: string) => {
    setWalkablePlaces((prev) => {
      const next = prev.filter((p) => p.id !== id);
      try {
        localStorage.setItem('homeseek_walkable_places', JSON.stringify(next));
      } catch { }
      return next;
    });
  };
  const [isListCollapsed, setIsListCollapsed] = useState(false);
  const [feedViewMode, setFeedViewMode] = useState<'cards' | 'list'>('cards');
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'distance' | 'fit'>('fit');
  const [empiricalMediansLoaded, setEmpiricalMediansLoaded] = useState(0);

  useEffect(() => {
    const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    fetch(`${backendBase}/api/market-medians`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.status === 'success' && d.medians) {
          setEmpiricalMarketMedians(d.medians);
          setEmpiricalMediansLoaded((n) => n + 1);
        }
      })
      .catch(() => { });
  }, []);

  // Persist active search criteria and filters to localStorage whenever they change
  useEffect(() => {
    if (!hasLoadedPersistedState) return;
    try {
      localStorage.setItem(
        'homeseek_last_search_state',
        JSON.stringify({
          activeSavedSearchId,
          selectedSuburbs,
          minPrice,
          maxPrice,
          minSqm,
          bedrooms,
          activeAnchorId,
          safeishFilter,
          offMainRoadFilter,
          offBarsFilter,
          withinRadiusFilter,
          locationRadiusKm,
          fibreFilter,
          parkingFilter,
          petFriendlyFilter,
          privateOnlyFilter,
          belowMarketFilter,
          sortBy,
          isListCollapsed,
        })
      );
    } catch (e) { }
  }, [
    hasLoadedPersistedState,
    activeSavedSearchId,
    selectedSuburbs,
    minPrice,
    maxPrice,
    minSqm,
    bedrooms,
    activeAnchorId,
    safeishFilter,
    offMainRoadFilter,
    offBarsFilter,
    withinRadiusFilter,
    locationRadiusKm,
    fibreFilter,
    parkingFilter,
    petFriendlyFilter,
    privateOnlyFilter,
    belowMarketFilter,
    sortBy,
    isListCollapsed,
  ]);

  const activeAnchor = useMemo(() => {
    return anchors.find(a => a.id === activeAnchorId) || anchors[0] || null;
  }, [anchors, activeAnchorId]);

  const {
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
  } = useP24Favourites({
    anchorLat: activeAnchor?.lat,
    anchorLng: activeAnchor?.lng,
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (budgetMenuRef.current && !budgetMenuRef.current.contains(target)) {
        setIsBudgetMenuOpen(false);
      }
      if (sizeMenuRef.current && !sizeMenuRef.current.contains(target)) {
        setIsSizeMenuOpen(false);
      }
      if (savedSearchMenuRef.current && !savedSearchMenuRef.current.contains(target)) {
        setIsSavedSearchMenuOpen(false);
      }
      if (anchorMenuRef.current && !anchorMenuRef.current.contains(target)) {
        setIsAnchorMenuOpen(false);
      }
    };
    if (isBudgetMenuOpen || isSizeMenuOpen || isSavedSearchMenuOpen || isAnchorMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isBudgetMenuOpen, isSizeMenuOpen, isSavedSearchMenuOpen, isAnchorMenuOpen]);

  const activeTemplate = useMemo(() => {
    return savedSearches.find((s) => s.id === activeSavedSearchId) || savedSearches[0];
  }, [savedSearches, activeSavedSearchId]);

  const isPoiNearActiveArea = useMemo(() => {
    const refAnchor =
      anchors.find((a) => a.id === activeAnchorId) ||
      anchors.find((a) => a.id === activeTemplate?.anchorId);
    return (a: (typeof anchors)[number]) => {
      if (activeTemplate?.id && a.templateId === activeTemplate.id) return true;
      if (!refAnchor) return false;
      const toRad = (deg: number) => (deg * Math.PI) / 180;
      const dLat = toRad(a.lat - refAnchor.lat);
      const dLng = toRad(a.lng - refAnchor.lng);
      const sinDLat = Math.sin(dLat / 2);
      const sinDLng = Math.sin(dLng / 2);
      const h =
        sinDLat * sinDLat +
        Math.cos(toRad(refAnchor.lat)) * Math.cos(toRad(a.lat)) * sinDLng * sinDLng;
      const distKm = 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
      return distKm <= 15;
    };
  }, [anchors, activeAnchorId, activeTemplate]);

  // Main location attractions associated with the active Suburb Group template
  const templateAttractions = useMemo(() => {
    if (!activeTemplate?.attractionIds || activeTemplate.attractionIds.length === 0) {
      return anchors.filter(
        (a) =>
          a.category !== 'gym' &&
          a.iconType !== 'gym' &&
          a.category !== 'cafe' &&
          a.iconType !== 'cafe' &&
          a.category !== 'shop' &&
          a.iconType !== 'shop' &&
          isPoiNearActiveArea(a)
      );
    }
    return anchors.filter((a) => activeTemplate.attractionIds?.includes(a.id));
  }, [anchors, activeTemplate, isPoiNearActiveArea]);

  // Gyms associated with the active Suburb Group template
  const templateGyms = useMemo(() => {
    if (!activeTemplate?.gymIds || activeTemplate.gymIds.length === 0) {
      return anchors.filter((a) => (a.category === 'gym' || a.iconType === 'gym') && isPoiNearActiveArea(a));
    }
    return anchors.filter((a) => activeTemplate.gymIds?.includes(a.id));
  }, [anchors, activeTemplate, isPoiNearActiveArea]);

  // Cafes & Bakeries associated with the active Suburb Group template
  const templateCafes = useMemo(() => {
    if (!activeTemplate?.cafeIds || activeTemplate.cafeIds.length === 0) {
      return anchors.filter((a) => (a.category === 'cafe' || a.iconType === 'cafe') && isPoiNearActiveArea(a));
    }
    return anchors.filter((a) => activeTemplate.cafeIds?.includes(a.id));
  }, [anchors, activeTemplate, isPoiNearActiveArea]);

  // Shops & Retail Centres associated with the active Suburb Group template
  const templateShops = useMemo(() => {
    if (!activeTemplate?.shopIds || activeTemplate.shopIds.length === 0) {
      return anchors.filter((a) => (a.category === 'shop' || a.iconType === 'shop') && isPoiNearActiveArea(a));
    }
    return anchors.filter((a) => activeTemplate.shopIds?.includes(a.id));
  }, [anchors, activeTemplate, isPoiNearActiveArea]);

  // Other regional anchors (outside current template) + custom user anchors
  const otherAnchors = useMemo(() => {
    const currentTemplateAnchorIds = new Set([
      ...(activeTemplate?.attractionIds || []),
      ...(activeTemplate?.gymIds || []),
      ...(activeTemplate?.cafeIds || []),
      ...(activeTemplate?.shopIds || [])
    ]);
    return anchors.filter((a) => !currentTemplateAnchorIds.has(a.id));
  }, [anchors, activeTemplate]);

  // Filtered anchors passed to the Map Canvas (current template attractions + gyms + cafes + shops + custom pins + active anchor)
  const displayedAnchors = useMemo(() => {
    const customAnchors = anchors.filter((a) => a.id.startsWith('custom-'));
    const idSet = new Set([
      ...(activeTemplate?.attractionIds || []),
      ...(activeTemplate?.gymIds || []),
      ...(activeTemplate?.cafeIds || []),
      ...(activeTemplate?.shopIds || []),
      activeAnchorId
    ]);
    const matched = anchors.filter(
      (a) => idSet.has(a.id) || a.iconType === 'trail' || (activeTemplate?.id && a.templateId === activeTemplate.id)
    );
    return matched.length > 0 ? [...matched, ...customAnchors] : anchors;
  }, [anchors, activeTemplate, activeAnchorId]);

  const handleFocusSuburb = (suburb: string) => {
    const coords = resolveLocationCoords(suburb);
    setFocusTarget({ lat: coords.lat, lng: coords.lng, zoom: 14.2, timestamp: Date.now() });
  };

  // Suburb management
  const handleAddSuburb = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!selectedSuburbs.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setSelectedSuburbs([...selectedSuburbs, trimmed]);
    }
    setSuburbInput('');
    setIsInputFocused(false);
    setAutoIndex(0);
  };

  const handleRemoveSuburb = (name: string) => {
    setSelectedSuburbs(selectedSuburbs.filter(s => s.toLowerCase() !== name.toLowerCase()));
  };

  // Select location from suggestions and add to map
  const handleSelectSuggestedPlace = (place: PlaceSuggestion) => {
    const newAnchor: CommuteAnchor = {
      id: `place-${Date.now()}-${place.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
      label: place.name,
      target_place: `${place.name}, ${place.category}`,
      lat: place.lat,
      lng: place.lng,
      max_commute_mins: 20,
      max_distance_km: 15,
      commute_mode: 'driving',
      iconType: place.iconType,
      category: place.iconType === 'gym' ? 'gym' : place.iconType === 'trail' ? 'trail' : place.iconType === 'cafe' ? 'cafe' : place.iconType === 'shop' ? 'shop' : 'attraction',
    };

    setAnchors((prev) => [newAnchor, ...prev.filter((a) => a.label.toLowerCase() !== place.name.toLowerCase())]);
    setActiveAnchorId(newAnchor.id);
    setFocusTarget({ lat: place.lat, lng: place.lng, zoom: 14.5, timestamp: Date.now() });
    setNewAnchorLabel('');
    setIsAnchorInputFocused(false);
    setIsAnchorMenuOpen(false);
  };

  // Add custom desirable location
  const handleAddCustomAnchor = () => {
    const query = newAnchorLabel.trim();
    if (!query) return;

    // If an auto-suggestion is currently highlighted, use it
    if (anchorSuggestions.length > 0 && anchorSuggestions[anchorAutoIndex]) {
      handleSelectSuggestedPlace(anchorSuggestions[anchorAutoIndex]);
      return;
    }

    const resolved = resolveLocationCoords(query);
    const newAnchor: CommuteAnchor = {
      id: `custom-${Date.now()}`,
      label: resolved.label || query,
      target_place: query,
      lat: resolved ? resolved.lat : -33.9500,
      lng: resolved ? resolved.lng : 18.4400,
      max_commute_mins: 20,
      max_distance_km: 15,
      commute_mode: 'driving',
      iconType: 'general'
    };
    setAnchors((prev) => [newAnchor, ...prev.filter((a) => a.label.toLowerCase() !== newAnchor.label.toLowerCase())]);
    setActiveAnchorId(newAnchor.id);
    setFocusTarget({ lat: newAnchor.lat, lng: newAnchor.lng, zoom: 14.5, timestamp: Date.now() });
    setNewAnchorLabel('');
    setIsAnchorInputFocused(false);
    setIsAnchorMenuOpen(false);
  };

  // Scrape Property24 Live Action
  const handleScrapeP24 = async () => {
    if (selectedSuburbs.length === 0) {
      setScrapeStatusText('Please select or add at least one suburb (e.g. Gardens, Rondebosch) to scrape.');
      setTimeout(() => setScrapeStatusText(''), 4500);
      return;
    }

    setIsScraping(true);
    const startTs = Date.now();
    const areaLabel = selectedSuburbs.join(', ');
    setScrapeStatusText(`Connecting to Property24 stealth browser for ${areaLabel}... (0s · please don't refresh)`);

    let progressTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
      const secs = Math.floor((Date.now() - startTs) / 1000);
      if (secs <= 3) {
        setScrapeStatusText(`Connecting to Property24 stealth browser for ${areaLabel}... (${secs}s · please don't refresh)`);
      } else if (secs <= 9) {
        setScrapeStatusText(`Scraping ${areaLabel} with polite anti-block pacing (3.5s–5s)... (${secs}s)`);
      } else if (secs <= 18) {
        setScrapeStatusText(`Extracting listings, specs & geocoding ${areaLabel}... (${secs}s · hang tight)`);
      } else {
        setScrapeStatusText(`Finalizing listings & syncing cache for ${areaLabel} — almost done (${secs}s · please don't refresh)`);
      }
    }, 1000);

    const stopProgressTimer = () => {
      if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
      }
    };

    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const runScrapeBatch = async (batchSuburbs: string[]) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 120000);
        try {
          const res = await fetch(`${backendBase}/api/search/live-scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              suburbs: batchSuburbs,
              min_price: parseInt(minPrice) || 0,
              max_price: parseInt(maxPrice) || 999999,
              bedrooms: bedrooms,
              anchor_lat: activeAnchor ? activeAnchor.lat : null,
              anchor_lng: activeAnchor ? activeAnchor.lng : null,
              force_fresh: true,
            }),
          });
          if (!res.ok) return null;
          return await res.json();
        } finally {
          clearTimeout(timeoutId);
        }
      };

      const mergeBatchProperties = (
        batchMapped: PropertyMapItem[],
        suburbsToReplace: string[],
        prevSnapshot: PropertyMapItem[]
      ) => {
        const batchIds = new Set(batchMapped.map((m) => m.id));
        const batchP24Ids = new Set(
          batchMapped.map((m) => String((m as any).p24_id || m.id).replace('p24-', '')).filter(Boolean)
        );
        const removed =
          suburbsToReplace.length > 0
            ? prevSnapshot.filter(
              (p) =>
                !batchIds.has(p.id) &&
                !favouritePropertyIds.includes(p.id) &&
                doesPropMatchSuburbs(p, suburbsToReplace)
            ).length
            : 0;
        setProperties((prev) => {
          const prevById = new Map(prev.map((p) => [p.id, p]));
          const prevByP24 = new Map(
            prev.map((p) => [String((p as any).p24_id || p.id).replace('p24-', ''), p])
          );
          const mergedBatch = batchMapped.map((incoming) => {
            const pid = String((incoming as any).p24_id || incoming.id).replace('p24-', '');
            const existing = prevById.get(incoming.id) || (pid ? prevByP24.get(pid) : undefined);
            if (!existing) return incoming;
            const keepUserAddress = (existing as any).address_source === 'user_submitted';
            return {
              ...incoming,
              is_favorite: Boolean(existing.is_favorite || incoming.is_favorite || favouritePropertyIds.includes(incoming.id)),
              deep_ai_audit: existing.deep_ai_audit || incoming.deep_ai_audit,
              images:
                (existing.images?.length || 0) > (incoming.images?.length || 0)
                  ? existing.images
                  : incoming.images,
              ...(keepUserAddress
                ? {
                  address: existing.address,
                  lat: existing.lat,
                  lng: existing.lng,
                  is_address_withheld: false,
                  address_source: 'user_submitted',
                }
                : {}),
            };
          });
          const preserved = prev.filter((p) => {
            const pid = String((p as any).p24_id || p.id).replace('p24-', '');
            if (batchIds.has(p.id) || (pid && batchP24Ids.has(pid))) return false;
            // Always keep user-starred favourites intact even if not in this scrape page
            if (favouritePropertyIds.includes(p.id) || p.is_favorite) return true;
            if (suburbsToReplace.length > 0 && doesPropMatchSuburbs(p, suburbsToReplace)) {
              return false;
            }
            return true;
          });
          return [...mergedBatch, ...preserved];
        });
        return removed;
      };

      const data = await runScrapeBatch(selectedSuburbs);
      stopProgressTimer();

      if (data) {
        if (data.rate_guard?.circuit_open) {
          const secs = data.rate_guard?.cooldown_remaining_seconds || 180;
          setRateGuardUntil(Date.now() + secs * 1000);
        } else {
          setRateGuardUntil(0);
        }
        if (data.status === 'success' && Array.isArray(data.listings)) {
          const combinedMappedById = new Map<string, PropertyMapItem>();
          const batch1Mapped: PropertyMapItem[] = data.listings.map(mapLiveScrapeItem);
          batch1Mapped.forEach((m) => combinedMappedById.set(m.id, m));

          let circuitOpen = Boolean(data.rate_guard?.circuit_open);
          let cooldownSecs = data.rate_guard?.cooldown_remaining_seconds || 180;
          const allRefreshedSet = new Set<string>(
            Array.isArray(data.batch_meta?.refreshed_suburbs) ? data.batch_meta.refreshed_suburbs : []
          );
          let remainingStale: string[] = Array.isArray(data.batch_meta?.stale_suburbs)
            ? data.batch_meta.stale_suburbs
            : [];

          const prevIds = new Set(properties.map((p) => p.id));
          const initialReplace = circuitOpen
            ? []
            : allRefreshedSet.size > 0
              ? Array.from(allRefreshedSet)
              : remainingStale.length === 0
                ? selectedSuburbs
                : [];
          let removedStaleCount = mergeBatchProperties(batch1Mapped, initialReplace, properties);
          setStaleDataInfo(
            remainingStale.length > 0
              ? {
                isStale: true,
                oldestAgeSeconds: typeof data.batch_meta?.oldest_age_seconds === 'number' ? data.batch_meta.oldest_age_seconds : 86400,
                staleSuburbs: remainingStale,
              }
              : null
          );

          // Automatically continue through remaining stale suburbs (<= 3 per batch) after polite delay
          const triedRemaining = new Set<string>();
          let batchesRun = 1;
          while (!circuitOpen && remainingStale.length > 0 && batchesRun < 4) {
            const nextSlice = remainingStale
              .filter((s) => !triedRemaining.has(s.toLowerCase()))
              .slice(0, 3);
            if (nextSlice.length === 0) break;
            nextSlice.forEach((s) => triedRemaining.add(s.toLowerCase()));

            setScrapeStatusText(
              `⏳ Refreshed ${allRefreshedSet.size > 0 ? Array.from(allRefreshedSet).join(', ') : 'first batch'}. Continuing politely to ${nextSlice.join(', ')}...`
            );
            await new Promise((r) => setTimeout(r, 4000));

            const nextData = await runScrapeBatch(nextSlice);
            batchesRun++;
            if (!nextData || nextData.status !== 'success' || !Array.isArray(nextData.listings)) {
              break;
            }

            if (nextData.rate_guard?.circuit_open) {
              circuitOpen = true;
              cooldownSecs = nextData.rate_guard?.cooldown_remaining_seconds || 180;
              setRateGuardUntil(Date.now() + cooldownSecs * 1000);
            }

            const nextMapped: PropertyMapItem[] = nextData.listings.map(mapLiveScrapeItem);
            nextMapped.forEach((m) => combinedMappedById.set(m.id, m));

            const nextRefreshed: string[] = Array.isArray(nextData.batch_meta?.refreshed_suburbs)
              ? nextData.batch_meta.refreshed_suburbs
              : [];
            nextRefreshed.forEach((s) => allRefreshedSet.add(s));
            const nextStale: string[] = Array.isArray(nextData.batch_meta?.stale_suburbs)
              ? nextData.batch_meta.stale_suburbs
              : [];

            if (!circuitOpen) {
              const replaceTargets = nextRefreshed.length > 0 ? nextRefreshed : nextStale.length === 0 ? nextSlice : [];
              removedStaleCount += mergeBatchProperties(nextMapped, replaceTargets, properties);
            }

            const prevRemaining = remainingStale.filter((s) => !triedRemaining.has(s.toLowerCase()));
            remainingStale = Array.from(new Set([...nextStale, ...prevRemaining]));
          }

          const mapped = Array.from(combinedMappedById.values());
          const addedCount = mapped.filter((m) => !prevIds.has(m.id)).length;
          const refreshedSuburbs = Array.from(allRefreshedSet);
          const staleSuburbs = remainingStale;

          // Verify saved/imported favourites against live availability & refresh metadata
          let expiredFavsRemoved = 0;
          if (!circuitOpen && importedFavourites.length > 0) {
            try {
              const mappedByP24Id = new Map(
                mapped.map((m) => [String((m as any).p24_id || m.id).replace('p24-', ''), m])
              );
              const verifyRes = await fetch(`${backendBase}/api/p24/verify-favourites`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  items: importedFavourites.map((f) => ({
                    id: f.id,
                    p24_id: String((f as any).p24_id || f.id).replace('p24-', ''),
                    url: f.url || null,
                  })),
                  active_live_ids: Array.from(mappedByP24Id.keys()),
                  force_fresh: true,
                }),
              });

              const expiredSet = new Set<string>();
              if (verifyRes.ok) {
                const vData = await verifyRes.json();
                for (const eid of (vData.expired_ids || []) as string[]) {
                  expiredSet.add(String(eid).replace('p24-', ''));
                }
              }

              expiredFavsRemoved = importedFavourites.filter((fav) => {
                const pid = String((fav as any).p24_id || fav.id).replace('p24-', '');
                return expiredSet.has(fav.id) || expiredSet.has(pid);
              }).length;

              if (expiredSet.size > 0 || mappedByP24Id.size > 0) {
                setImportedFavourites((prevFavs) => {
                  const nextFavs: PropertyMapItem[] = [];
                  for (const fav of prevFavs) {
                    const pid = String((fav as any).p24_id || fav.id).replace('p24-', '');
                    if (expiredSet.has(fav.id) || expiredSet.has(pid)) {
                      continue;
                    }
                    const freshMatch = mappedByP24Id.get(pid);
                    // Preserve original favourite listing data (address, AI audit, images) when still available
                    nextFavs.push(
                      freshMatch
                        ? {
                          ...freshMatch,
                          ...fav,
                          price: freshMatch.price || fav.price,
                          price_value_pct: freshMatch.price_value_pct ?? fav.price_value_pct,
                          is_favorite: true,
                        }
                        : fav
                    );
                  }
                  return nextFavs;
                });
              }
            } catch (favErr) {
              console.warn('Favourite expiry verification skipped:', favErr);
            }
          }

          const totalExpiredRemoved = removedStaleCount + expiredFavsRemoved;
          if (circuitOpen) {
            const mins = Math.ceil(cooldownSecs / 60);
            setScrapeStatusText(`🛡️ P24 Rate-Limit Shield Active (${mins}m cooldown). Serving ${mapped.length} cached listings to prevent IP block.`);
          } else if (staleSuburbs.length > 0) {
            setScrapeStatusText(
              `⚡ Refreshed ${refreshedSuburbs.join(', ') || 'batch'}${totalExpiredRemoved > 0 ? ` (removed ${totalExpiredRemoved} expired)` : ''}. ${staleSuburbs.join(', ')} still cached — click Scrape P24 again to retry.`
            );
          } else if (totalExpiredRemoved > 0) {
            setScrapeStatusText(
              `🔄 Refreshed ${selectedSuburbs.join(', ')}: removed ${totalExpiredRemoved} expired listing${totalExpiredRemoved === 1 ? '' : 's'}, ${mapped.length} active.`
            );
          } else if (addedCount > 0) {
            setScrapeStatusText(`✨ Found ${addedCount} new live listings from Property24 (${mapped.length} active for ${selectedSuburbs.join(', ')})!`);
          } else if (refreshedSuburbs.length > 0) {
            setScrapeStatusText(`✨ Property24 live check complete: Refreshed ${mapped.length} active listings for ${refreshedSuburbs.join(', ')}.`);
          } else {
            setScrapeStatusText(`⚡ Serving ${mapped.length} cached listings for ${selectedSuburbs.join(', ')} (scraped under 15 min ago).`);
          }
        } else if (data.status === 'cooldown') {
          const mins = Math.ceil((data.rate_guard?.cooldown_remaining_seconds || 180) / 60);
          setScrapeStatusText(`🛡️ Property24 rate-limit shield active (${mins}m cooldown). Showing ${data.count || 0} cached listings.`);
        } else {
          setScrapeStatusText(`No new direct listings matched on Property24 for ${selectedSuburbs.join(', ')}. Showing cached listings.`);
        }
      } else {
        setScrapeStatusText('Live portal connection timed out. Showing cached contenders.');
      }
    } catch (err: any) {
      console.error('Scrape error:', err);
      setScrapeStatusText(
        err?.name === 'AbortError'
          ? 'Live portal scrape timed out. Using cached high-trust properties.'
          : 'Could not connect to live portal. Using cached high-trust properties.'
      );
    } finally {
      stopProgressTimer();
      setIsScraping(false);
      setTimeout(() => setScrapeStatusText(''), 6000);
    }
  };

  // Combine live/scraped properties with user imported favourites
  const allCandidateProperties = useMemo(() => {
    const list: PropertyMapItem[] = [...properties];
    const seenP24Ids = new Set(list.map((p) => String((p as any).p24_id || p.id).replace('p24-', '')));
    const seenIds = new Set(list.map((p) => p.id));

    for (const fav of importedFavourites) {
      const p24Id = String((fav as any).p24_id || fav.id).replace('p24-', '');
      if (!seenIds.has(fav.id) && (!p24Id || !seenP24Ids.has(p24Id))) {
        list.push({ ...fav, is_favorite: true });
        seenIds.add(fav.id);
        if (p24Id) seenP24Ids.add(p24Id);
      }
    }
    return list;
  }, [properties, importedFavourites]);

  // Strictly filter properties by selected suburbs, budget, and bedroom criteria
  const { sortedProperties, radiusExcludedCount } = useMemo(() => {
    let excludedByRadius = 0;
    const suburbCoords = selectedSuburbs.map((s) => ({
      name: s.toLowerCase().trim(),
      ...resolveLocationCoords(s),
    }));

    const minP = parseInt(minPrice) || 0;
    const maxP = parseInt(maxPrice) || 999999;
    const minBeds = parseFloat(bedrooms.replace(/[^0-9.]/g, '')) || 0;

    // 1. Strict Suburb Match (bypassed when viewing Favourites so all saved/imported favs appear)
    const suburbMatched = showOnlyFavourites
      ? allCandidateProperties.filter((prop) =>
        Boolean(
          favouritePropertyIds.includes(prop.id) ||
          prop.is_favorite ||
          importedFavourites.some((fav) => fav.id === prop.id || ((fav as any).p24_id && (fav as any).p24_id === (prop as any).p24_id))
        )
      )
      : allCandidateProperties.filter((prop) => {
        if (suburbCoords.length === 0) return true;
        const propSub = String((prop as any).suburb || '').toLowerCase().trim();
        if (propSub && suburbCoords.some((sc) => sc.name === propSub)) return true;
        const addrLower = `${prop.address || ''}`.toLowerCase();
        const matchesAddrSuburb = suburbCoords.some((sc) => {
          if (sc.name === 'gardens' && addrLower.includes('dormax gardens') && !propSub.includes('gardens')) {
            return false;
          }
          return addrLower.includes(`, ${sc.name}`) || addrLower.startsWith(`${sc.name},`) || propSub === sc.name;
        });
        if (matchesAddrSuburb) return true;
        return suburbCoords.some((sc) => getDistanceKm(prop.lat, prop.lng, sc.lat, sc.lng) <= 1.8);
      });

    // 2. Apply budget, bedroom, minimum floor size (sqm) & structured feature filters (bypassed in Favs mode)
    const criteriaMatched = showOnlyFavourites ? suburbMatched : suburbMatched.filter((prop) => {
      if (minP > 0 && prop.price > 0 && prop.price < minP) return false;
      if (maxP > 0 && prop.price > maxP) return false;
      if (minBeds > 0 && prop.bedrooms < minBeds) return false;
      if (minSqm > 0) {
        const propSqm =
          prop.sqm ||
          (() => {
            const m = `${prop.title} ${prop.address}`.match(/(\d+)\s*(?:m²|sqm|m2)/i);
            return m ? parseInt(m[1], 10) : 0;
          })();
        if (propSqm > 0 && propSqm < minSqm) return false;
      }

      // Safe-ish crime filter (ON by default): hides properties within radius of High Risk crime hotspot
      if (safeishFilter && isPropertyInHighRiskCrimeZone(prop.lat, prop.lng)) {
        return false;
      }

      // Below market value filter: only keep properties marked underpriced (▼ X%) by the risk-adjusted valuation model
      if (belowMarketFilter) {
        const val = getRiskAdjustedValuation(prop, allCandidateProperties);
        if (!val || !val.isUnderpriced) return false;
      }

      // Off-Bars & Clubs filter: hides properties within close nightlife/bar noise radius
      if (offBarsFilter && getPropertyBarNoiseExposure(prop).isExposed) {
        return false;
      }

      // 1. Fibre ready filter
      if (fibreFilter) {
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const hasFibre = Boolean(prop.fibre_ready) || text.includes('fibre') || text.includes('fiber') || text.includes('wifi');
        if (!hasFibre) return false;
      }

      // 3. Off-street parking filter (excludes street parking)
      if (parkingFilter) {
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const isStreetOnly =
          prop.parking_type === 'street' ||
          prop.parking_type === 'none' ||
          text.includes('street parking only') ||
          text.includes('on-street parking only');
        const hasOffStreetParking =
          Boolean(prop.has_garage) ||
          (prop.parking_type && prop.parking_type !== 'none' && prop.parking_type !== 'street') ||
          (!isStreetOnly &&
            (text.includes('garage') ||
              text.includes('off-street') ||
              text.includes('off street') ||
              text.includes('secure bay') ||
              text.includes('parking bay') ||
              text.includes('basement parking') ||
              text.includes('undercover parking') ||
              text.includes('carport') ||
              text.includes('bay')));
        if (!hasOffStreetParking) return false;
      }

      // 4. Pet-friendly filter
      if (petFriendlyFilter) {
        const text = `${prop.title} ${prop.address}`.toLowerCase();
        const isPet = Boolean(prop.pet_friendly) || text.includes('pet');
        if (!isPet) return false;
      }

      // 6. 100% Private Standalone filter (excludes cottages/flatlets on landlord property)
      if (privateOnlyFilter && isLandlordOnSiteProperty(prop)) {
        return false;
      }

      // 7. Off-Main Road filter (ON by default): excludes properties directly on busy arterial corridors (Main Rd, Victoria Rd, etc.)
      if (offMainRoadFilter && isMainRoadProperty(prop.address, prop.title)) {
        return false;
      }

      // 8. Selected Location Radius Filter (ON by default):
      // When withinRadiusFilter is active and an anchor location is selected,
      // properties outside the chosen radius buffer are filtered out of the top fits.
      if (withinRadiusFilter && activeAnchor) {
        const distKm = getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng);
        if (distKm > locationRadiusKm) {
          excludedByRadius += 1;
          return false;
        }
      }

      return true;
    });

    // 3. Deterministic Spec, Acoustic & Personal Preferences Matching
    const scoredList = criteriaMatched.map((prop) => {
      let baseScore = prop.fit_score || 88;
      const text = `${prop.title} ${prop.address} ${(prop as any).suburb || ''}`.toLowerCase();
      const pref = personalPreferences.toLowerCase();

      // Selected Location Proximity & Radius Fit Penalty/Boost
      let distToAnchor: number | null = null;
      let isOutsideRadius = false;
      if (activeAnchor) {
        distToAnchor = getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng);
        if (distToAnchor > locationRadiusKm) {
          isOutsideRadius = true;
          // Severe penalty: outside of user-selected radius is NOT a good fit
          baseScore -= 35;
        } else {
          // Within radius: award proximity boost based on closeness
          if (distToAnchor <= 1.5) {
            baseScore += 6;
          } else if (distToAnchor <= 3.0) {
            baseScore += 4;
          } else {
            baseScore += 2;
          }
        }
      }

      // Main Road Arterial Traffic Penalty (continuous noise & opportunistic street crime)
      const busyRoadInfo = getPropertyBusyRoadExposure(prop);
      const isMainRoad = Boolean(prop.is_main_road) || isMainRoadProperty(prop.address, prop.title) || busyRoadInfo.isDirectlyOnRoad;
      if (isMainRoad) {
        baseScore -= 18;
      } else if (busyRoadInfo.isNearBusyRoad) {
        baseScore -= 10;
      }

      // Privacy / No Landlord On-Site Preference Matching
      const wantsPrivate =
        pref.includes('private') ||
        pref.includes('landlord') ||
        pref.includes('cottage') ||
        pref.includes('on-site') ||
        privateOnlyFilter;

      const isLandlordOnSite = isLandlordOnSiteProperty(prop);

      if (wantsPrivate) {
        if (isLandlordOnSite) {
          // Substantial penalty when user specifies private / no landlord on site
          baseScore -= 24;
        } else {
          // Significant boost for standalone, private residences (apartments, townhouses, houses)
          baseScore += 8;
        }
      }

      // Work style / remote work preference matching
      const wantsWfh = pref.includes('work from home') || pref.includes('wfh') || pref.includes('remote work');
      const wantsWfhFullTime = pref.includes('full-time') && (pref.includes('wfh') || pref.includes('work from home'));
      const wantsWfhPartTime = pref.includes('part-time') && (pref.includes('wfh') || pref.includes('work from home'));
      const wantsCafes = pref.includes('cafes') || pref.includes('coffee');
      const wantsOffice = pref.includes('office');

      if (wantsWfhFullTime) {
        if (prop.fibre_ready) baseScore += 6;
        if (prop.noise_risk === 'sanctuary') baseScore += 6;
        else if (isMainRoad || prop.noise_risk === 'high') baseScore -= 14;
        if (prop.sqm && prop.sqm >= 65) baseScore += 4;
        else if (prop.sqm && prop.sqm < 40) baseScore -= 8;
      } else if (wantsWfhPartTime || wantsWfh) {
        if (prop.fibre_ready) baseScore += 4;
        if (prop.noise_risk === 'sanctuary') baseScore += 3;
        else if (isMainRoad) baseScore -= 8;
      }

      if (wantsCafes) {
        const hasCafeProximity = Array.isArray(prop.location_proximity) && prop.location_proximity.some((p: any) =>
          String(p.name || p.category || '').toLowerCase().includes('cafe') ||
          String(p.name || p.category || '').toLowerCase().includes('coffee')
        );
        if (hasCafeProximity) baseScore += 5;
      }

      if (wantsOffice && activeAnchor) {
        if (distToAnchor !== null && distToAnchor <= 5.0) baseScore += 6;
        else if (distToAnchor !== null && distToAnchor > 12.0) baseScore -= 8;
      }

      // Sound sanctuary boost/penalty
      if (pref.includes('quiet') || pref.includes('sanctuary')) {
        if (prop.noise_risk === 'sanctuary') baseScore += 5;
        else if (prop.noise_risk === 'high' || isMainRoad) baseScore -= 10;
      }
      // Sunlight & orientation match
      if (pref.includes('north') && ((prop.acoustic_audit?.facing_direction || '').toLowerCase().includes('north') || text.includes('north'))) {
        baseScore += 3;
      }
      // View match
      if ((pref.includes('view') || pref.includes('ocean') || pref.includes('mountain')) && (text.includes('view') || text.includes('ocean') || text.includes('mountain') || text.includes('beach') || text.includes('sea'))) {
        baseScore += 3;
      }
      // Gas cooking match
      if (pref.includes('gas') && (prop.stove_type === 'gas' || text.includes('gas'))) {
        baseScore += 2;
      }
      // Fibre match
      if (pref.includes('fibre') && (prop.fibre_ready || text.includes('fibre'))) {
        baseScore += 2;
      }
      // Pets match
      if ((pref.includes('dog') || pref.includes('pet')) && prop.pet_friendly) {
        baseScore += 3;
      }

      const privacyInfo = getDwellingPrivacyInfo(prop);
      const agencyRep = getAgencyReputationInfo(prop);
      const barNoiseInfo = getPropertyBarNoiseExposure(prop);
      const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
      if (marketVal) {
        if (marketVal.pctDiff >= 30) {
          baseScore -= 24;
        } else if (marketVal.pctDiff >= 15) {
          baseScore -= 14;
        } else if (marketVal.pctDiff >= 5) {
          baseScore -= 6;
        } else if (marketVal.pctDiff <= -15) {
          baseScore += 10;
        } else if (marketVal.pctDiff <= -5) {
          baseScore += 5;
        }
      }
      if (agencyRep.isPoorAgency) {
        baseScore -= 28;
      }
      if (barNoiseInfo.isExposed) {
        baseScore -= barNoiseInfo.severity === 'high' ? 14 : 8;
      }
      const crimePerimeter = getCrimePerimeterInfo(prop);
      if (crimePerimeter.isNearHighRisk) {
        if (!crimePerimeter.hasEstateSecurity) {
          baseScore -= crimePerimeter.isInsideCore ? 16 : 10;
        } else {
          baseScore -= 3;
        }
      }
      const walkableNotes: string[] = [];
      let walkableHits = 0;
      if (walkablePlaces.length > 0 && prop.lat && prop.lng) {
        for (const wp of walkablePlaces) {
          const walkKm = getDistanceKm(prop.lat, prop.lng, wp.lat, wp.lng);
          if (walkKm <= 0.6) {
            baseScore += 8;
            walkableHits += 1;
            walkableNotes.push(`🚶 ${Math.round(walkKm * 1000)}m to ${wp.label}`);
          } else if (walkKm <= 1.2) {
            baseScore += 4;
            walkableHits += 1;
            walkableNotes.push(`🚶 ${walkKm.toFixed(1)} km to ${wp.label}`);
          }
        }
      }
      // If outside the chosen location radius, cap fit score at 55% max (never ranked as Top Fit)
      const finalFit = isOutsideRadius
        ? Math.min(55, Math.max(15, baseScore))
        : Math.min(99, Math.max(15, baseScore));

      const radiusNote = isOutsideRadius && activeAnchor && distToAnchor !== null
        ? `📍 Outside ${activeAnchor.label} radius (${distToAnchor.toFixed(1)} km > ${locationRadiusKm.toFixed(1)} km) · `
        : '';
      const privacyNote = privacyInfo.aiInsightNote;
      const acousticNote = busyRoadInfo.isNearBusyRoad && busyRoadInfo.road
        ? `🛣️ ${busyRoadInfo.isDirectlyOnRoad ? 'On' : 'Near'} ${busyRoadInfo.road.shortName} (~${busyRoadInfo.distanceM}m · ${busyRoadInfo.road.base_db} dB traffic)`
        : isMainRoad
          ? '⚠️ High-traffic arterial corridor (Main Rd)'
          : barNoiseInfo.isExposed && barNoiseInfo.hotspot
            ? `🔊 Near ${barNoiseInfo.hotspot.shortName || barNoiseInfo.hotspot.name} (~${barNoiseInfo.distanceM}m · ${barNoiseInfo.hotspot.base_db} dB)`
            : (prop.noise_risk === 'sanctuary' ? 'Code-verified <38 dB quiet zone' : 'Residential street buffer');
      const specNote = `${prop.bedrooms} bed · ${prop.sqm || 68}m² · ${prop.fibre_ready ? 'Fibre' : 'Standard'}`;
      const agencyNote = agencyRep.isPoorAgency
        ? `🚩 Poor Agency (${agencyRep.agencyName}: ${agencyRep.rating}★) · `
        : '';

      return {
        ...prop,
        fit_score: finalFit,
        is_landlord_on_site: isLandlordOnSite,
        is_main_road: isMainRoad,
        is_outside_radius: isOutsideRadius,
        distance_to_anchor_km: distToAnchor,
        walkable_hits: walkableHits,
        ai_insight: `${radiusNote}${agencyNote}${walkableNotes.length ? `${walkableNotes.join(' · ')} · ` : ''}${privacyNote} · ${acousticNote} · ${specNote}`,
      };
    });

    const sorted = [...scoredList].sort((a, b) => {
      if (sortBy === 'fit') {
        // Properties inside the chosen location radius ALWAYS rank above properties outside the radius
        if (activeAnchor) {
          const aDist = getDistanceKm(a.lat, a.lng, activeAnchor.lat, activeAnchor.lng);
          const bDist = getDistanceKm(b.lat, b.lng, activeAnchor.lat, activeAnchor.lng);
          const aWithin = aDist <= locationRadiusKm;
          const bWithin = bDist <= locationRadiusKm;
          if (aWithin !== bWithin) return aWithin ? -1 : 1;
        }
        const fitDiff = (b.fit_score || 0) - (a.fit_score || 0);
        if (fitDiff !== 0) return fitDiff;
        return ((b as any).walkable_hits || 0) - ((a as any).walkable_hits || 0);
      }
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'distance' && activeAnchor) {
        const distA = getDistanceKm(a.lat, a.lng, activeAnchor.lat, activeAnchor.lng);
        const distB = getDistanceKm(b.lat, b.lng, activeAnchor.lat, activeAnchor.lng);
        return distA - distB;
      }
      return (b.fit_score || 0) - (a.fit_score || 0);
    });

    // 4. Generate Forensic AI Reports for every listing
    const budgetCeiling = parseInt(maxPrice) || 0;
    const isAutoHiddenUnpriced = (p: { price?: number }) =>
      budgetCeiling > 0 && budgetCeiling < 50000 && (!p.price || p.price <= 0);

    return {
      sortedProperties: sorted.map((prop, idx) => {
        const rank = idx + 1;
        return {
          ...prop,
          rank,
          is_hidden: hiddenPropertyIds.includes(prop.id) || isAutoHiddenUnpriced(prop),
          deep_ai_audit:
            prop.deep_ai_audit ||
            generatePropertyAiAudit(prop, rank, {
              userPreferences: personalPreferences,
              cardGalleries,
              allCandidateProperties,
              activeAnchor,
            }),
        };
      }),
      radiusExcludedCount: excludedByRadius,
    };
  }, [allCandidateProperties, selectedSuburbs, minPrice, maxPrice, bedrooms, minSqm, safeishFilter, offMainRoadFilter, offBarsFilter, withinRadiusFilter, locationRadiusKm, fibreFilter, parkingFilter, petFriendlyFilter, privateOnlyFilter, belowMarketFilter, personalPreferences, walkablePlaces, sortBy, activeAnchor, deepAiRunCount, hiddenPropertyIds, empiricalMediansLoaded, showOnlyFavourites, favouritePropertyIds, importedFavourites]);

  // Derived visible properties based on whether user toggled "Show Hidden" and "Show Favourites"
  const displayProperties = useMemo(() => {
    // 1. Tag is_favorite status from favouritePropertyIds & importedFavourites
    const tagged = sortedProperties.map((prop) => ({
      ...prop,
      is_favorite: Boolean(
        favouritePropertyIds.includes(prop.id) ||
        prop.is_favorite ||
        importedFavourites.some((fav) => fav.id === prop.id || ((fav as any).p24_id && (fav as any).p24_id === (prop as any).p24_id))
      ),
    }));

    // 2. Apply budget, bedroom, minimum floor size (sqm) & structured feature filters (bypassed in Favs mode)
    const budgetMaxVal = parseInt(maxPrice) || 0;
    const isAutoHiddenNoPrice = (p: { price?: number }) =>
      budgetMaxVal > 0 && budgetMaxVal < 50000 && (!p.price || p.price <= 0);

    // 2b. Filter hidden if showHidden is false (includes auto-hidden POA/unpriced listings when budget < R50k)
    const visible = showHidden
      ? tagged
      : tagged.filter((prop) => !hiddenPropertyIds.includes(prop.id) && !isAutoHiddenNoPrice(prop));

    // 3. Filter favourites if showOnlyFavourites is true
    const candidateList = showOnlyFavourites ? visible.filter((prop) => prop.is_favorite) : visible;

    // 4. Intelligent Multi-Listing Cross-Agency De-duplication
    // Detects and merges duplicate listings of the same apartment uploaded by different agencies
    const deduped: PropertyMapItem[] = [];
    const seenP24Ids = new Set<string>();
    const seenImgFingerprints = new Map<string, number>();
    const seenStreetSpecs = new Map<string, number>();

    const getImgFingerprint = (p: PropertyMapItem): string | null => {
      const src = (p.images && p.images[0]) || (p as any).image || '';
      const match = src.match(/images\.prop24\.com\/(\d+)/);
      return match ? match[1] : null;
    };

    const getStreetKey = (p: PropertyMapItem): string | null => {
      const addr = (p.address || '').toLowerCase().trim();
      if (!addr || addr.includes('contact agent') || addr.includes('withheld') || addr.includes('to rent in')) return null;
      const streetClues = ['street', 'st', 'road', 'rd', 'avenue', 'ave', 'drive', 'dr', 'circle', 'lane', 'close', 'crescent', 'cres', 'way', 'walk', 'court', 'terrace', 'terraces', 'boulevard', 'blvd'];
      const hasClue = streetClues.some(c => new RegExp(`\\b${c}\\b`).test(addr));
      if (!hasClue) return null;
      const cleanAddr = addr.replace(/^(?:unit|apt|apartment|flat)\s*\d+[a-zA-Z]?\s*,\s*/i, '').replace(/,\s*cape town.*$/i, '').trim();
      const beds = p.bedrooms || 1;
      const sqm = (p as any).sqm || 0;
      return `${cleanAddr}|${beds}|${sqm}`;
    };

    for (const prop of candidateList) {
      const p24Id = String((prop as any).p24_id || prop.id || '').replace('p24-', '');
      if (p24Id && seenP24Ids.has(p24Id)) continue;

      const imgFp = getImgFingerprint(prop);
      const stKey = getStreetKey(prop);

      let existingIdx: number | undefined = undefined;
      if (imgFp && seenImgFingerprints.has(imgFp)) {
        existingIdx = seenImgFingerprints.get(imgFp);
      } else if (stKey && seenStreetSpecs.has(stKey)) {
        existingIdx = seenStreetSpecs.get(stKey);
      }

      if (existingIdx !== undefined) {
        // Duplicate detected! Keep the one with the better price
        const prev = deduped[existingIdx];
        if (prop.price && prev.price && prop.price < prev.price) {
          seenP24Ids.delete(String((prev as any).p24_id || prev.id || '').replace('p24-', ''));
          seenP24Ids.add(p24Id);
          deduped[existingIdx] = prop;
          if (imgFp) seenImgFingerprints.set(imgFp, existingIdx);
          if (stKey) seenStreetSpecs.set(stKey, existingIdx);
        }
        continue;
      }

      const idx = deduped.length;
      if (p24Id) seenP24Ids.add(p24Id);
      if (imgFp) seenImgFingerprints.set(imgFp, idx);
      if (stKey) seenStreetSpecs.set(stKey, idx);
      deduped.push(prop);
    }

    // Re-number visible, deduplicated listings sequentially (#1, #2, #3...)
    return deduped.map((prop: any, idx) => ({
      ...prop,
      rank: idx + 1,
    }));
  }, [sortedProperties, importedFavourites, favouritePropertyIds, hiddenPropertyIds, showHidden, showOnlyFavourites, maxPrice]);

  const hiddenCount = useMemo(() => {
    const budgetMaxVal = parseInt(maxPrice) || 0;
    return sortedProperties.filter(
      (prop) =>
        hiddenPropertyIds.includes(prop.id) ||
        (budgetMaxVal > 0 && budgetMaxVal < 50000 && (!prop.price || prop.price <= 0))
    ).length;
  }, [sortedProperties, hiddenPropertyIds, maxPrice]);

  const favouriteCount = useMemo(() => {
    return displayProperties.filter((p) => p.is_favorite).length;
  }, [displayProperties]);

  const totalFavouritesCount = useMemo(() => {
    const ids = new Set(favouritePropertyIds);
    for (const f of importedFavourites) ids.add(f.id);
    return ids.size;
  }, [favouritePropertyIds, importedFavourites]);

  // Whenever the Areas filter (selectedSuburbs) changes, clear any selected listing and frame the area cleanly
  const areasFilterKey = selectedSuburbs.map((s) => s.toLowerCase().trim()).join('|');
  useEffect(() => {
    setSelectedPropertyId(null);
    if (displayProperties.length > 0) {
      const topListing = displayProperties[0];
      setFocusTarget({
        lat: topListing.lat,
        lng: topListing.lng,
        zoom: 13.6,
        timestamp: Date.now(),
      });
    } else if (selectedSuburbs.length > 0) {
      const coords = resolveLocationCoords(selectedSuburbs[0]);
      setFocusTarget({
        lat: coords.lat,
        lng: coords.lng,
        zoom: 13.6,
        timestamp: Date.now(),
      });
    }
  }, [areasFilterKey]);

  // Auto-scroll left sidebar to selected property when clicked/highlighted on map
  useEffect(() => {
    if (!selectedPropertyId) return;
    if (isListCollapsed) {
      setIsListCollapsed(false);
    }
    const timer = setTimeout(() => {
      const el = document.getElementById(`property-card-${selectedPropertyId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);
    return () => clearTimeout(timer);
  }, [selectedPropertyId, isListCollapsed]);

  // Photos and galleries are fetched strictly on-demand when user clicks card navigation,
  // preventing automated background request bursts to Property24.

  const {
    viewingAiReportProp,
    setViewingAiReportProp,
    reportHistoryByProp,
    planSummary,
    uploadedViewingPhotos,
    setUploadedViewingPhotos,
    photoSourceMode,
    setPhotoSourceMode,
    compareIds,
    snagCopied,
    handleUploadViewingPhotos,
    isExportingPdf,
    isEmailPdfOpen,
    setIsEmailPdfOpen,
    emailPdfTarget,
    setEmailPdfTarget,
    isSendingEmailPdf,
    emailPdfStatus,
    setEmailPdfStatus,
    handleDownloadReportPdf,
    handleEmailReportPdf,
    handleCopySnagReport,
    handleUpdatePreferences,
    runForensicAiInspection,
    handleOverrideDwellingPrivacy,
    handleTogglePropertyAiReport,
  } = useAiPropertyReport({
    user,
    personalPreferences,
    setPersonalPreferences,
    cardGalleries,
    fetchCardGallery,
    allCandidateProperties,
    activeAnchor,
    setProperties,
    setSelectedPropertyId,
  });

  return (
    <div className="fixed inset-0 top-16 bg-zinc-50 flex flex-col font-sans select-none overflow-hidden z-10">
      <Navbar user={user} profile={profile} handleLogout={logout} />

      {/* Live Scrape & AI Analysis Floating Toast Notification */}
      {scrapeStatusText && (
        <div className="fixed top-20 right-6 z-[150] animate-in fade-in slide-in-from-top-3 duration-200">
          <div className={`px-4 py-2.5 rounded-2xl shadow-2xl backdrop-blur-xl border flex items-center gap-2.5 text-xs font-bold ${scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete')
            ? 'bg-emerald-950/95 text-emerald-100 border-emerald-500/60 shadow-emerald-950/40'
            : scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Running') || scrapeStatusText.includes('Connecting')
              ? 'bg-indigo-950/95 text-indigo-100 border-indigo-500/60 shadow-indigo-950/40'
              : 'bg-zinc-950/95 text-zinc-100 border-zinc-700/60 shadow-black/40'
            }`}>
            {scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Running') || scrapeStatusText.includes('Connecting') ? (
              <CircleNotch size={16} className="animate-spin text-indigo-400 shrink-0" />
            ) : scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete') ? (
              <CheckCircle size={16} weight="fill" className="text-emerald-400 shrink-0" />
            ) : (
              <Info size={16} weight="bold" className="text-amber-400 shrink-0" />
            )}
            <span>{scrapeStatusText}</span>
            <button
              type="button"
              onClick={() => setScrapeStatusText('')}
              className="ml-1.5 p-0.5 text-zinc-400 hover:text-white rounded-md cursor-pointer transition-colors"
              aria-label="Dismiss message"
            >
              <X size={12} weight="bold" />
            </button>
          </div>
        </div>
      )}

      {/* TOP COMPACT CRITERIA BAR (Sticky below Navbar) */}
      <SearchCriteriaBar
        savedSearchMenuRef={savedSearchMenuRef}
        budgetMenuRef={budgetMenuRef}
        sizeMenuRef={sizeMenuRef}
        anchorMenuRef={anchorMenuRef}
        isSavedSearchMenuOpen={isSavedSearchMenuOpen}
        setIsSavedSearchMenuOpen={setIsSavedSearchMenuOpen}
        savedSearches={savedSearches}
        activeSavedSearchId={activeSavedSearchId}
        areaMenuFilter={areaMenuFilter}
        setAreaMenuFilter={setAreaMenuFilter}
        applySavedSearch={applySavedSearch}
        handleDeleteSavedSearch={handleDeleteSavedSearch}
        isSavingSearch={isSavingSearch}
        setIsSavingSearch={setIsSavingSearch}
        newSearchName={newSearchName}
        setNewSearchName={setNewSearchName}
        handleSaveCurrentSearch={handleSaveCurrentSearch}
        setSelectedPropertyId={setSelectedPropertyId}
        setSelectedSuburbs={setSelectedSuburbs}
        setFocusTarget={setFocusTarget}
        isBudgetMenuOpen={isBudgetMenuOpen}
        setIsBudgetMenuOpen={setIsBudgetMenuOpen}
        minPrice={minPrice}
        setMinPrice={setMinPrice}
        maxPrice={maxPrice}
        setMaxPrice={setMaxPrice}
        displayPropertiesCount={displayProperties.length}
        bedrooms={bedrooms}
        setBedrooms={setBedrooms}
        isSizeMenuOpen={isSizeMenuOpen}
        setIsSizeMenuOpen={setIsSizeMenuOpen}
        minSqm={minSqm}
        setMinSqm={setMinSqm}
        isAnchorMenuOpen={isAnchorMenuOpen}
        setIsAnchorMenuOpen={setIsAnchorMenuOpen}
        activeAnchor={activeAnchor}
        activeAnchorId={activeAnchorId}
        setActiveAnchorId={setActiveAnchorId}
        activeTemplate={activeTemplate}
        withinRadiusFilter={withinRadiusFilter}
        setWithinRadiusFilter={setWithinRadiusFilter}
        locationRadiusKm={locationRadiusKm}
        setLocationRadiusKm={setLocationRadiusKm}
        templateGyms={templateGyms}
        templateCafes={templateCafes}
        templateShops={templateShops}
        templateAttractions={templateAttractions}
        otherAnchors={otherAnchors}
        newAnchorLabel={newAnchorLabel}
        setNewAnchorLabel={setNewAnchorLabel}
        isAnchorInputFocused={isAnchorInputFocused}
        setIsAnchorInputFocused={setIsAnchorInputFocused}
        anchorAutoIndex={anchorAutoIndex}
        setAnchorAutoIndex={setAnchorAutoIndex}
        anchorSuggestions={anchorSuggestions}
        handleSelectSuggestedPlace={handleSelectSuggestedPlace}
        handleAddCustomAnchor={handleAddCustomAnchor}
        selectedSuburbs={selectedSuburbs}
        handleFocusSuburb={handleFocusSuburb}
        handleRemoveSuburb={handleRemoveSuburb}
        suburbInput={suburbInput}
        setSuburbInput={setSuburbInput}
        isInputFocused={isInputFocused}
        setIsInputFocused={setIsInputFocused}
        autoIndex={autoIndex}
        setAutoIndex={setAutoIndex}
        autocompleteSuggestions={autocompleteSuggestions}
        handleAddSuburb={handleAddSuburb}
        setIsAiModalOpen={setIsAiModalOpen}
        handleScrapeP24={handleScrapeP24}
        isScraping={isScraping}
        isRateGuardActive={isRateGuardActive}
        filterPillsProps={{
          belowMarketFilter,
          setBelowMarketFilter,
          fibreFilter,
          setFibreFilter,
          safeishFilter,
          setSafeishFilter,
          offMainRoadFilter,
          setOffMainRoadFilter,
          offBarsFilter,
          setOffBarsFilter,
          activeAnchor,
          withinRadiusFilter,
          setWithinRadiusFilter,
          locationRadiusKm,
          parkingFilter,
          setParkingFilter,
          petFriendlyFilter,
          setPetFriendlyFilter,
          privateOnlyFilter,
          setPrivateOnlyFilter,
          hiddenCount,
          showHidden,
          setShowHidden,
          setIsImportModalOpen,
          totalFavouritesCount,
          favouriteCount,
          showOnlyFavourites,
          setShowOnlyFavourites,
        }}
      />

      {/* MAIN VIEWPORT: SPLIT COLUMN + FULL-WIDTH MAP CANVAS */}
      <main className="flex-1 w-full flex relative overflow-hidden min-h-0 z-0">

        {/* LEFT / SIDE COLUMN: PROPERTY CARDS FEED */}
        <SearchResultsList
          isListCollapsed={isListCollapsed}
          setIsListCollapsed={setIsListCollapsed}
          displayProperties={displayProperties}
          properties={properties}
          allCandidateProperties={allCandidateProperties}
          isScraping={isScraping}
          isInitialSyncing={isInitialSyncing}
          staleDataInfo={staleDataInfo}
          selectedSuburbs={selectedSuburbs}
          hiddenCount={hiddenCount}
          showHidden={showHidden}
          setShowHidden={setShowHidden}
          unhideAllProperties={unhideAllProperties}
          feedViewMode={feedViewMode}
          setFeedViewMode={setFeedViewMode}
          sortBy={sortBy}
          setSortBy={setSortBy}
          enableFitScore={enableFitScore}
          withinRadiusFilter={withinRadiusFilter}
          setWithinRadiusFilter={setWithinRadiusFilter}
          activeAnchor={activeAnchor}
          radiusExcludedCount={radiusExcludedCount}
          locationRadiusKm={locationRadiusKm}
          handleScrapeP24={handleScrapeP24}
          isRateGuardActive={isRateGuardActive}
          scrapeStatusText={scrapeStatusText}
          setScrapeStatusText={setScrapeStatusText}
          doesPropMatchSuburbs={doesPropMatchSuburbs}
          backendSyncError={backendSyncError}
          setBackendSyncError={setBackendSyncError}
          setSyncRetryTick={setSyncRetryTick}
          setGhostRetryTick={setGhostRetryTick}
          setPrivateOnlyFilter={setPrivateOnlyFilter}
          setParkingFilter={setParkingFilter}
          setPetFriendlyFilter={setPetFriendlyFilter}
          setFibreFilter={setFibreFilter}
          setOffBarsFilter={setOffBarsFilter}
          setOffMainRoadFilter={setOffMainRoadFilter}
          setSafeishFilter={setSafeishFilter}
          setBelowMarketFilter={setBelowMarketFilter}
          setShowOnlyFavourites={setShowOnlyFavourites}
          selectedPropertyId={selectedPropertyId}
          setSelectedPropertyId={setSelectedPropertyId}
          hoveredPropertyId={hoveredPropertyId}
          hiddenPropertyIds={hiddenPropertyIds}
          setActiveAnchorId={setActiveAnchorId}
          templateGyms={templateGyms}
          anchors={anchors}
          setFocusTarget={setFocusTarget}
          compareIds={compareIds}
          toggleCompareProperty={toggleCompareProperty}
          viewingAiReportProp={viewingAiReportProp}
          handleTogglePropertyAiReport={handleTogglePropertyAiReport}
          resolveProperty24Url={resolveProperty24Url}
          openProperty24Url={openProperty24Url}
          resolveGoogleMapsUrl={resolveGoogleMapsUrl}
          cardGalleries={cardGalleries}
          cardImageIndices={cardImageIndices}
          setCardImageIndices={setCardImageIndices}
          fetchCardGallery={fetchCardGallery}
          getRectifiedUrl={getRectifiedUrl}
          toggleFavouriteProperty={toggleFavouriteProperty}
          toggleHideProperty={toggleHideProperty}
          editingAddressPropId={editingAddressPropId}
          setEditingAddressPropId={setEditingAddressPropId}
          manualAddressInput={manualAddressInput}
          setManualAddressInput={setManualAddressInput}
          manualAddressError={manualAddressError}
          setManualAddressError={setManualAddressError}
          isSubmittingAddress={isSubmittingAddress}
          handleSubmitManualAddress={handleSubmitManualAddress}
          openCommentsModal={openCommentsModal}
          commentCounts={commentCounts}
          recentComments={recentComments}
          setPreview3DTarget={setPreview3DTarget}
        />

        {/* EXPAND BUTTON (Visible when list is collapsed) */}
        {isListCollapsed && (
          <button
            type="button"
            onClick={() => setIsListCollapsed(false)}
            className="absolute top-4 left-4 z-30 px-3.5 py-2 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-zinc-200 text-xs font-extrabold text-zinc-900 flex items-center gap-2 hover:bg-zinc-50 transition-all cursor-pointer"
            title="Open Properties Column"
          >
            <Sliders size={15} weight="bold" className="text-indigo-600" />
            <span>Show {displayProperties.length} Properties</span>
            <CaretRight size={14} weight="bold" />
          </button>
        )}

        {/* RIGHT / FULL-WIDTH MAP CANVAS */}
        <div className="flex-1 h-full w-full relative bg-zinc-100 overflow-hidden">
          <PropertyMap
            mode="default"
            properties={displayProperties}
            ghostListings={ghostListings}
            onGhostLayerToggle={(visible) => {
              if (visible && ghostListings.length === 0) {
                setGhostRetryTick((t) => t + 1);
              }
            }}
            anchors={displayedAnchors}
            selectedPropertyId={selectedPropertyId}
            selectedAnchorId={activeAnchorId}
            enableAiAnalysis={enableFitScore}
            focusTarget={focusTarget}
            onSelectProperty={(p: PropertyMapItem) => setSelectedPropertyId(selectedPropertyId === p.id ? null : p.id)}
            onDeselectProperty={() => setSelectedPropertyId(null)}
            onHoverProperty={(p: PropertyMapItem | null) => setHoveredPropertyId(p ? p.id : null)}
            showCardPopupOnMap={false}
            onSelectAnchor={(a: ProximityAnchor) => setActiveAnchorId(a.id)}
            selectedSuburbs={selectedSuburbs}
            onAddSuburb={(suburb: string) => handleAddSuburb(suburb)}
            onOpenAiReport={(p: PropertyMapItem) => handleTogglePropertyAiReport(p)}
            commentCounts={commentCounts}
            onOpenComments={(p: PropertyMapItem) => openCommentsModal(p)}
            proximityFilter={activeAnchor ? { label: activeAnchor.label, lat: activeAnchor.lat, lng: activeAnchor.lng, radiusKm: locationRadiusKm } : null}
            onRadiusChange={(r) => setLocationRadiusKm(r)}
            withinRadiusFilter={withinRadiusFilter}
            onToggleWithinRadiusFilter={(next) => setWithinRadiusFilter(next)}
            className="w-full h-full"
          />
        </div>

      </main>

      {/* LISTING COMMENTS MODAL */}
      <CommentsModal
        prop={commentModalProp}
        comments={listingComments}
        isLoading={isLoadingComments}
        newCommentText={newCommentText}
        isPosting={isPostingComment}
        editingCommentId={editingCommentId}
        editingCommentText={editingCommentText}
        commentError={commentError}
        activeCommentUid={activeCommentUid}
        activeCommentNickname={activeCommentNickname}
        isSignedIn={Boolean(user)}
        onClose={() => setCommentModalProp(null)}
        onChangeNewComment={setNewCommentText}
        onCreateComment={handleCreateComment}
        onStartEdit={(id, body) => {
          setEditingCommentId(id);
          setEditingCommentText(body);
        }}
        onCancelEdit={() => setEditingCommentId(null)}
        onChangeEditText={setEditingCommentText}
        onSaveEdit={handleUpdateComment}
        onDeleteComment={handleDeleteComment}
      />

      <TopTenRankerModal
        isOpen={isAiModalOpen}
        matchingCount={displayProperties.length}
        selectedSuburbs={selectedSuburbs}
        minPrice={minPrice}
        maxPrice={maxPrice}
        bedrooms={bedrooms}
        safeishFilter={safeishFilter}
        withinRadiusFilter={withinRadiusFilter}
        activeAnchorLabel={activeAnchor?.label ?? null}
        locationRadiusKm={locationRadiusKm}
        fibreFilter={fibreFilter}
        parkingFilter={parkingFilter}
        petFriendlyFilter={petFriendlyFilter}
        personalPreferences={personalPreferences}
        walkablePlaces={walkablePlaces}
        isRunningDeepAi={isRunningDeepAi}
        onClose={() => setIsAiModalOpen(false)}
        onUpdatePreferences={handleUpdatePreferences}
        onAddWalkablePlace={handleAddWalkablePlace}
        onRemoveWalkablePlace={handleRemoveWalkablePlace}
        onRunAnalysis={handleRunDeepAiAnalysis}
      />

      <AiPropertyReportModal
        viewingAiReportProp={viewingAiReportProp}
        setViewingAiReportProp={setViewingAiReportProp}
        selectedSuburbs={selectedSuburbs}
        minPrice={minPrice}
        maxPrice={maxPrice}
        bedrooms={bedrooms}
        safeishFilter={safeishFilter}
        withinRadiusFilter={withinRadiusFilter}
        activeAnchor={activeAnchor}
        locationRadiusKm={locationRadiusKm}
        fibreFilter={fibreFilter}
        parkingFilter={parkingFilter}
        petFriendlyFilter={petFriendlyFilter}
        minSqm={minSqm}
        offMainRoadFilter={offMainRoadFilter}
        offBarsFilter={offBarsFilter}
        privateOnlyFilter={privateOnlyFilter}
        personalPreferences={personalPreferences}
        handleUpdatePreferences={handleUpdatePreferences}
        planSummary={planSummary}
        uploadedViewingPhotos={uploadedViewingPhotos}
        setUploadedViewingPhotos={setUploadedViewingPhotos}
        handleUploadViewingPhotos={handleUploadViewingPhotos}
        photoSourceMode={photoSourceMode}
        setPhotoSourceMode={setPhotoSourceMode}
        runForensicAiInspection={runForensicAiInspection}
        compareIds={compareIds}
        toggleCompareProperty={toggleCompareProperty}
        snagCopied={snagCopied}
        handleCopySnagReport={handleCopySnagReport}
        isExportingPdf={isExportingPdf}
        handleDownloadReportPdf={handleDownloadReportPdf}
        isEmailPdfOpen={isEmailPdfOpen}
        setIsEmailPdfOpen={setIsEmailPdfOpen}
        emailPdfTarget={emailPdfTarget}
        setEmailPdfTarget={setEmailPdfTarget}
        isSendingEmailPdf={isSendingEmailPdf}
        emailPdfStatus={emailPdfStatus}
        setEmailPdfStatus={setEmailPdfStatus}
        handleEmailReportPdf={handleEmailReportPdf}
        userEmail={user?.email ?? null}
        cardGalleries={cardGalleries}
        getAgencyReputationInfo={getAgencyReputationInfo}
        getPropertyBarNoiseExposure={getPropertyBarNoiseExposure}
        getPropertyBusyRoadExposure={getPropertyBusyRoadExposure}
        isLandlordOnSiteProperty={isLandlordOnSiteProperty}
        resolveGoogleMapsUrl={resolveGoogleMapsUrl}
        resolveProperty24Url={resolveProperty24Url}
        openProperty24Url={openProperty24Url}
        reportHistory={viewingAiReportProp ? (reportHistoryByProp[viewingAiReportProp.id] || []) : []}
        onSelectReportVersion={(rep) =>
          setViewingAiReportProp((prev) => (prev ? { ...prev, deep_ai_audit: rep } : prev))
        }
        onOverrideDwellingPrivacy={handleOverrideDwellingPrivacy}
      />

      <FavouritesImportModal
        isOpen={isImportModalOpen}
        importInputText={importInputText}
        importedCount={importedFavourites.length}
        isImporting={isImporting}
        importStatusMsg={importStatusMsg}
        onClose={() => setIsImportModalOpen(false)}
        onChangeInput={setImportInputText}
        onClearAll={clearAllFavourites}
        onImport={handleImportFavourites}
      />

      <Mapbox3DModal
        target={preview3DTarget}
        onClose={() => setPreview3DTarget(null)}
      />

    </div>
  );
}
