import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Ionicons } from '@expo/vector-icons';
import { fetchGhostListings, type MobileProperty } from '@/lib/api';
import { useHomeSeek } from '@/lib/store';
import {
  CAPE_TOWN_BUSY_ROADS,
  CAPE_TOWN_CRIME_HOTSPOTS,
  CAPE_TOWN_HOTSPOTS,
  CAPE_TOWN_SANCTUARIES,
} from '@/constants/capeTownGeo';

interface ProximityAnchorProp {
  label: string;
  lat: number;
  lng: number;
}

interface PropertyMapViewProps {
  listings: MobileProperty[];
  onOpenAi: (prop: MobileProperty) => void;
  onToggleCompare: (prop: MobileProperty) => void;
  compareIds: string[];
  proximityAnchor?: ProximityAnchorProp | null;
  proximityRadiusKm?: number;
}

export const PropertyMapView: React.FC<PropertyMapViewProps> = ({
  listings,
  onOpenAi,
  onToggleCompare,
  compareIds,
  proximityAnchor,
  proximityRadiusKm = 19.5,
}) => {
  const { apiBaseUrl } = useHomeSeek();
  const mappable = useMemo(
    () => listings.filter((p) => Number(p.lat) && Number(p.lng)),
    [listings]
  );
  const withheldCount = useMemo(
    () => listings.filter((p) => p.is_address_withheld).length,
    [listings]
  );

  const [selected, setSelected] = useState<MobileProperty | null>(mappable[0] || null);
  const [showCrime, setShowCrime] = useState(true);
  const [showBars, setShowBars] = useState(true);
  const [showTransit, setShowTransit] = useState(false);
  const [showRoads, setShowRoads] = useState(false);
  const [showParks, setShowParks] = useState(true);
  const [showGhost, setShowGhost] = useState(false);
  const [ghostPins, setGhostPins] = useState<any[]>([]);

  useEffect(() => {
    if (!selected && mappable.length > 0) setSelected(mappable[0]);
  }, [mappable, selected]);

  useEffect(() => {
    if (!showGhost || ghostPins.length > 0) return;
    const subs = Array.from(new Set(listings.map((p) => p.suburb).filter(Boolean) as string[]));
    fetchGhostListings(apiBaseUrl, subs.length > 0 ? subs : ['Hout Bay', 'Noordhoek'])
      .then((res) => setGhostPins(res?.listings || res?.ghosts || []))
      .catch(() => { });
  }, [showGhost, ghostPins.length, apiBaseUrl, listings]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const handler = (ev: MessageEvent) => {
      if (ev.data?.type === 'selectListing' && ev.data?.id) {
        const found = mappable.find((p) => p.id === ev.data.id);
        if (found) setSelected(found);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [mappable]);

  const mapHtml = useMemo(() => {
    const centerLat = mappable[0]?.lat || -34.04;
    const centerLng = mappable[0]?.lng || 18.35;

    const markersJson = JSON.stringify(
      mappable.slice(0, 80).map((p, idx) => ({
        id: p.id,
        lat: Number(p.lat),
        lng: Number(p.lng),
        rank: p.rank || idx + 1,
        price: `R ${(Number(p.price || 0) / 1000).toFixed(1)}k`,
        withheld: Boolean(p.is_address_withheld),
        selected: selected?.id === p.id,
      }))
    );

    const crimeJson = showCrime ? JSON.stringify(CAPE_TOWN_CRIME_HOTSPOTS) : '[]';
    const barsJson = showBars
      ? JSON.stringify(CAPE_TOWN_HOTSPOTS.filter((h) => h.type === 'nightlife'))
      : '[]';
    const transitJson = showTransit
      ? JSON.stringify(CAPE_TOWN_HOTSPOTS.filter((h) => h.type === 'transit' || h.type === 'highway'))
      : '[]';
    const roadsJson = showRoads ? JSON.stringify(CAPE_TOWN_BUSY_ROADS) : '[]';
    const parksJson = showParks ? JSON.stringify(CAPE_TOWN_SANCTUARIES) : '[]';
    const ghostJson = showGhost
      ? JSON.stringify(
        ghostPins
          .filter((g) => Number(g.lat) && Number(g.lng))
          .slice(0, 40)
          .map((g) => ({
            lat: Number(g.lat),
            lng: Number(g.lng),
            title: g.title || 'Past Listing',
            price: g.price ? `R ${Number(g.price).toLocaleString()}` : '',
          }))
      )
      : '[]';
    const anchorJson = proximityAnchor
      ? JSON.stringify({ ...proximityAnchor, radius_m: Math.round(proximityRadiusKm * 1000) })
      : 'null';

    return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    html, body, #map { margin: 0; padding: 0; width: 100%; height: 100%; font-family: system-ui, -apple-system, sans-serif; background: #e5e7eb; }
    .leaflet-bottom.leaflet-right { bottom: 56px !important; right: 4px !important; }
    .leaflet-control-attribution { display: none !important; }
    .pin-wrap {
      display: inline-flex; flex-direction: column; align-items: center;
      filter: drop-shadow(0 3px 6px rgba(0,0,0,0.32));
    }
    .pin {
      display: inline-flex; align-items: center; gap: 5px;
      background: #09090b; color: #ffffff; font-weight: 800; font-size: 11px;
      padding: 3px 8px 3px 4px; border-radius: 999px; border: 2px solid #ffffff;
      white-space: nowrap;
    }
    .pin.top { background: #09090b; border-color: #22c55e; }
    .pin.withheld { background: #fef3c7; color: #78350f; border-color: #f59e0b; }
    .pin.active { border-color: #6366f1; transform: scale(1.08); box-shadow: 0 0 0 3px rgba(99,102,241,0.45); }
    .pin-rank {
      display: inline-flex; align-items: center; justify-content: center;
      background: #27272a; color: #e4e4e7; font-size: 10px; font-weight: 900;
      padding: 1px 6px; border-radius: 999px;
    }
    .pin.top .pin-rank { background: #22c55e; color: #052e16; }
    .pin.withheld .pin-rank { background: #f59e0b; color: #ffffff; }
    .pin-tip {
      width: 0; height: 0; margin-top: -1px;
      border-left: 5px solid transparent; border-right: 5px solid transparent;
      border-top: 6px solid #09090b;
    }
    .pin-wrap.top .pin-tip { border-top-color: #22c55e; }
    .pin-wrap.withheld .pin-tip { border-top-color: #f59e0b; }
    .dot-badge {
      width: 20px; height: 20px; border-radius: 999px; display: flex; align-items: center; justify-content: center;
      color: #fff; font-size: 11px; font-weight: 900; border: 2px solid #fff; box-shadow: 0 2px 6px rgba(0,0,0,0.35);
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const markers = ${markersJson};
    const crimes = ${crimeJson};
    const bars = ${barsJson};
    const transits = ${transitJson};
    const roads = ${roadsJson};
    const parks = ${parksJson};
    const ghosts = ${ghostJson};
    const anchor = ${anchorJson};

    const map = L.map('map', { zoomControl: false }).setView([${centerLat}, ${centerLng}], 12);
    L.control.zoom({ position: 'bottomright' }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18,
      attribution: '© Esri · OpenStreetMap'
    }).addTo(map);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 18
    }).addTo(map);

    // 1. Crime Radar Zones
    crimes.forEach((c) => {
      const isHigh = String(c.risk_level || '').toLowerCase().includes('high');
      const col = isHigh ? '#dc2626' : '#d97706';
      L.circle([c.lat, c.lng], {
        radius: c.radius_m || 250,
        color: col, weight: 1, opacity: 0.45, fillColor: col, fillOpacity: 0.16
      }).bindPopup('<b>' + c.name + '</b><br/>' + c.risk_level + ': ' + c.incident_type).addTo(map);
      L.marker([c.lat, c.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="dot-badge" style="background:' + col + '">!</div>',
          iconSize: [20, 20], iconAnchor: [10, 10]
        })
      }).bindPopup('<b>' + c.name + '</b><br/>' + c.risk_level + ': ' + c.incident_type).addTo(map);
    });

    // 2. Bars & Nightlife Noise Zones (distinct magenta/purple from Crime red)
    bars.forEach((b) => {
      L.circle([b.lat, b.lng], {
        radius: b.radius_m || 160,
        color: '#a21caf', weight: 1.5, opacity: 0.55, fillColor: '#c026d3', fillOpacity: 0.14
      }).bindPopup('<b>' + (b.shortName || b.name) + '</b><br/>~' + b.base_db + ' dBA · ' + b.desc).addTo(map);
      L.marker([b.lat, b.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="dot-badge" style="background:#a21caf"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 22h8"/><path d="M12 11v11"/><path d="m19 3-7 8-7-8Z"/></svg></div>',
          iconSize: [20, 20], iconAnchor: [10, 10]
        })
      }).bindPopup('<b>' + (b.shortName || b.name) + '</b><br/>~' + b.base_db + ' dBA · ' + b.desc).addTo(map);
    });

    // 2b. Transit & Highway Hubs
    transits.forEach((t) => {
      L.circle([t.lat, t.lng], {
        radius: t.radius_m || 160,
        color: '#0369a1', weight: 1, opacity: 0.45, fillColor: '#0ea5e9', fillOpacity: 0.14
      }).bindPopup('<b>' + (t.shortName || t.name) + '</b><br/>~' + t.base_db + ' dBA · ' + t.desc).addTo(map);
    });

    // 3. Busy Road Corridors
    roads.forEach((r) => {
      if (Array.isArray(r.points) && r.points.length > 1) {
        L.polyline(r.points, { color: '#ef4444', weight: 4, opacity: 0.65, dashArray: '6 4' })
          .bindPopup('<b>' + r.name + '</b><br/>~' + r.base_db + ' dBA traffic').addTo(map);
      }
    });

    // 4. Parks & Sanctuaries
    parks.forEach((s) => {
      L.circle([s.lat, s.lng], {
        radius: s.radius_m || 280,
        color: '#15803d', weight: 1.5, opacity: 0.5, fillColor: '#22c55e', fillOpacity: 0.14
      }).bindPopup('<b>' + s.name + '</b><br/>Quiet Sanctuary Zone').addTo(map);
    });

    // 5. Ghost Past Listings
    ghosts.forEach((g) => {
      L.marker([g.lat, g.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="dot-badge" style="background:#7c3aed">G</div>',
          iconSize: [20, 20], iconAnchor: [10, 10]
        })
      }).bindPopup('<b>Ghost: ' + g.title + '</b><br/>' + g.price).addTo(map);
    });

    // 5b. Proximity Anchor & Radius Circle
    if (anchor) {
      L.circle([anchor.lat, anchor.lng], {
        radius: anchor.radius_m || 19500,
        color: '#4f46e5', weight: 2, dashArray: '6 4', opacity: 0.75, fillColor: '#6366f1', fillOpacity: 0.06
      }).addTo(map);
      L.marker([anchor.lat, anchor.lng], {
        icon: L.divIcon({
          className: '',
          html: '<div class="pin" style="background:#312e81;border-color:#c7d2fe;">◎ ' + anchor.label + '</div>',
          iconSize: [140, 26], iconAnchor: [70, 13]
        })
      }).bindPopup('<b>Proximity Anchor: ' + anchor.label + '</b><br/>Radius: ' + (anchor.radius_m / 1000).toFixed(1) + ' km').addTo(map);
    }

    // 6. Active Property Pins
    const bounds = [];
    markers.forEach((m) => {
      bounds.push([m.lat, m.lng]);
      const tierCls = m.rank === 1 ? 'top' : (m.withheld ? 'withheld' : '');
      const pinCls = ['pin', tierCls, m.selected ? 'active' : ''].filter(Boolean).join(' ');
      const wrapCls = ['pin-wrap', tierCls].filter(Boolean).join(' ');
      const icon = L.divIcon({
        className: '',
        html: '<div class="' + wrapCls + '"><div class="' + pinCls + '"><span class="pin-rank">#' + m.rank + '</span><span>' + (m.withheld ? '~' : '') + m.price + '</span></div><div class="pin-tip"></div></div>',
        iconSize: [94, 34], iconAnchor: [47, 34]
      });
      const mk = L.marker([m.lat, m.lng], { icon, zIndexOffset: m.selected ? 1000 : 100 }).addTo(map);
      mk.on('click', () => {
        const msg = JSON.stringify({ type: 'selectListing', id: m.id });
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(msg);
        } else if (window.parent) {
          window.parent.postMessage({ type: 'selectListing', id: m.id }, '*');
        }
      });
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 14 });
    }
  </script>
</body>
</html>`;
  }, [mappable, selected?.id, showCrime, showBars, showTransit, showRoads, showParks, showGhost, ghostPins, proximityAnchor, proximityRadiusKm]);

  const inCompare = selected ? compareIds.includes(selected.id) : false;

  const layers = [
    { key: 'crime', label: 'Crime', active: showCrime, toggle: () => setShowCrime((v) => !v), color: '#dc2626', icon: 'shield' as const },
    { key: 'bars', label: 'Bars', active: showBars, toggle: () => setShowBars((v) => !v), color: '#a21caf', icon: 'wine' as const },
    { key: 'transit', label: 'Transit', active: showTransit, toggle: () => setShowTransit((v) => !v), color: '#0369a1', icon: 'train-outline' as const },
    { key: 'roads', label: 'Roads', active: showRoads, toggle: () => setShowRoads((v) => !v), color: '#ea580c', icon: 'car' as const },
    { key: 'parks', label: 'Parks', active: showParks, toggle: () => setShowParks((v) => !v), color: '#15803d', icon: 'leaf' as const },
    { key: 'ghost', label: 'Ghost', active: showGhost, toggle: () => setShowGhost((v) => !v), color: '#7c3aed', icon: 'eye-outline' as const },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.mapWrap}>
        {Platform.OS === 'web' ? (
          <iframe
            srcDoc={mapHtml}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Knightly Property Map"
          />
        ) : (
          <WebView
            source={{ html: mapHtml }}
            style={{ flex: 1 }}
            onMessage={(e) => {
              try {
                const msg = JSON.parse(e.nativeEvent.data);
                if (msg?.type === 'selectListing' && msg?.id) {
                  const found = mappable.find((p) => p.id === msg.id);
                  if (found) setSelected(found);
                }
              } catch { }
            }}
          />
        )}

        {withheldCount > 0 && (
          <View style={styles.withheldBadge}>
            <Ionicons name="location-outline" size={12} color="#b45309" />
            <Text style={styles.withheldText}>No Street Address ({withheldCount})</Text>
          </View>
        )}

        {/* Floating Bottom Layers Slider */}
        <View style={styles.layersDockWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.layersScroll}
            contentContainerStyle={styles.layersDock}
          >
            <Text style={styles.layersLabel}>LAYERS</Text>
            {layers.map((l) => (
              <Pressable
                key={l.key}
                onPress={l.toggle}
                style={[
                  styles.layerBtn,
                  l.active ? { backgroundColor: l.color, borderColor: l.color } : styles.layerBtnOff,
                ]}
              >
                <Ionicons name={l.icon} size={13} color={l.active ? '#fff' : '#52525b'} />
                <Text style={[styles.layerBtnText, l.active && { color: '#fff' }]}>{l.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>

      {selected ? (
        <View style={styles.previewCard}>
          <View style={styles.row}>
            <Image
              source={{ uri: selected.image || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400' }}
              style={styles.thumb}
            />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.price}>R {Number(selected.price || 0).toLocaleString()}/mo</Text>
              <Text style={styles.title} numberOfLines={1}>{selected.title}</Text>
              <Text style={styles.addr} numberOfLines={1}>{selected.address}</Text>
            </View>
          </View>
          <View style={styles.actions}>
            <Pressable style={styles.aiBtn} onPress={() => onOpenAi(selected)}>
              <Ionicons name="sparkles" size={13} color="#fff" />
              <Text style={styles.btnText}>AI Analysis</Text>
            </Pressable>
            <Pressable
              style={[styles.compBtn, inCompare && styles.compBtnActive]}
              onPress={() => onToggleCompare(selected)}
            >
              <Text style={[styles.compText, inCompare && { color: '#fff' }]}>
                {inCompare ? 'In Compare ✓' : '+ Compare'}
              </Text>
            </Pressable>
            {selected.url ? (
              <Pressable style={styles.p24Btn} onPress={() => Linking.openURL(selected.url!)}>
                <Text style={styles.btnText}>P24</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  mapWrap: { flex: 1, backgroundColor: '#e4e4e7', position: 'relative' },
  withheldBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.94)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#fde68a',
  },
  withheldText: { fontSize: 10.5, fontWeight: '800', color: '#92400e' },
  layersDockWrap: {
    position: 'absolute',
    bottom: 10,
    left: 10,
    right: 10,
  },
  layersScroll: {
    maxWidth: '100%',
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#e4e4e7',
  },
  layersDock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  layersLabel: { fontSize: 10, fontWeight: '900', color: '#71717a', marginRight: 2 },
  layerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
  },
  layerBtnOff: { backgroundColor: '#f4f4f5', borderColor: '#e4e4e7' },
  layerBtnText: { fontSize: 11, fontWeight: '800', color: '#3f3f46' },
  previewCard: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e4e4e7',
    padding: 12,
    gap: 10,
  },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  thumb: { width: 58, height: 58, borderRadius: 10, backgroundColor: '#f4f4f5' },
  price: { fontSize: 13.5, fontWeight: '900', color: '#059669' },
  title: { fontSize: 13, fontWeight: '800', color: '#09090b' },
  addr: { fontSize: 11.5, color: '#71717a' },
  actions: { flexDirection: 'row', gap: 8 },
  aiBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#6d28d9', borderRadius: 10, paddingVertical: 8 },
  btnText: { color: '#fff', fontSize: 11.5, fontWeight: '800' },
  compBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 10, paddingVertical: 8, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  compBtnActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  compText: { fontSize: 11.5, fontWeight: '800', color: '#4338ca' },
  p24Btn: { paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b', borderRadius: 10 },
});
