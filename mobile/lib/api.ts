import { Platform } from 'react-native';
import Constants from 'expo-constants';

export function getDefaultApiBaseUrl(): string {
  const envUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envUrl) return envUrl.replace(/\/$/, '');

  // In Expo Go over LAN/Hotspot, hostUri is "<pc-lan-ip>:8081".
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    if (host && !host.includes('exp.direct') && !host.includes('ngrok')) {
      return `http://${host}:8000`;
    }
  }

  if (Platform.OS === 'android') return 'http://10.0.2.2:8000';
  return 'http://127.0.0.1:8000';
}

export interface MobileProperty {
  id: string;
  p24_id?: string;
  title: string;
  address: string;
  suburb?: string;
  price: number;
  bedrooms: number;
  bathrooms: number;
  sqm?: number;
  image: string;
  images?: string[];
  url?: string;
  lat: number;
  lng: number;
  fit_score?: number;
  rank?: number;
  noise_risk?: string;
  is_main_road?: boolean;
  is_landlord_on_site?: boolean;
  is_address_withheld?: boolean;
  fibre_ready?: boolean;
  has_garage?: boolean;
  has_secure_bay?: boolean;
  pet_friendly?: boolean;
  stove_type?: string;
  price_value_pct?: number;
  description?: string;
  acoustic_audit?: { estimated_db?: number; facing_direction?: string };
}

export async function fetchLiveListings(
  baseUrl: string,
  params: {
    suburbs: string[];
    min_price: number;
    max_price: number;
    bedrooms: string;
    force_fresh?: boolean;
  }
) {
  const res = await fetch(`${baseUrl}/api/search/live-scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchGhostListings(baseUrl: string, suburbs: string[]) {
  const qs = new URLSearchParams({ suburbs: suburbs.join(',') });
  const res = await fetch(`${baseUrl}/api/listings/ghost?${qs.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function runForensicVision(
  baseUrl: string,
  prop: MobileProperty,
  personalPreferences: string
) {
  const res = await fetch(`${baseUrl}/api/listing/forensic-vision`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: prop.id,
      url: prop.url || '',
      title: prop.title,
      address: prop.address,
      price: prop.price || 0,
      bedrooms: prop.bedrooms || 1,
      bathrooms: prop.bathrooms || 1,
      sqm: prop.sqm || null,
      description: prop.description || '',
      images: prop.images?.length ? prop.images : prop.image ? [prop.image] : [],
      personal_preferences: personalPreferences,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function askListingChat(
  baseUrl: string,
  prop: MobileProperty,
  question: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
  personalPreferences: string
) {
  const res = await fetch(`${baseUrl}/api/listing/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property: prop,
      question,
      messages,
      personal_preferences: personalPreferences,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function runCompareAi(
  baseUrl: string,
  properties: MobileProperty[],
  personalPreferences: string
) {
  const res = await fetch(`${baseUrl}/api/properties/compare`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      properties,
      personal_preferences: personalPreferences,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchUserAlerts(baseUrl: string, uid = 'taun_test_user') {
  const res = await fetch(`${baseUrl}/searches/${encodeURIComponent(uid)}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveUserAlert(baseUrl: string, payload: Record<string, any>) {
  const res = await fetch(`${baseUrl}/save-alert`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function deleteUserAlert(baseUrl: string, uid: string, searchId: string) {
  const res = await fetch(`${baseUrl}/delete-alert/${encodeURIComponent(uid)}/${encodeURIComponent(searchId)}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function generateInspectionCriteria(
  baseUrl: string,
  propertyInput: string,
  propertyAddress: string
) {
  const res = await fetch(`${baseUrl}/api/inspections/generate-criteria`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      property_input: propertyInput,
      property_address: propertyAddress,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function analyzeInspectionPhoto(
  baseUrl: string,
  room: string,
  photoDataUrl: string,
  existingNotes = ''
) {
  const res = await fetch(`${baseUrl}/api/inspections/analyze-photo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      room,
      photo_data: photoDataUrl,
      existing_notes: existingNotes,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function authHeaders(idToken?: string | null, userId = 'local-dev-user'): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-User-Id': userId,
  };
  if (idToken) headers.Authorization = `Bearer ${idToken}`;
  return headers;
}

export async function fetchInspections(baseUrl: string, idToken?: string | null, userId = 'local-dev-user') {
  const res = await fetch(`${baseUrl}/api/inspections?user_id=${encodeURIComponent(userId)}`, {
    headers: authHeaders(idToken, userId),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveInspection(
  baseUrl: string,
  payload: Record<string, any>,
  idToken?: string | null,
  userId = 'local-dev-user'
) {
  const res = await fetch(`${baseUrl}/api/inspections`, {
    method: 'POST',
    headers: authHeaders(idToken, userId),
    body: JSON.stringify({ ...payload, user_id: userId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchPublicSnags(
  baseUrl: string,
  params: { property_id?: string; address?: string; suburb?: string }
) {
  const qs = new URLSearchParams();
  if (params.property_id) qs.set('property_id', params.property_id);
  if (params.address) qs.set('address', params.address);
  if (params.suburb) qs.set('suburb', params.suburb);
  const res = await fetch(`${baseUrl}/api/inspections/public-snags?${qs.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchWorkspace(baseUrl: string, idToken?: string | null, userId = 'local-dev-user') {
  const res = await fetch(`${baseUrl}/api/workspace`, {
    headers: authHeaders(idToken, userId),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function saveWorkspace(
  baseUrl: string,
  payload: { favourites: MobileProperty[]; compare_list: MobileProperty[]; hidden_ids: string[]; preferences: string },
  idToken?: string | null,
  userId = 'local-dev-user'
) {
  const res = await fetch(`${baseUrl}/api/workspace`, {
    method: 'PUT',
    headers: authHeaders(idToken, userId),
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchNearbyListings(
  baseUrl: string,
  params: { lat?: number; lng?: number; suburb?: string; q?: string }
) {
  const qs = new URLSearchParams();
  if (params.lat !== undefined) qs.set('lat', String(params.lat));
  if (params.lng !== undefined) qs.set('lng', String(params.lng));
  if (params.suburb) qs.set('suburb', params.suburb);
  if (params.q) qs.set('q', params.q);
  const res = await fetch(`${baseUrl}/api/listings/nearby?${qs.toString()}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function fetchListingComments(baseUrl: string, listingId: string, address = '') {
  const qs = address ? `?address=${encodeURIComponent(address)}` : '';
  const res = await fetch(`${baseUrl}/api/listings/${encodeURIComponent(listingId)}/comments${qs}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function postListingComment(
  baseUrl: string,
  listingId: string,
  payload: {
    user_id: string;
    body: string;
    floor_number?: string;
    unit_number?: string;
    address?: string;
    media?: Array<{ type: 'image' | 'video'; data?: string; url?: string; caption?: string }>;
    tags?: string[];
  }
) {
  const res = await fetch(`${baseUrl}/api/listings/${encodeURIComponent(listingId)}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function submitListingUnit(
  baseUrl: string,
  listingId: string,
  floorNumber: string,
  unitNumber: string
) {
  const res = await fetch(`${baseUrl}/api/listings/submit-unit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      listing_id: listingId,
      floor_number: floorNumber,
      unit_number: unitNumber,
    }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
