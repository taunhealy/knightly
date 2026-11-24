import type React from 'react';
import type { PropertyMapItem } from '@/components/PropertyMap';

export interface RawScrapeListing {
  id?: string;
  title: string;
  address: string;
  is_address_withheld?: boolean;
  suburb?: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqm?: number | null;
  image: string;
  lat: number;
  lng: number;
  fit_score?: number;
  noise_risk?: string;
  is_main_road?: boolean;
  stove_type?: string;
  has_garage?: boolean;
  has_secure_bay?: boolean;
  parking_type?: string;
  parking?: number;
  pet_friendly?: boolean;
  fibre_ready?: boolean;
  has_inverter?: boolean;
  dwelling_privacy?: string;
  is_landlord_on_site?: boolean;
  agency_name?: string;
  agency_rating?: number;
  agency_review_count?: number;
  agency_risk_level?: string;
  agency_flags?: string[];
  agency_complaint_sample?: string;
  agency_hellopeter_rating?: number;
  price_value_pct?: number | null;
  first_seen_at?: number | null;
  available_from?: string | null;
  is_security_estate?: boolean;
  estate_name?: string | null;
  url?: string;
  facing_direction?: string;
}

export function getRectifiedUrl(rawUrl: string): string {
  if (!rawUrl || rawUrl.includes('unsplash.com') || rawUrl.startsWith('data:')) return rawUrl;
  const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  return `${backendBase}/api/realview/rectify?url=${encodeURIComponent(rawUrl)}`;
}

export function resolveProperty24Url(prop: { id?: string; url?: string; address?: string; title?: string }): string {
  const raw = (prop.url || '').trim();
  if (raw && raw.startsWith('http')) return raw;
  if (raw && raw.startsWith('/')) return `https://www.property24.com${raw}`;
  const p24Match = (prop.id || '').match(/(\d{7,10})/);
  if (p24Match) {
    return `https://www.property24.com/to-rent/cape-town/western-cape/432/${p24Match[1]}`;
  }
  return 'https://www.property24.com/to-rent/cape-town/western-cape/432';
}

export function resolveGoogleMapsUrl(
  prop: { lat?: number | null; lng?: number | null; address?: string; title?: string } | null | undefined
): string {
  if (!prop) return 'https://www.google.com/maps';
  if (prop.lat && prop.lng) {
    return `https://www.google.com/maps/search/?api=1&query=${prop.lat},${prop.lng}`;
  }
  const cleanAddr = (prop.address || prop.title || 'Cape Town, South Africa').replace(/\s+/g, ' ').trim();
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddr)}`;
}

export function openProperty24Url(e: React.MouseEvent, url: string): void {
  e.stopPropagation();
  e.preventDefault();
  if (!url) return;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function doesPropMatchSuburbs(prop: PropertyMapItem, suburbsList: string[]): boolean {
  const subLower = String((prop as PropertyMapItem & { suburb?: string }).suburb || '').toLowerCase().trim();
  const addrLower = String(prop.address || '').toLowerCase();
  return suburbsList.some((s) => {
    const target = s.toLowerCase().trim();
    return Boolean(target) && (subLower === target || addrLower.includes(target));
  });
}

export function mapLiveScrapeItem(item: RawScrapeListing, idx: number): PropertyMapItem {
  return {
    id: item.id || `p24-${idx}`,
    title: item.title,
    address: item.address,
    is_address_withheld: Boolean(item.is_address_withheld),
    suburb: item.suburb,
    price: item.price,
    bedrooms: item.bedrooms,
    bathrooms: item.bathrooms,
    sqm: item.sqm ?? undefined,
    image: item.image,
    lat: item.lat,
    lng: item.lng,
    rank: idx + 1,
    fit_score: item.fit_score || 90,
    noise_risk: (item.noise_risk as PropertyMapItem['noise_risk']) || 'low',
    is_main_road: Boolean(item.is_main_road),
    stove_type: (item.stove_type as PropertyMapItem['stove_type']) || 'electric',
    has_garage: Boolean(item.has_garage),
    has_secure_bay: Boolean(item.has_secure_bay) || item.parking_type === 'secure_bay',
    parking_type: (item.parking_type as PropertyMapItem['parking_type']) || (item.has_garage ? 'garage' : (item.parking ?? 0) > 0 ? 'secure_bay' : 'none'),
    pet_friendly: Boolean(item.pet_friendly),
    fibre_ready: Boolean(item.fibre_ready),
    has_inverter: Boolean(item.has_inverter),
    dwelling_privacy: (item.dwelling_privacy as PropertyMapItem['dwelling_privacy']) || 'independent',
    is_landlord_on_site: Boolean(item.is_landlord_on_site),
    agency_name: item.agency_name,
    agency_rating: item.agency_rating,
    agency_review_count: item.agency_review_count,
    agency_risk_level: item.agency_risk_level as PropertyMapItem['agency_risk_level'],
    agency_flags: item.agency_flags,
    agency_complaint_sample: item.agency_complaint_sample,
    agency_hellopeter_rating: item.agency_hellopeter_rating,
    price_value_pct: typeof item.price_value_pct === 'number' ? item.price_value_pct : null,
    first_seen_at: item.first_seen_at ?? null,
    available_from: item.available_from ?? null,
    is_security_estate: Boolean(item.is_security_estate),
    estate_name: item.estate_name || null,
    url: item.url,
    acoustic_audit: {
      estimated_db: item.noise_risk === 'sanctuary' ? 34 : item.is_main_road ? 68 : 42,
      sound_shadow_status: item.noise_risk === 'sanctuary' ? 'Acoustic Sanctuary (Forest/Quiet Grove)' : 'Standard Residential Quiet',
      facing_direction: item.facing_direction || '',
    },
  } as PropertyMapItem;
}
