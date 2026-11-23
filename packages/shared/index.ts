export interface PropertySummary {
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
  is_pet_friendly?: boolean;
  has_fibre?: boolean;
  has_parking?: boolean;
  ai_summary?: string;
  [key: string]: any;
}

export interface InspectionItem {
  id: string;
  room: string;
  status: 'defect' | 'ok' | 'note';
  notes: string;
  captured_at: string;
  photo_data: string;
}

export interface InspectionRecord {
  id?: string;
  user_id?: string;
  property_id?: string;
  property_address: string;
  suburb?: string;
  lat?: number;
  lng?: number;
  is_public_snags?: boolean;
  landlord_or_agent?: string;
  lease_start_date?: string;
  water_meter?: string;
  electricity_meter?: string;
  keys_notes?: string;
  items: InspectionItem[];
  updated_at?: number;
}

export interface PublicSnagReport {
  inspection_id: string;
  match_type: 'exact_property' | 'address_match' | 'area_ghost';
  property_address: string;
  suburb: string;
  updated_at: number;
  snags: Array<{
    room: string;
    status: string;
    notes: string;
    captured_at: string;
    photo_url?: string;
  }>;
}

export interface UserWorkspace {
  user_id: string;
  favourites: PropertySummary[];
  compare_list: PropertySummary[];
  hidden_ids: string[];
  preferences: string;
}
