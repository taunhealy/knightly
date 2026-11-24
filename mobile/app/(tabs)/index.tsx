import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import {
  askListingChat,
  fetchLiveListings,
  runForensicVision,
  type MobileProperty,
} from '@/lib/api';
import { useHomeSeek } from '@/lib/store';
import { CAPE_TOWN_AREA_PRESETS, CAPE_TOWN_SUBURBS } from '@/constants/capeTown';
import {
  calculateDistanceKm,
  CAPE_TOWN_HOTSPOTS,
  CAPE_TOWN_SANCTUARIES,
} from '@/constants/capeTownGeo';
import { ViewingModal } from '@/components/ViewingModal';
import { PropertyMapView } from '@/components/PropertyMapView';

const PROXIMITY_PRESETS = [
  // Deep South
  { label: 'Noordhoek Farm Village', area: 'Noordhoek', lat: -34.0954, lng: 18.3742 },
  { label: 'Longbeach Mall (Sun Valley)', area: 'Sunnydale', lat: -34.1182, lng: 18.3965 },
  { label: 'Muizenberg Surfers Corner', area: 'Muizenberg', lat: -34.1086, lng: 18.4706 },
  { label: 'Kalk Bay Harbour', area: 'Kalk Bay', lat: -34.1282, lng: 18.4494 },
  { label: 'Fish Hoek Beach', area: 'Fish Hoek', lat: -34.1387, lng: 18.4337 },
  { label: 'Kommetjie Lighthouse', area: 'Kommetjie', lat: -34.1510, lng: 18.3204 },
  { label: "Simon's Town Waterfront", area: "Simon's Town", lat: -34.1924, lng: 18.4326 },
  // Atlantic Seaboard & Hout Bay
  { label: 'Hout Bay Harbour', area: 'Hout Bay', lat: -34.0489, lng: 18.3474 },
  { label: 'Llandudno Beach', area: 'Llandudno', lat: -34.0081, lng: 18.3414 },
  { label: 'Camps Bay Promenade', area: 'Camps Bay', lat: -33.9510, lng: 18.3778 },
  { label: 'Sea Point Pavilion', area: 'Sea Point', lat: -33.9183, lng: 18.3822 },
  { label: 'Green Point Urban Park', area: 'Green Point', lat: -33.9044, lng: 18.4063 },
  { label: 'V&A Waterfront', area: 'Waterfront', lat: -33.9036, lng: 18.4205 },
  // City Bowl
  { label: 'Cape Town CBD / Bree St', area: 'City Bowl', lat: -33.9221, lng: 18.4187 },
  { label: 'Gardens Shopping Centre', area: 'Gardens', lat: -33.9344, lng: 18.4167 },
  { label: 'Kloof Street Lifestyle', area: 'Tamboerskloof', lat: -33.9317, lng: 18.4086 },
  // Southern Suburbs
  { label: 'Observatory Lower Main', area: 'Observatory', lat: -33.9378, lng: 18.4718 },
  { label: 'UCT Upper Campus', area: 'Rondebosch', lat: -33.9577, lng: 18.4612 },
  { label: 'Claremont Cavendish Square', area: 'Claremont', lat: -33.9803, lng: 18.4631 },
  { label: 'Kenilworth Centre', area: 'Kenilworth', lat: -33.9927, lng: 18.4902 },
  { label: 'Newlands / Kirstenbosch', area: 'Newlands', lat: -33.9875, lng: 18.4327 },
  { label: 'Constantia Village', area: 'Constantia', lat: -34.0229, lng: 18.4426 },
  { label: 'Tokai Blue Route Mall', area: 'Tokai', lat: -34.0631, lng: 18.4478 },
  // Northern & West Coast
  { label: 'Century City / Canal Walk', area: 'Century City', lat: -33.8933, lng: 18.5117 },
  { label: 'Bloubergstrand Beachfront', area: 'Bloubergstrand', lat: -33.8012, lng: 18.4648 },
  { label: 'Durbanville Village Square', area: 'Durbanville', lat: -33.8315, lng: 18.6476 },
];

export default function SearchScreen() {
  const {
    apiBaseUrl,
    compareList,
    toggleCompare,
    toggleFavourite,
    isFavourite,
    hiddenIds,
    toggleHide,
    personalPreferences,
    searchPrefill,
    setSearchPrefill,
  } = useHomeSeek();

  const [selectedSuburbs, setSelectedSuburbs] = useState<string[]>(['Hout Bay', 'Llandudno']);
  const [minPrice, setMinPrice] = useState('10000');
  const [maxPrice, setMaxPrice] = useState('22000');
  const [bedrooms, setBedrooms] = useState('1+');
  const [safeishFilter, setSafeishFilter] = useState(true);
  const [offMainRoadFilter, setOffMainRoadFilter] = useState(true);
  const [viewingOpen, setViewingOpen] = useState(false);
  const [viewingProp, setViewingProp] = useState<MobileProperty | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
  const [proximityAnchor, setProximityAnchor] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [proximityRadiusKm, setProximityRadiusKm] = useState(19.5);
  const [customRadiusText, setCustomRadiusText] = useState('300');
  const [customRadiusUnit, setCustomRadiusUnit] = useState<'m' | 'km'>('m');
  const [inRadiusFilter, setInRadiusFilter] = useState(false);

  const formatRadiusLabel = (km: number) =>
    km < 1 ? `${Math.round(km * 1000)}m` : `${Number(km.toFixed(2))}km`;
  const [proximityModalOpen, setProximityModalOpen] = useState(false);
  const [placeSearch, setPlaceSearch] = useState('');
  const [osmResults, setOsmResults] = useState<Array<{ label: string; lat: number; lng: number }>>([]);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);

  const allLocalPlaces = useMemo(() => {
    const base = PROXIMITY_PRESETS.map((p) => ({ ...p, kind: 'Landmark' }));
    const bars = CAPE_TOWN_HOTSPOTS.map((h) => ({
      label: h.shortName || h.name,
      area: h.name,
      lat: h.lat,
      lng: h.lng,
      kind: h.type === 'nightlife' ? 'Bar / Nightlife' : 'Transit / Hub',
    }));
    const parks = CAPE_TOWN_SANCTUARIES.map((s) => ({
      label: s.name,
      area: 'Park / Sanctuary',
      lat: s.lat,
      lng: s.lng,
      kind: 'Park / Sanctuary',
    }));
    return [...base, ...parks, ...bars];
  }, []);

  const filteredPresets = useMemo(() => {
    const q = placeSearch.trim().toLowerCase();
    if (!q) return PROXIMITY_PRESETS.map((p) => ({ ...p, kind: 'Landmark' }));
    return allLocalPlaces
      .filter((p) => `${p.label} ${p.area} ${p.kind}`.toLowerCase().includes(q))
      .slice(0, 30);
  }, [placeSearch, allLocalPlaces]);

  const searchFreeGeocode = async (overrideQuery?: string) => {
    const q = (overrideQuery ?? placeSearch).trim();
    if (q.length < 3) {
      setOsmResults([]);
      return;
    }
    setIsSearchingPlace(true);
    try {
      // 1. Photon (Komoot/OSM) - free, no key, great POI & cafe/bar autocomplete biased to Cape Town
      const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(
        q
      )}&lat=-34.02&lon=18.42&limit=6&lang=en`;
      const pRes = await fetch(photonUrl);
      const pData = await pRes.json();
      const features = Array.isArray(pData?.features) ? pData.features : [];
      const capeResults = features
        .filter((f: any) => {
          const [lng, lat] = f?.geometry?.coordinates || [];
          return lat >= -34.45 && lat <= -33.4 && lng >= 18.2 && lng <= 19.1;
        })
        .map((f: any) => {
          const props = f.properties || {};
          const [lng, lat] = f.geometry.coordinates;
          const parts = [props.name, props.street, props.suburb || props.district || props.city]
            .filter(Boolean)
            .slice(0, 2);
          return {
            label: parts.join(', ') || q,
            lat: Number(lat),
            lng: Number(lng),
          };
        });

      if (capeResults.length > 0) {
        setOsmResults(capeResults);
        return;
      }

      // 2. Nominatim fallback (also 100% free)
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=za&q=${encodeURIComponent(
        `${q}, Cape Town`
      )}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      const data = await res.json();
      if (Array.isArray(data)) {
        setOsmResults(
          data.map((d: any) => ({
            label: String(d.display_name || q).split(',').slice(0, 2).join(',').trim(),
            lat: parseFloat(d.lat),
            lng: parseFloat(d.lon),
          }))
        );
      }
    } catch {
      setOsmResults([]);
    } finally {
      setIsSearchingPlace(false);
    }
  };

  useEffect(() => {
    if (!proximityModalOpen) return;
    const q = placeSearch.trim();
    if (q.length < 3) {
      setOsmResults([]);
      return;
    }
    const t = setTimeout(() => {
      searchFreeGeocode(q);
    }, 350);
    return () => clearTimeout(t);
  }, [placeSearch, proximityModalOpen]);
  const [fibreFilter, setFibreFilter] = useState(false);
  const [parkingFilter, setParkingFilter] = useState(false);
  const [petFilter, setPetFilter] = useState(false);
  const [privateFilter, setPrivateFilter] = useState(false);
  const [belowMarketFilter, setBelowMarketFilter] = useState(false);
  const [furnishedFilter, setFurnishedFilter] = useState<'all' | 'furnished' | 'unfurnished'>('all');
  const [showHidden, setShowHidden] = useState(false);

  const [listings, setListings] = useState<MobileProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [staleInfo, setStaleInfo] = useState<{ isStale: boolean; days: number } | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [areaModalOpen, setAreaModalOpen] = useState(false);
  const [areaQuery, setAreaQuery] = useState('');

  // AI Analysis Modal State
  const [aiProp, setAiProp] = useState<MobileProperty | null>(null);
  const [aiVision, setAiVision] = useState<any>(null);
  const [isRunningAi, setIsRunningAi] = useState(false);
  const [chatMsgs, setChatMsgs] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  useEffect(() => {
    if (searchPrefill) {
      if (searchPrefill.suburbs?.length) setSelectedSuburbs(searchPrefill.suburbs);
      if (searchPrefill.minPrice !== undefined) setMinPrice(String(searchPrefill.minPrice));
      if (searchPrefill.maxPrice !== undefined) setMaxPrice(String(searchPrefill.maxPrice));
      if (searchPrefill.bedrooms) setBedrooms(searchPrefill.bedrooms);
      setSearchPrefill(null);
    }
  }, [searchPrefill, setSearchPrefill]);

  const loadCached = async (forceFresh = false) => {
    if (forceFresh) {
      setIsScraping(true);
      setStatusBanner(`Refreshing live listings for ${selectedSuburbs.join(', ')}...`);
    } else {
      setIsLoading(true);
    }
    try {
      const data = await fetchLiveListings(apiBaseUrl, {
        suburbs: selectedSuburbs,
        min_price: parseInt(minPrice, 10) || 0,
        max_price: parseInt(maxPrice, 10) || 999999,
        bedrooms,
        force_fresh: forceFresh,
      });
      const items: MobileProperty[] = Array.isArray(data?.listings) ? data.listings : [];
      setListings(items);
      const meta = data?.batch_meta;
      if (meta?.is_stale) {
        setStaleInfo({
          isStale: true,
          days: Math.floor((meta.oldest_age_seconds || 0) / 86400),
        });
      } else {
        setStaleInfo(null);
      }
      if (forceFresh) {
        setStatusBanner(`Refreshed ${items.length} active listings.`);
        setTimeout(() => setStatusBanner(null), 4000);
      }
    } catch {
      setStatusBanner(`Cannot reach backend at ${apiBaseUrl}. Update URL in Profile if using a physical phone.`);
    } finally {
      setIsLoading(false);
      setIsScraping(false);
    }
  };

  useEffect(() => {
    loadCached(false);
  }, [apiBaseUrl, selectedSuburbs.join('|'), minPrice, maxPrice, bedrooms]);

  const { visibleListings, hiddenCount } = useMemo(() => {
    const budgetCeiling = parseInt(maxPrice, 10) || 0;
    const filtered = listings.filter((p) => {
      if (safeishFilter && p.noise_risk === 'high_crime') return false;
      if (offMainRoadFilter && p.is_main_road) return false;
      if (fibreFilter && !p.fibre_ready) return false;
      if (parkingFilter && !p.has_garage && !p.has_secure_bay) return false;
      if (petFilter && !p.pet_friendly) return false;
      if (privateFilter && p.is_landlord_on_site) return false;
      if (belowMarketFilter && (typeof p.price_value_pct !== 'number' || p.price_value_pct >= 0)) return false;
      if (furnishedFilter !== 'all') {
        const txt = `${p.title || ''} ${p.description || ''} ${(p as any).furnished || ''}`.toLowerCase();
        const isUnfurnished = txt.includes('unfurnished');
        const isFurnished = !isUnfurnished && (txt.includes('furnished') || (p as any).is_furnished === true);
        if (furnishedFilter === 'furnished' && !isFurnished) return false;
        if (furnishedFilter === 'unfurnished' && !isUnfurnished && isFurnished) return false;
      }
      if (inRadiusFilter && proximityAnchor) {
        if (!p.lat || !p.lng) return false;
        const dist = calculateDistanceKm(proximityAnchor.lat, proximityAnchor.lng, Number(p.lat), Number(p.lng));
        if (dist > proximityRadiusKm) return false;
      }
      return true;
    });
    const sorted = proximityAnchor
      ? [...filtered].sort((a, b) => {
          const da = a.lat && a.lng ? calculateDistanceKm(proximityAnchor.lat, proximityAnchor.lng, Number(a.lat), Number(a.lng)) : 9999;
          const db = b.lat && b.lng ? calculateDistanceKm(proximityAnchor.lat, proximityAnchor.lng, Number(b.lat), Number(b.lng)) : 9999;
          return da - db;
        })
      : filtered;
    const isAutoHidden = (p: MobileProperty) =>
      budgetCeiling > 0 && budgetCeiling < 50000 && (!p.price || p.price <= 0);
    const hidden = sorted.filter((p) => hiddenIds.includes(p.id) || isAutoHidden(p));
    const visible = (showHidden ? sorted : sorted.filter((p) => !hiddenIds.includes(p.id) && !isAutoHidden(p))).map(
      (p, idx) => ({ ...p, rank: idx + 1 })
    );
    return { visibleListings: visible, hiddenCount: hidden.length };
  }, [listings, hiddenIds, showHidden, maxPrice, safeishFilter, offMainRoadFilter, fibreFilter, parkingFilter, petFilter, privateFilter, belowMarketFilter, furnishedFilter, inRadiusFilter, proximityAnchor, proximityRadiusKm]);

  const openAiModal = async (prop: MobileProperty) => {
    setAiProp(prop);
    setAiVision(null);
    setChatMsgs([]);
    setIsRunningAi(true);
    try {
      const res = await runForensicVision(apiBaseUrl, prop, personalPreferences);
      setAiVision(res?.vision || null);
    } catch {
      setAiVision(null);
    } finally {
      setIsRunningAi(false);
    }
  };

  const sendChat = async () => {
    if (!aiProp || !chatInput.trim() || isSendingChat) return;
    const q = chatInput.trim();
    const nextMsgs = [...chatMsgs, { role: 'user' as const, content: q }];
    setChatMsgs(nextMsgs);
    setChatInput('');
    setIsSendingChat(true);
    try {
      const res = await askListingChat(apiBaseUrl, aiProp, q, nextMsgs, personalPreferences);
      setChatMsgs([...nextMsgs, { role: 'assistant', content: res?.reply || 'No response received.' }]);
    } catch {
      setChatMsgs([...nextMsgs, { role: 'assistant', content: 'Could not reach Gemini AI right now.' }]);
    } finally {
      setIsSendingChat(false);
    }
  };

  return (
    <View style={styles.screen}>
      {/* Top Controls */}
      <View style={styles.topPanel}>
        <View style={styles.rowBetween}>
          <Pressable style={styles.areaBtn} onPress={() => setAreaModalOpen(true)}>
            <Ionicons name="location" size={14} color="#4f46e5" />
            <Text style={styles.areaBtnText} numberOfLines={1}>
              {selectedSuburbs.join(', ')}
            </Text>
            <Ionicons name="chevron-down" size={14} color="#52525b" />
          </Pressable>

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.scrapeBtn, isScraping && { opacity: 0.6 }]}
              onPress={() => loadCached(true)}
              disabled={isScraping}
            >
              {isScraping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="sparkles" size={13} color="#fde047" />
              )}
              <Text style={styles.scrapeBtnText}>{isScraping ? 'Scraping...' : 'Scrape P24'}</Text>
            </Pressable>
            <Pressable
              style={styles.saveAlertBtn}
              onPress={() => {
                setViewingProp(null);
                setViewingOpen(true);
              }}
            >
              <Ionicons name="location" size={13} color="#059669" />
              <Text style={styles.saveAlertText}>Viewing</Text>
            </Pressable>
          </View>
        </View>

        {/* Budget & Beds Strip */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillStrip}>
          {(['any', '0.5+', '1+', '2+'] as const).map((b) => (
            <Pressable
              key={b}
              onPress={() => setBedrooms(b)}
              style={[styles.pill, bedrooms === b && styles.pillActive]}
            >
              <Text style={[styles.pillText, bedrooms === b && styles.pillTextActive]}>
                {b === 'any' ? 'Any Beds' : `${b} Bed`}
              </Text>
            </Pressable>
          ))}
          {[
            { label: 'Safe-ish', active: safeishFilter, toggle: () => setSafeishFilter(!safeishFilter) },
            { label: 'Off-Main Rd', active: offMainRoadFilter, toggle: () => setOffMainRoadFilter(!offMainRoadFilter) },
            {
              label: proximityAnchor ? `In Radius (≤${formatRadiusLabel(proximityRadiusKm)})` : 'Proximity',
              active: Boolean(proximityAnchor && inRadiusFilter),
              toggle: () => {
                if (!proximityAnchor) {
                  setProximityModalOpen(true);
                } else {
                  setInRadiusFilter(!inRadiusFilter);
                }
              },
            },
            { label: 'Fibre', active: fibreFilter, toggle: () => setFibreFilter(!fibreFilter) },
            { label: 'Parking', active: parkingFilter, toggle: () => setParkingFilter(!parkingFilter) },
            { label: 'Pet-friendly', active: petFilter, toggle: () => setPetFilter(!petFilter) },
            { label: 'Private', active: privateFilter, toggle: () => setPrivateFilter(!privateFilter) },
            { label: 'Below market value', active: belowMarketFilter, toggle: () => setBelowMarketFilter((v) => !v) },
            {
              label:
                furnishedFilter === 'all'
                  ? 'Furnished?'
                  : furnishedFilter === 'furnished'
                  ? 'Furnished'
                  : 'Unfurnished',
              active: furnishedFilter !== 'all',
              toggle: () =>
                setFurnishedFilter((v) =>
                  v === 'all' ? 'furnished' : v === 'furnished' ? 'unfurnished' : 'all'
                ),
            },
          ].map((p) => (
            <Pressable
              key={p.label}
              onPress={p.toggle}
              style={[styles.pill, p.active && styles.pillActiveDark]}
            >
              <Text style={[styles.pillText, p.active && styles.pillTextActive]}>{p.label}</Text>
            </Pressable>
          ))}
          {hiddenCount > 0 && (
            <Pressable
              onPress={() => setShowHidden(!showHidden)}
              style={[styles.pill, showHidden && { backgroundColor: '#f59e0b', borderColor: '#d97706' }]}
            >
              <Text style={[styles.pillText, showHidden && { color: '#09090b' }]}>
                {showHidden ? `Showing Hidden (${hiddenCount})` : `${hiddenCount} Hidden`}
              </Text>
            </Pressable>
          )}
        </ScrollView>

        {staleInfo?.isStale && !isScraping && (
          <View style={styles.staleBanner}>
            <Text style={styles.staleText}>
              {staleInfo.days >= 1 ? `Cached data is ${staleInfo.days}d+ old` : 'Some suburb data is stale'} — refresh to update.
            </Text>
            <Pressable style={styles.staleCta} onPress={() => loadCached(true)}>
              <Text style={styles.staleCtaText}>Refresh</Text>
            </Pressable>
          </View>
        )}

        {statusBanner && (
          <View style={styles.statusBanner}>
            <Text style={styles.statusBannerText}>{statusBanner}</Text>
          </View>
        )}
        {/* View Mode Tabs: List (default) / Map + Proximity Location */}
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <View style={[styles.viewModeRow, { flex: 1 }]}>
            <Pressable
              onPress={() => setViewMode('list')}
              style={[styles.viewModeTab, viewMode === 'list' && styles.viewModeTabActive]}
            >
              <Ionicons name="list" size={14} color={viewMode === 'list' ? '#4f46e5' : '#71717a'} />
              <Text style={[styles.viewModeText, viewMode === 'list' && styles.viewModeTextActive]}>
                List ({visibleListings.length})
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setViewMode('map')}
              style={[styles.viewModeTab, viewMode === 'map' && styles.viewModeTabActive]}
            >
              <Ionicons name="map-outline" size={14} color={viewMode === 'map' ? '#4f46e5' : '#71717a'} />
              <Text style={[styles.viewModeText, viewMode === 'map' && styles.viewModeTextActive]}>
                Map
              </Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => setProximityModalOpen(true)}
            style={[
              styles.saveAlertBtn,
              proximityAnchor && { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
            ]}
          >
            <Ionicons name="locate-outline" size={13} color={proximityAnchor ? '#4338ca' : '#52525b'} />
            <Text style={[styles.saveAlertText, proximityAnchor && { color: '#4338ca' }]} numberOfLines={1}>
              {proximityAnchor ? `≤${formatRadiusLabel(proximityRadiusKm)}` : 'Near...'}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Listings Feed or Map View */}
      {isLoading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#4f46e5" />
          <Text style={styles.loadingText}>Loading Cape Town listings...</Text>
        </View>
      ) : viewMode === 'map' ? (
        <PropertyMapView
          listings={visibleListings}
          onOpenAi={openAiModal}
          onToggleCompare={toggleCompare}
          compareIds={compareList.map((c) => c.id)}
          proximityAnchor={proximityAnchor}
          proximityRadiusKm={proximityRadiusKm}
        />
      ) : (
        <FlatList
          data={visibleListings}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Ionicons name="eye-off-outline" size={32} color="#a1a1aa" />
              <Text style={styles.emptyTitle}>No Matching Listings</Text>
              <Text style={styles.emptySub}>
                Try clearing a filter pill or tap Refresh Listings to scrape Property24.
              </Text>
              <Pressable style={styles.scrapeBtn} onPress={() => loadCached(true)}>
                <Text style={styles.scrapeBtnText}>Refresh Listings</Text>
              </Pressable>
            </View>
          }
          renderItem={({ item }) => {
            const inCompare = compareList.some((c) => c.id === item.id);
            const fav = isFavourite(item.id);
            return (
              <View style={styles.card}>
                <View style={styles.imageWrap}>
                  <Image
                    source={{ uri: item.image || (item.images && item.images[0]) || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=600' }}
                    style={styles.cardImage}
                  />
                  <View style={styles.topOverlay}>
                    <View style={styles.priceBadge}>
                      <Text style={styles.priceText}>
                        {item.price > 0 ? `R ${item.price.toLocaleString()}/mo` : 'POA'}
                      </Text>
                    </View>
                    {item.fit_score ? (
                      <View style={styles.fitBadge}>
                        <Text style={styles.fitText}>{item.fit_score}% Fit</Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.topRightBtns}>
                    <Pressable
                      onPress={() => toggleFavourite(item)}
                      style={[styles.iconCircle, fav && { backgroundColor: '#e11d48' }]}
                    >
                      <Ionicons name={fav ? 'heart' : 'heart-outline'} size={15} color="#fff" />
                    </Pressable>
                    <Pressable onPress={() => toggleHide(item.id)} style={styles.iconCircle}>
                      <Ionicons name="eye-off-outline" size={15} color="#fff" />
                    </Pressable>
                  </View>

                  {/* Bottom-left rank badge */}
                  <View style={[styles.rankBadge, item.rank === 1 && { backgroundColor: '#059669' }]}>
                    <Text style={styles.rankText}>#{item.rank}</Text>
                  </View>

                  {/* Bottom-right AI Analysis & Property24 */}
                  <View style={styles.bottomRightBtns}>
                    <Pressable style={styles.aiPillBtn} onPress={() => openAiModal(item)}>
                      <Ionicons name="sparkles" size={11} color="#fde047" />
                      <Text style={styles.aiPillText}>AI Analysis</Text>
                    </Pressable>
                    {item.url ? (
                      <Pressable style={styles.p24PillBtn} onPress={() => Linking.openURL(item.url!)}>
                        <Text style={styles.p24PillText}>Property24</Text>
                        <Ionicons name="open-outline" size={11} color="#fff" />
                      </Pressable>
                    ) : null}
                  </View>
                </View>

                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.cardAddr} numberOfLines={1}>{item.address}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.metaText}>
                      {item.bedrooms} Bed · {item.bathrooms} Bath{item.sqm ? ` · ${item.sqm}m²` : ''}
                    </Text>
                    <Pressable
                      onPress={() => toggleCompare(item)}
                      style={[styles.compareBtn, inCompare && styles.compareBtnActive]}
                    >
                      <Text style={[styles.compareBtnText, inCompare && { color: '#065f46' }]}>
                        {inCompare ? '✓ In Compare' : '+ Compare'}
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* Area Selector Modal */}
      <Modal visible={areaModalOpen} animationType="slide" transparent onRequestClose={() => setAreaModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Cape Town Areas</Text>
              <Pressable onPress={() => setAreaModalOpen(false)}>
                <Ionicons name="close" size={22} color="#09090b" />
              </Pressable>
            </View>
            <TextInput
              value={areaQuery}
              onChangeText={setAreaQuery}
              placeholder="Search suburb or area group..."
              style={styles.searchInput}
            />
            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={styles.sectionLabel}>Area Presets</Text>
              {CAPE_TOWN_AREA_PRESETS.filter(
                (p) => !areaQuery.trim() || p.name.toLowerCase().includes(areaQuery.toLowerCase()) || p.suburbs.some((s) => s.toLowerCase().includes(areaQuery.toLowerCase()))
              ).map((preset) => (
                <Pressable
                  key={preset.id}
                  style={styles.presetRow}
                  onPress={() => {
                    setSelectedSuburbs(preset.suburbs);
                    setAreaModalOpen(false);
                  }}
                >
                  <Text style={styles.presetName}>{preset.name}</Text>
                  <Text style={styles.presetSubs}>{preset.suburbs.join(', ')}</Text>
                </Pressable>
              ))}
              <Text style={[styles.sectionLabel, { marginTop: 12 }]}>Jump to Suburb</Text>
              <View style={styles.chipWrap}>
                {CAPE_TOWN_SUBURBS.filter(
                  (s) => !areaQuery.trim() || s.toLowerCase().includes(areaQuery.toLowerCase())
                )
                  .slice(0, 15)
                  .map((sub) => (
                    <Pressable
                      key={sub}
                      style={styles.subChip}
                      onPress={() => {
                        setSelectedSuburbs([sub]);
                        setAreaModalOpen(false);
                      }}
                    >
                      <Text style={styles.subChipText}>{sub}</Text>
                    </Pressable>
                  ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* AI Analysis & Chat Modal */}
      <Modal visible={Boolean(aiProp)} animationType="slide" transparent onRequestClose={() => setAiProp(null)}>
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { maxHeight: '88%' }]}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle} numberOfLines={1}>AI Forensic Analysis</Text>
                <Text style={styles.cardAddr} numberOfLines={1}>{aiProp?.title} · {aiProp?.address}</Text>
              </View>
              <Pressable onPress={() => setAiProp(null)}>
                <Ionicons name="close" size={22} color="#09090b" />
              </Pressable>
            </View>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
              {isRunningAi ? (
                <View style={styles.centerBox}>
                  <ActivityIndicator size="small" color="#6d28d9" />
                  <Text style={styles.loadingText}>Inspecting photos & layout with Gemini...</Text>
                </View>
              ) : aiVision ? (
                <>
                  {aiVision.photo_story ? (
                    <View style={styles.aiBlock}>
                      <Text style={styles.aiHeading}>Photo & Spatial Read</Text>
                      <Text style={styles.aiText}>{aiVision.photo_story}</Text>
                    </View>
                  ) : null}
                  {aiVision.wfh_layout_verdict ? (
                    <View style={styles.aiBlock}>
                      <Text style={styles.aiHeading}>WFH & Desk Ergonomics</Text>
                      <Text style={styles.aiText}>{aiVision.wfh_layout_verdict}</Text>
                    </View>
                  ) : null}
                  {aiVision.wall_acoustic_audit ? (
                    <View style={styles.aiBlock}>
                      <Text style={styles.aiHeading}>Walls & Acoustics</Text>
                      <Text style={styles.aiText}>{aiVision.wall_acoustic_audit}</Text>
                    </View>
                  ) : null}
                  {aiVision.window_light_audit ? (
                    <View style={styles.aiBlock}>
                      <Text style={styles.aiHeading}>Windows & Daylight</Text>
                      <Text style={styles.aiText}>{aiVision.window_light_audit}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <Text style={styles.emptySub}>Could not generate vision audit right now.</Text>
              )}

              {/* Ask AI Follow-Up */}
              <View style={styles.aiBlock}>
                <Text style={styles.aiHeading}>Ask AI About This Property</Text>
                {chatMsgs.map((m, i) => (
                  <View
                    key={i}
                    style={[
                      styles.chatBubble,
                      m.role === 'user' ? styles.chatUser : styles.chatBot,
                    ]}
                  >
                    <Text style={m.role === 'user' ? styles.chatUserText : styles.aiText}>
                      {m.content}
                    </Text>
                  </View>
                ))}
                <View style={styles.chatInputRow}>
                  <TextInput
                    value={chatInput}
                    onChangeText={setChatInput}
                    placeholder="Ask about noise, sun, desk space..."
                    style={[styles.searchInput, { flex: 1, marginBottom: 0 }]}
                  />
                  <Pressable style={styles.sendBtn} onPress={sendChat} disabled={isSendingChat}>
                    {isSendingChat ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="send" size={16} color="#fff" />
                    )}
                  </Pressable>
                </View>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <ViewingModal
        visible={viewingOpen}
        initialProperty={viewingProp}
        onClose={() => setViewingOpen(false)}
      />

      {/* Proximity Anchor & Radius Modal */}
      <Modal
        visible={proximityModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setProximityModalOpen(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.modalTitle}>Proximity to Location</Text>
              <Pressable onPress={() => setProximityModalOpen(false)}>
                <Ionicons name="close" size={22} color="#18181b" />
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
              <TextInput
                value={placeSearch}
                onChangeText={(txt) => {
                  setPlaceSearch(txt);
                  if (!txt.trim()) setOsmResults([]);
                }}
                onSubmitEditing={() => searchFreeGeocode()}
                placeholder="Search any cafe, bar, park, or street (e.g. Sentinel Cafe)..."
                style={[styles.searchInput, { flex: 1, marginBottom: 0 }]}
              />
              <Pressable style={styles.scrapeBtn} onPress={() => searchFreeGeocode()} disabled={isSearchingPlace}>
                {isSearchingPlace ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="search" size={14} color="#fff" />
                )}
              </Pressable>
            </View>

            <Text style={styles.sectionLabel}>Radius</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {[0.3, 0.5, 1, 2, 5, 10, 19.5].map((km) => (
                <Pressable
                  key={km}
                  onPress={() => {
                    setProximityRadiusKm(km);
                    setCustomRadiusText(km < 1 ? String(Math.round(km * 1000)) : String(km));
                    setCustomRadiusUnit(km < 1 ? 'm' : 'km');
                  }}
                  style={[styles.pill, proximityRadiusKm === km && styles.pillActive]}
                >
                  <Text style={[styles.pillText, proximityRadiusKm === km && styles.pillTextActive]}>
                    ≤ {formatRadiusLabel(km)}
                  </Text>
                </Pressable>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
              <TextInput
                value={customRadiusText}
                onChangeText={setCustomRadiusText}
                keyboardType="numeric"
                placeholder="Custom radius (e.g. 300)"
                style={[styles.searchInput, { flex: 1, marginBottom: 0 }]}
              />
              {(['m', 'km'] as const).map((unit) => (
                <Pressable
                  key={unit}
                  onPress={() => setCustomRadiusUnit(unit)}
                  style={[styles.pill, customRadiusUnit === unit && styles.pillActive]}
                >
                  <Text style={[styles.pillText, customRadiusUnit === unit && styles.pillTextActive]}>
                    {unit}
                  </Text>
                </Pressable>
              ))}
              <Pressable
                style={styles.scrapeBtn}
                onPress={() => {
                  const val = parseFloat(customRadiusText);
                  if (!Number.isNaN(val) && val > 0) {
                    setProximityRadiusKm(customRadiusUnit === 'm' ? val / 1000 : val);
                  }
                }}
              >
                <Text style={styles.scrapeBtnText}>Set</Text>
              </Pressable>
            </View>

            <Pressable
              style={styles.scrapeBtn}
              onPress={async () => {
                try {
                  const perm = await Location.requestForegroundPermissionsAsync();
                  if (perm.status === 'granted') {
                    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    setProximityAnchor({
                      label: 'My GPS Location',
                      lat: pos.coords.latitude,
                      lng: pos.coords.longitude,
                    });
                    setInRadiusFilter(true);
                    setProximityModalOpen(false);
                  }
                } catch {}
              }}
            >
              <Ionicons name="locate" size={14} color="#fff" />
              <Text style={styles.scrapeBtnText}>Use My Current GPS Location</Text>
            </Pressable>

            {osmResults.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Free Map Search Results</Text>
                <ScrollView style={{ maxHeight: 130 }} contentContainerStyle={{ gap: 6 }}>
                  {osmResults.map((res, idx) => (
                    <Pressable
                      key={`${res.label}-${idx}`}
                      onPress={() => {
                        setProximityAnchor(res);
                        setInRadiusFilter(true);
                        setProximityModalOpen(false);
                      }}
                      style={[
                        styles.presetRow,
                        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
                      ]}
                    >
                      <Text style={styles.presetName} numberOfLines={1}>{res.label}</Text>
                      <Ionicons name="chevron-forward" size={16} color="#4f46e5" />
                    </Pressable>
                  ))}
                </ScrollView>
              </>
            )}

            <Text style={styles.sectionLabel}>Main Cape Town Places (Instant · $0)</Text>
            <ScrollView style={{ maxHeight: 200 }} contentContainerStyle={{ gap: 6 }}>
              {filteredPresets.map((preset) => {
                const active = proximityAnchor?.label === preset.label;
                return (
                  <Pressable
                    key={preset.label}
                    onPress={() => {
                      setProximityAnchor(preset);
                      setInRadiusFilter(true);
                      setProximityModalOpen(false);
                    }}
                    style={[
                      styles.presetRow,
                      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 0 },
                      active && { borderColor: '#4f46e5', backgroundColor: '#eef2ff' },
                    ]}
                  >
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.presetName} numberOfLines={1}>{preset.label}</Text>
                      <Text style={styles.presetSubs} numberOfLines={1}>{preset.kind} · {preset.area}</Text>
                    </View>
                    <Ionicons
                      name={active ? 'checkmark-circle' : 'chevron-forward'}
                      size={18}
                      color={active ? '#4f46e5' : '#a1a1aa'}
                    />
                  </Pressable>
                );
              })}
            </ScrollView>

            {proximityAnchor && (
              <Pressable
                style={[styles.saveAlertBtn, { justifyContent: 'center', paddingVertical: 10 }]}
                onPress={() => {
                  setProximityAnchor(null);
                  setInRadiusFilter(false);
                  setProximityModalOpen(false);
                }}
              >
                <Text style={styles.saveAlertText}>Clear Proximity Filter</Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f4f5' },
  topPanel: { backgroundColor: '#fff', paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: '#e4e4e7', gap: 8 },
  viewModeRow: { flexDirection: 'row', backgroundColor: '#f4f4f5', borderRadius: 10, padding: 3, gap: 4 },
  viewModeTab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 6, borderRadius: 8 },
  viewModeTabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, elevation: 1 },
  viewModeText: { fontSize: 12, fontWeight: '700', color: '#71717a' },
  viewModeTextActive: { color: '#4f46e5', fontWeight: '800' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  areaBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 },
  areaBtnText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#09090b' },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  saveAlertBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 },
  saveAlertText: { fontSize: 11, fontWeight: '800', color: '#18181b' },
  scrapeBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#4f46e5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  scrapeBtnText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  pillStrip: { gap: 6, paddingVertical: 2 },
  pill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7' },
  pillActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  pillActiveDark: { backgroundColor: '#18181b', borderColor: '#18181b' },
  pillText: { fontSize: 11, fontWeight: '700', color: '#3f3f46' },
  pillTextActive: { color: '#fff' },
  staleBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fcd34d', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, gap: 8 },
  staleText: { flex: 1, fontSize: 11, fontWeight: '600', color: '#78350f' },
  staleCta: { backgroundColor: '#d97706', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  staleCtaText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  statusBanner: { backgroundColor: '#eef2ff', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  statusBannerText: { fontSize: 11, fontWeight: '700', color: '#312e81' },
  listContent: { padding: 12, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#e4e4e7' },
  imageWrap: { height: 185, position: 'relative', backgroundColor: '#18181b' },
  cardImage: { width: '100%', height: '100%' },
  topOverlay: { position: 'absolute', top: 10, left: 10, flexDirection: 'row', gap: 6 },
  priceBadge: { backgroundColor: 'rgba(9,9,11,0.85)', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  priceText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  fitBadge: { backgroundColor: 'rgba(9,9,11,0.85)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  fitText: { color: '#34d399', fontSize: 11, fontWeight: '800' },
  topRightBtns: { position: 'absolute', top: 10, right: 10, flexDirection: 'row', gap: 6 },
  iconCircle: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(9,9,11,0.75)', alignItems: 'center', justifyContent: 'center' },
  rankBadge: { position: 'absolute', bottom: 10, left: 10, backgroundColor: 'rgba(9,9,11,0.85)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  rankText: { color: '#fff', fontSize: 11, fontWeight: '900' },
  bottomRightBtns: { position: 'absolute', bottom: 10, right: 10, flexDirection: 'row', gap: 6 },
  aiPillBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#6d28d9', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  aiPillText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  p24PillBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(9,9,11,0.9)', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  p24PillText: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  cardBody: { padding: 12, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#09090b' },
  cardAddr: { fontSize: 12, color: '#71717a' },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: '700', color: '#3f3f46' },
  compareBtn: { borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  compareBtnActive: { backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' },
  compareBtnText: { fontSize: 11, fontWeight: '800', color: '#18181b' },
  centerBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  loadingText: { fontSize: 12, fontWeight: '600', color: '#52525b' },
  emptyBox: { alignItems: 'center', padding: 36, gap: 8 },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#09090b' },
  emptySub: { fontSize: 12, color: '#71717a', textAlign: 'center' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,9,11,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 12 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#09090b' },
  searchInput: { backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13, color: '#09090b', marginBottom: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', color: '#71717a', marginBottom: 6 },
  presetRow: { padding: 10, borderRadius: 12, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7', marginBottom: 6 },
  presetName: { fontSize: 13, fontWeight: '800', color: '#09090b' },
  presetSubs: { fontSize: 11, color: '#71717a', marginTop: 2 },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  subChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  subChipText: { fontSize: 11, fontWeight: '700', color: '#3730a3' },
  aiBlock: { backgroundColor: '#f8fafc', borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#e2e8f0', gap: 4 },
  aiHeading: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', color: '#312e81' },
  aiText: { fontSize: 12.5, lineHeight: 18, color: '#27272a' },
  chatBubble: { padding: 10, borderRadius: 12, marginTop: 4 },
  chatUser: { backgroundColor: '#4f46e5', alignSelf: 'flex-end' },
  chatBot: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7' },
  chatUserText: { color: '#fff', fontSize: 12.5, fontWeight: '600' },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  sendBtn: { backgroundColor: '#4f46e5', borderRadius: 12, padding: 11, alignItems: 'center', justifyContent: 'center' },
});
