-- HomeSeek Unified Postgres + PostGIS Production Schema
-- Consolidates SQLite (inspections.db, listings_db, community_db, workspace.db) and .p24_live_cache.json

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    normalized_address TEXT UNIQUE NOT NULL,
    display_address TEXT NOT NULL,
    suburb TEXT NOT NULL,
    location GEOGRAPHY(Point, 4326),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_location ON properties USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_properties_suburb ON properties (LOWER(suburb));

CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    p24_id TEXT,
    property_id TEXT REFERENCES properties(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    price INTEGER NOT NULL,
    bedrooms INTEGER DEFAULT 1,
    bathrooms INTEGER DEFAULT 1,
    sqm INTEGER,
    url TEXT,
    image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
    raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_listings_p24 ON listings (p24_id);
CREATE INDEX IF NOT EXISTS idx_listings_property ON listings (property_id);

CREATE TABLE IF NOT EXISTS ai_analyses (
    listing_id TEXT PRIMARY KEY,
    fit_score INTEGER,
    forensic_json JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at DOUBLE PRECISION NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE TABLE IF NOT EXISTS inspections (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    property_id TEXT NOT NULL DEFAULT '',
    property_address TEXT NOT NULL DEFAULT '',
    normalized_address TEXT NOT NULL DEFAULT '',
    suburb TEXT NOT NULL DEFAULT '',
    lat DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    lng DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    is_public_snags BOOLEAN NOT NULL DEFAULT FALSE,
    landlord_or_agent TEXT NOT NULL DEFAULT '',
    lease_start_date TEXT NOT NULL DEFAULT '',
    water_meter TEXT NOT NULL DEFAULT '',
    electricity_meter TEXT NOT NULL DEFAULT '',
    keys_notes TEXT NOT NULL DEFAULT '',
    items_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    updated_at DOUBLE PRECISION NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);

CREATE TABLE IF NOT EXISTS user_workspaces (
    user_id TEXT PRIMARY KEY,
    favourites_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    compare_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    hidden_ids_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    preferences TEXT NOT NULL DEFAULT '',
    updated_at DOUBLE PRECISION NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())
);
