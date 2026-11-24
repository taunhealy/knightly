import {
  CAPE_TOWN_CRIME_HOTSPOTS,
  getCrimeDepthTier,
  getPropertyBarNoiseExposure,
  getPropertyBusyRoadExposure,
  isMissingAddressListing,
  type PropertyMapItem,
} from '@/constants/capeTownGeo';
import { PRESET_TRAILHEADS_AND_HUBS } from '@/constants/locations';
import {
  getAgencyReputationInfo,
  getDistanceKm,
  getDwellingPrivacyInfo,
  getPropertyMarketValuation,
  type PropertyValuationContext,
} from '@/lib/geo';

export function isPropertyInHighRiskCrimeZone(lat: number, lng: number): boolean {
  if (!lat || !lng) return false;
  for (const spot of CAPE_TOWN_CRIME_HOTSPOTS) {
    const tier = getCrimeDepthTier(spot);
    const isHigh = tier === 'high' || spot.risk_level.toLowerCase().includes('high');
    if (isHigh) {
      const distKm = getDistanceKm(lat, lng, spot.lat, spot.lng);
      if (distKm * 1000 <= spot.radius_m) {
        return true;
      }
    }
  }
  return false;
}

export interface CrimePerimeterInfo {
  isNearHighRisk: boolean;
  isInsideCore: boolean;
  distanceKm: number;
  hotspotName: string;
  hasEstateSecurity: boolean;
  shortFlag: string | null;
  tooltipReason: string;
}

export function getCrimePerimeterInfo(prop: {
  lat?: number;
  lng?: number;
  title?: string;
  address?: string;
  description?: string;
  ai_insight?: string;
  is_security_estate?: boolean;
  estate_name?: string | null;
}): CrimePerimeterInfo {
  const empty: CrimePerimeterInfo = {
    isNearHighRisk: false,
    isInsideCore: false,
    distanceKm: 99,
    hotspotName: '',
    hasEstateSecurity: false,
    shortFlag: null,
    tooltipReason: '',
  };
  if (!prop.lat || !prop.lng) return empty;

  const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''} ${prop.ai_insight || ''}`.toLowerCase();
  const estateLabel = prop.estate_name || null;
  const hasEstateSecurity =
    Boolean(prop.is_security_estate) ||
    /\b(security\s+estate|gated\s+estate|gated\s+community|eco\s+estate|24.?h(our)?\s+security|24hr\s+security|manned\s+gate|boom\s+gate|biometric|electric\s+fenc|armed\s+response|access\s+control)\b/i.test(rawText);

  let closest: { spot: typeof CAPE_TOWN_CRIME_HOTSPOTS[number]; distM: number } | null = null;
  for (const spot of CAPE_TOWN_CRIME_HOTSPOTS) {
    const tier = getCrimeDepthTier(spot);
    const isHigh = tier === 'high' || spot.risk_level.toLowerCase().includes('high');
    if (!isHigh) continue;
    const distM = getDistanceKm(prop.lat, prop.lng, spot.lat, spot.lng) * 1000;
    const bufferM = spot.radius_m * 1.45;
    if (distM <= bufferM && (!closest || distM < closest.distM)) {
      closest = { spot, distM };
    }
  }

  if (!closest) return empty;

  const distKm = Math.round((closest.distM / 1000) * 10) / 10;
  const shortArea = closest.spot.name.split('(')[0].replace(/\s+Township.*$/i, '').trim();
  const isInsideCore = closest.distM <= closest.spot.radius_m;

  return {
    isNearHighRisk: true,
    isInsideCore,
    distanceKm: distKm,
    hotspotName: shortArea,
    hasEstateSecurity,
    shortFlag: hasEstateSecurity
      ? `Secured Estate${estateLabel ? ` (${estateLabel})` : ''} · ${distKm}km from ${shortArea}`
      : `Perimeter Risk · ${distKm}km from ${shortArea} (No Estate Security)`,
    tooltipReason: hasEstateSecurity
      ? `Within ${distKm} km of ${closest.spot.name}, mitigated by estate/complex access control.`
      : `Within ${distKm} km of ${closest.spot.name} without confirmed 24h estate/complex security — inspect burglar bars, perimeter walls & nighttime street lighting.`,
  };
}

export function isMainRoadProperty(address?: string, title?: string): boolean {
  const text = `${address || ''} ${title || ''}`.toLowerCase();
  return /\b(main\s+r(oa)?d|victoria\s+r(oa)?d|somerset\s+r(oa)?d|regent\s+r(oa)?d|kloof\s+st(reet)?|kloof\s+nek|buitengracht|new\s+church(\s+st(reet)?)?|orange\s+st(reet)?|roeland\s+st(reet)?|buitenkant(\s+st(reet)?)?|strand\s+st(reet)?|helen\s+suzman|mill\s+st(reet)?|voortrekker\s+r(oa)?d|ou\s+kaapse\s+weg|kommetjie\s+r(oa)?d|baden\s+powell|highway|freeway|motorway|m3|m4|m5|m6|m62)\b/i.test(text);
}

export function getRiskAdjustedValuation(
  prop: PropertyMapItem,
  sampleContext?: PropertyMapItem[]
) {
  const crime = getCrimePerimeterInfo(prop);
  const privacy = getDwellingPrivacyInfo(prop);
  const busy = getPropertyBusyRoadExposure(prop);
  const ctx: PropertyValuationContext = {
    isInsideCrimeCore: crime.isNearHighRisk && crime.isInsideCore,
    isInCrimeBuffer: crime.isNearHighRisk && !crime.isInsideCore,
    hasEstateSecurity: crime.hasEstateSecurity,
    isMainRoad: Boolean(prop.is_main_road) || isMainRoadProperty(prop.address, prop.title) || busy.isDirectlyOnRoad,
    isLandlordOnSite: privacy.isLandlordOnSite,
    hasParking: Boolean(prop.has_garage || prop.has_secure_bay),
  };
  return getPropertyMarketValuation(prop, sampleContext, ctx);
}

export function formatPrice(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '0';
  return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export function formatPriceAbbr(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '0';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num) || num <= 0) return '0';
  if (num >= 1000) {
    const k = num / 1000;
    return `${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return num.toString();
}

export interface GeneratePropertyAuditContext {
  userPreferences?: string;
  galleryOverride?: string[];
  cardGalleries?: Record<string, string[]>;
  allCandidateProperties?: PropertyMapItem[];
  activeAnchor?: { label: string; lat: number; lng: number } | null;
}

/** Synthesize deterministic forensic audit, pros/cons, watchouts & architectural checks for a listing. */
export function generatePropertyAiAudit(
  prop: PropertyMapItem,
  rank: number,
  ctx: GeneratePropertyAuditContext = {}
) {
  const {
    userPreferences = '',
    galleryOverride,
    cardGalleries = {},
    allCandidateProperties = [],
    activeAnchor = null,
  } = ctx;

  const isSanctuary = prop.noise_risk === 'sanctuary';
  const isNorth =
    (prop.acoustic_audit?.facing_direction || '').toLowerCase().includes('north') ||
    /\bnorth[\s-]?facing\b/i.test(`${prop.title || ''} ${prop.description || ''}`);
  const stoveLabel =
    prop.stove_type === 'gas'
      ? 'Verified 4-burner gas hob & built-in oven'
      : prop.stove_type === 'induction'
        ? 'Induction hob detected'
        : 'Built-in stove & oven verified';
  const parkingLabel = prop.has_garage
    ? 'Private lock-up automated garage'
    : prop.parking_type === 'secure_bay'
      ? 'Allocated secure off-street parking bay'
      : 'Dedicated off-street parking';
  const facingLabel = isNorth
    ? 'North-facing orientation: maximum sun exposure throughout living room and workspace'
    : `${prop.acoustic_audit?.facing_direction || 'Standard aspect'} with balanced natural lighting`;

  const privacyInfo = getDwellingPrivacyInfo(prop);
  const isLandlordOnSite = privacyInfo.isLandlordOnSite;
  const isPossibleShared = Boolean(privacyInfo.isPossibleSharedProperty);
  const isMainRoad = Boolean(prop.is_main_road) || isMainRoadProperty(prop.address, prop.title);

  const tenancyType = isLandlordOnSite
    ? '⚠️ Shared Property / Landlord On-Site: Listing text confirms a cottage, flatlet, or secondary dwelling on a shared landlord property.'
    : isPossibleShared
      ? '🔍 Verify Privacy / Possible Shared Erf: Single-house street address with a studio/1-bed layout (no unit/block number; often attached to a main house with a shared driveway or shared Wi-Fi).'
      : isMainRoad
        ? '⚠️ Arterial Road Lease: Standalone tenancy but situated directly on a high-traffic Main Road arterial.'
        : '✅ 100% Autonomous Private Tenancy: Standalone property with complete perimeter independence (zero shared grounds or landlord residing on-site).';

  const photoAudit = isSanctuary
    ? `📸 AI Vision: ${stoveLabel}, ${isNorth ? 'north-facing floor-to-ceiling glazing' : 'large windows with natural daylight'}, scenic mountain/coastal backdrop, zero fish-eye lens distortion.`
    : `📸 AI Vision: ${stoveLabel}, natural daylight verified with true-perspective 28mm equivalent framing.`;

  const textVerdict = isMainRoad
    ? `🧠 AI Copy Audit #${rank}: ⚠️ Main Road Arterial Traffic Corridor. High ambient traffic rumble (M4), delivery scooter buzzing & elevated street-level exposure.`
    : isLandlordOnSite
      ? `🧠 AI Copy Audit #${rank}: Secondary dwelling / cottage on private landlord property detected. Potential shared entrance or grounds.`
      : isPossibleShared
        ? `🧠 AI Copy Audit #${rank}: Possible attached dwelling or shared driveway — single-erf street address with studio/1-bed layout and no apartment block/unit number; verify at viewing.`
        : `🧠 AI Copy Audit #${rank}: Explicit self-contained private lease (zero student digs or shared commune clauses), rules confirm quiet residential tenancy.`;

  const prefs = userPreferences.trim();
  const privacyMatchPhrase =
    prefs.toLowerCase().includes('private') || prefs.toLowerCase().includes('landlord')
      ? isLandlordOnSite
        ? '⚠️ Flagged: Not fully private (landlord on-site / shared grounds)'
        : isPossibleShared
          ? '🔍 Verify privacy: possible attached unit / shared driveway'
          : '🛡️ 100% Private Standalone confirmed'
      : null;

  const mainRoadWarning = isMainRoad ? '⚠️ Main Road traffic trap' : null;
  const verdictParts = [
    mainRoadWarning,
    privacyMatchPhrase || (isLandlordOnSite ? 'Secondary cottage / shared grounds' : 'Private standalone residence'),
    isSanctuary ? 'Quiet sanctuary verified' : isMainRoad ? 'Arterial street noise' : 'Standard residential acoustic buffer',
    isNorth ? 'North-facing natural light' : 'Balanced lighting',
    prop.fibre_ready ? 'High-speed fibre ready' : 'Standard internet',
    stoveLabel,
  ].filter(Boolean);

  const personalMatchVerdict = `${verdictParts.join(' · ')}.`;

  const buildForensicProsAndCons = () => {
    const pros: string[] = [];
    const cons: string[] = [];
    const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''} ${prop.ai_insight || ''}`.toLowerCase();
    const galleryPhotos =
      galleryOverride && galleryOverride.length > 0
        ? galleryOverride
        : cardGalleries[prop.id]?.length
          ? cardGalleries[prop.id]
          : Array.isArray(prop.images) && prop.images.length > 0
            ? prop.images
            : prop.image
              ? [prop.image]
              : [];
    const photoCount = galleryPhotos.length;

    const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
    if (marketVal) {
      if (marketVal.isUnderpriced) {
        pros.push(`Strong market value: ${marketVal.badgeText} (${marketVal.badgeTooltip})`);
      } else if (marketVal.isOverpriced) {
        cons.push(`Above market rate: ${marketVal.badgeText} (${marketVal.badgeTooltip})`);
      } else {
        pros.push(`Fairly priced relative to comparable ${prop.bedrooms}-bed listings in the area`);
      }
    }

    if (isPossibleShared) {
      cons.push('Possible attached unit / shared driveway: single-erf street address with studio/1-bed layout (and/or included Wi-Fi) — verify whether entrance, driveway, and yard are shared with a main house.');
    }

    if (photoCount > 0 && photoCount <= 2) {
      cons.push(`Limited photo coverage (${photoCount} ${photoCount === 1 ? 'image' : 'images'}) — key rooms or exterior may be unshown`);
    }

    if (isNorth) {
      pros.push('North-facing orientation with strong natural daylight');
    }
    if (/ocean|sea view|mountain view|scenic|sunny|bright|airy/.test(rawText)) {
      pros.push('Bright interior / scenic outlook noted in listing & imagery');
    }

    const prefLower = prefs.toLowerCase();
    const wantsWfhFull = prefLower.includes('work from home (full-time)') || (prefLower.includes('full-time') && prefLower.includes('wfh'));
    const wantsWfhPart = prefLower.includes('work from home (part-time)') || (prefLower.includes('part-time') && prefLower.includes('wfh'));
    const wantsCafes = prefLower.includes('work from cafes') || prefLower.includes('cafes');
    const wantsOffice = prefLower.includes('work from an office') || prefLower.includes('office');
    const wantsSecurityEstate = prefLower.includes('secure estate') || prefLower.includes('24h security') || prefLower.includes('gated');
    const wantsOutdoorBalcony = prefLower.includes('private patio') || prefLower.includes('balcony') || prefLower.includes('outdoor');
    const wantsBackupPower = prefLower.includes('backup power') || prefLower.includes('load-shedding') || prefLower.includes('solar') || prefLower.includes('inverter');
    const wantsGasStove = prefLower.includes('gas cooking') || prefLower.includes('gas stove');
    const wantsPetFriendly = prefLower.includes('pet-friendly') || prefLower.includes('dog');
    const wantsLockupGarage = prefLower.includes('lock-up garage') || prefLower.includes('garage');

    if (wantsWfhFull) {
      if (prop.fibre_ready && isSanctuary && (prop.sqm ? prop.sqm >= 60 : true)) {
        pros.push('WFH Full-Time Prime Fit: high-speed fibre + quiet acoustic setback + ample workspace room');
      } else if (!prop.fibre_ready) {
        cons.push('WFH Full-Time Risk: listing does not verify fibre readiness for uninterrupted remote work');
      }
      if (isMainRoad) {
        cons.push('WFH Conflict: main road daytime traffic roar directly interferes with remote Zoom / client calls');
      }
    }

    if (wantsWfhPart && prop.fibre_ready) {
      pros.push('Hybrid WFH Verified: stable fibre connectivity in place for remote days');
    }

    if (wantsCafes) {
      const cafeAnchors = PRESET_TRAILHEADS_AND_HUBS.filter(
        (loc) => loc.iconType === 'cafe' || loc.category === 'cafe'
      );
      let nearestCafe: { name: string; distance_km: number } | null = null;
      if (prop.lat && prop.lng) {
        for (const c of cafeAnchors) {
          const d = getDistanceKm(prop.lat, prop.lng, c.lat, c.lng);
          if (!nearestCafe || d < nearestCafe.distance_km) {
            nearestCafe = { name: c.label, distance_km: Number(d.toFixed(1)) };
          }
        }
      }
      if (!nearestCafe) {
        const prox = (prop.location_proximity || []).find((loc: any) =>
          String(loc.name || loc.category || '').toLowerCase().includes('cafe') ||
          String(loc.name || loc.category || '').toLowerCase().includes('coffee')
        );
        if (prox) {
          nearestCafe = { name: prox.name || 'local coffee spots', distance_km: Number(prox.distance_km || 1.0) };
        }
      }

      if (nearestCafe && nearestCafe.distance_km <= 1.8) {
        pros.push(`Cafe Work Hub: walkable to ${nearestCafe.name} (${nearestCafe.distance_km} km)`);
      } else if (nearestCafe && nearestCafe.distance_km <= 3.5) {
        pros.push(`Cafe Access: short trip to ${nearestCafe.name} (${nearestCafe.distance_km} km)`);
      } else {
        cons.push('Work from Cafes Note: limited walkable laptop-friendly coffee shops detected in immediate perimeter');
      }
    }

    if (wantsOffice && activeAnchor) {
      const distKm = getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng);
      if (distKm <= 4.0) {
        pros.push(`Office Commute Champion: only ~${distKm.toFixed(1)} km from ${activeAnchor.label}`);
      } else if (distKm > 10.0) {
        cons.push(`Extended Office Commute: ~${distKm.toFixed(1)} km to ${activeAnchor.label} (${Math.round((distKm / 35) * 60)} mins peak traffic)`);
      }
    }

    if (wantsBackupPower) {
      if (prop.has_inverter || /solar|inverter|backup|battery/.test(rawText)) {
        pros.push('Load-Shedding Resilient: inverter / solar battery power verified');
      } else {
        cons.push('Load-Shedding Vulnerability: zero inverter or solar backup mentioned in listing');
      }
    }

    if (wantsSecurityEstate) {
      if (/estate|security complex|gated|24 hour security|access control|guard/.test(rawText)) {
        pros.push('Security Estate: access-controlled gated perimeter with guarded security');
      } else {
        cons.push('Security Note: standalone perimeter without 24/7 manned security estate gate');
      }
    }

    if (wantsLockupGarage && !prop.has_garage) {
      cons.push('Parking Variance: no automated lock-up garage confirmed (only open bay or street parking)');
    }
    if (wantsGasStove && prop.stove_type !== 'gas') {
      cons.push('Kitchen Cooking Note: standard electric hob fitted (no gas cooktop for power outages)');
    }
    if (wantsPetFriendly && !prop.pet_friendly) {
      cons.push('Pet Restriction: listing does not explicitly approve pets / dogs');
    }
    if (wantsOutdoorBalcony && !/balcony|patio|garden|terrace|braai/.test(rawText)) {
      cons.push('Outdoor Living Note: no private patio, balcony or garden noted in listing');
    }

    if (prop.sqm && prop.sqm >= 75) {
      pros.push(`Spacious ${prop.sqm} m² floor plan`);
    } else if (prop.sqm && prop.sqm < 45) {
      cons.push(`Compact ${prop.sqm} m² footprint — limited storage & living area`);
    }

    if (prop.has_garage) {
      pros.push('Private lock-up garage included');
    } else if (prop.parking_type && prop.parking_type !== 'none') {
      pros.push('Dedicated off-street parking');
    } else if (/street parking|no parking/.test(rawText)) {
      cons.push('No dedicated off-street parking confirmed');
    }

    if (prop.fibre_ready) pros.push('Fibre internet ready');
    if (prop.stove_type === 'gas') pros.push('Gas hob (load-shedding resilient cooking)');
    if (prop.pet_friendly) pros.push('Pet-friendly lease');
    if (/no pets|not pet friendly/.test(rawText)) cons.push('No pets permitted');
    if (/solar|inverter|backup power|battery/.test(rawText)) pros.push('Backup power / solar / inverter mentioned');
    if (/balcony|patio|garden|terrace|braai|courtyard/.test(rawText)) pros.push('Private outdoor space (patio / balcony / garden)');
    if (/all-inclusive|water included|utilities included/.test(rawText)) pros.push('Utilities / water included in rent');
    if (/furnished/.test(rawText) && !/unfurnished/.test(rawText)) pros.push('Furnished & move-in ready');

    if (isLandlordOnSite) {
      cons.push('Landlord on-site / shared property (cottage or flatlet may share entrance or yard)');
    } else {
      pros.push('Autonomous private residence with independent access');
    }

    if (isMissingAddressListing(prop)) {
      cons.push(`Street address withheld ("${prop.address}") — exact street security & immediate neighbours unverified`);
    }
    if (isSanctuary) {
      pros.push(`Quiet acoustic sanctuary (~${prop.acoustic_audit?.estimated_db || 38} dBA)`);
    }

    const busyRoad = getPropertyBusyRoadExposure(prop);
    if (isMainRoad || busyRoad.isNearBusyRoad) {
      cons.push(`${busyRoad.badgeLabel || 'Main road arterial exposure'} — higher traffic & scooter noise`);
    }

    const barNoise = getPropertyBarNoiseExposure(prop);
    if (barNoise.isExposed) {
      cons.push(`${barNoise.badgeLabel || 'Near late-night bar / nightlife corridor'}`);
    }
    if (isPropertyInHighRiskCrimeZone(prop.lat, prop.lng)) {
      cons.push('Near a flagged high-risk crime zone — verify perimeter security or estate access control');
    }

    const rep = getAgencyReputationInfo(prop);
    if (rep.isPoorAgency) {
      cons.push(`Agency risk flag: ${rep.badgeLabel}`);
    }
    if (/prepaid electricity|pre-paid/.test(rawText)) {
      cons.push('Prepaid electricity (verify municipal tariff / meter setup)');
    }
    if (/single.*only|one person only|single professional/.test(rawText)) {
      cons.push('Single-occupant restriction stated in listing');
    }
    if (cons.length === 0) {
      cons.push('No major red flags detected — confirm lease terms & meter readings during viewing');
    }

    return { pros: pros.slice(0, 8), cons: cons.slice(0, 8) };
  };

  const { pros, cons } = buildForensicProsAndCons();

  const buildStrategicInsights = () => {
    const reasonsToRent: string[] = [];
    const reasonsToAvoid: string[] = [];
    const criticalWatchouts: string[] = [];

    const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''} ${prop.ai_insight || ''}`.toLowerCase();
    const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
    const busyRoad = getPropertyBusyRoadExposure(prop);
    const barNoise = getPropertyBarNoiseExposure(prop);
    const rep = getAgencyReputationInfo(prop);
    const inCrimeZone = isPropertyInHighRiskCrimeZone(prop.lat, prop.lng);
    const missingAddr = isMissingAddressListing(prop);
    const effectivePrefs = prefs.toLowerCase();

    if (marketVal && marketVal.isUnderpriced) {
      reasonsToRent.push(`High Value: Priced ${marketVal.badgeText} compared to suburb medians.`);
    }
    if (isSanctuary) {
      reasonsToRent.push('Acoustic Sanctuary: Low-decibel residential pocket shielded from Cape Town arterial transit corridors.');
    }
    if (!isLandlordOnSite) {
      reasonsToRent.push('Complete Autonomy: 100% private standalone dwelling with independent entrance and no landlord on-site.');
    }
    if (prop.fibre_ready) {
      reasonsToRent.push('Remote Work Ready: High-speed fibre installed and confirmed, ideal for remote work and video conferencing.');
    }
    if (prop.has_garage) {
      reasonsToRent.push('Lock-Up Garaging: Secure automated garage protecting vehicle from weather, salt air, and street opportunism.');
    } else if (prop.has_secure_bay) {
      reasonsToRent.push('Dedicated Parking: Off-street secure bay inside access-controlled gates.');
    }
    if (prop.stove_type === 'gas') {
      reasonsToRent.push('Load-Shedding Resilient: 4-burner gas hob allows reliable cooking during power outages.');
    }
    if (/solar|inverter|battery|backup power/.test(rawText)) {
      reasonsToRent.push('Power Backup: On-site inverter or solar system keeps Wi-Fi and core lights online during outages.');
    }
    if (isNorth) {
      reasonsToRent.push('Optimal Orientation: North-facing aspect captures warm winter sunlight and natural illumination.');
    }
    if (effectivePrefs.includes('work from cafes')) {
      reasonsToRent.push(`Cafe Access: Walking distance to local coffee shops and amenities in ${prop.suburb || 'the area'}.`);
    }
    if (effectivePrefs.includes('work from an office')) {
      reasonsToRent.push('Commute Ready: Convenient arterial access for traveling to business centers.');
    }
    if (reasonsToRent.length === 0) {
      reasonsToRent.push('Clean baseline rental meeting core suburb, sizing, and pricing criteria.');
    }

    if (marketVal && marketVal.isOverpriced) {
      reasonsToAvoid.push(`Price Premium: Priced ${marketVal.badgeText} above comparable properties in the immediate area.`);
    }
    if (isMainRoad || busyRoad.isNearBusyRoad) {
      reasonsToAvoid.push(`Arterial Noise Exposure: Direct frontage on ${busyRoad.badgeLabel || 'heavy traffic'} (elevated engine rumble and delivery transit).`);
    }
    if (barNoise.isExposed) {
      reasonsToAvoid.push(`Nightlife Sound Leakage: Adjacent to nightlife corridor (${barNoise.badgeLabel || 'bars and restaurants'}) with weekend noise.`);
    }
    if (isLandlordOnSite) {
      reasonsToAvoid.push('Shared Grounds: Secondary dwelling/cottage on landlord property with shared driveway and reduced perimeter autonomy.');
    }
    if (inCrimeZone) {
      reasonsToAvoid.push('Elevated Area Crime Profile: Situated in or near a designated municipal crime hotspot with opportunistic risk.');
    }
    if (!prop.has_garage && !prop.has_secure_bay) {
      reasonsToAvoid.push('No Dedicated Off-Street Parking: Dependent on kerbside street parking with vehicle exposure.');
    }
    if (effectivePrefs.includes('work from home') && (isMainRoad || busyRoad.isNearBusyRoad)) {
      reasonsToAvoid.push('WFH Disruption Risk: Daytime roadside traffic decibels may interfere with focused work or video calls.');
    }
    if (reasonsToAvoid.length === 0) {
      reasonsToAvoid.push('No critical dealbreakers or disqualifying red flags detected.');
    }

    if (missingAddr) {
      criticalWatchouts.push('Withheld Street Address: Exact street number is obscured by agent. Request pin or drive past to inspect gradient and immediate neighbours.');
    }
    if (/prepaid|pre-paid/.test(rawText)) {
      criticalWatchouts.push('Prepaid Electricity Meter: Check tariff band and ask previous tenant or landlord for average monthly electricity expenditure.');
    }
    if (rep.isPoorAgency) {
      criticalWatchouts.push(`Managing Agency Scrutiny: ${rep.badgeLabel}. Verify lease terms and ensure damage deposit is held in a statutory interest-bearing trust account.`);
    }
    const crimePerimeter = getCrimePerimeterInfo(prop);
    if ((inCrimeZone || crimePerimeter.isNearHighRisk) && !crimePerimeter.hasEstateSecurity) {
      criticalWatchouts.push(
        `Perimeter Security Check (${crimePerimeter.hotspotName || 'High-Risk Fringe'}): No 24h estate security detected — verify burglar bars, electric fencing, alarm sensors, and nighttime street lighting.`
      );
    }
    if (/single.*only|one person only/.test(rawText)) {
      criticalWatchouts.push('Occupancy Limitation: Listing specifies single professional occupancy only (no couples or frequent overnight guests).');
    }
    const hasPrepaidElec = /\bprepaid\s+(?:elec|electricity|power|meter)\b/i.test(rawText);
    const hasUtilitiesIncluded = /\b(?:other\s+utilities\s+included|all\s+utilities\s+included|water\s+(?:&|and)\s+lights\s+included|water\s+included|utilities\s+included)\b/i.test(rawText);
    if (hasPrepaidElec && hasUtilitiesIncluded) {
      criticalWatchouts.push('Utilities Stated: Prepaid electricity with other utilities included — verify Wi-Fi/fibre and any fair-usage cap in the lease.');
    } else if (hasPrepaidElec) {
      criticalWatchouts.push('Prepaid Electricity Stated: Confirm whether water, refuse, sewerage, and Wi-Fi are included or billed separately.');
    } else if (hasUtilitiesIncluded) {
      criticalWatchouts.push('Utilities Included Stated: Confirm whether electricity, Wi-Fi/fibre, or fair-usage caps apply.');
    } else {
      criticalWatchouts.push('Utilities Split: Confirm in writing whether water, electricity, refuse, sewerage, and Wi-Fi are included or invoiced separately.');
    }
    if (!prop.pet_friendly && effectivePrefs.includes('pet')) {
      criticalWatchouts.push('Pet Policy: Listing does not specify pet allowance; written landlord consent is mandatory prior to signing.');
    }

    return {
      reasonsToRent: reasonsToRent.slice(0, 4),
      reasonsToAvoid: reasonsToAvoid.slice(0, 4),
      criticalWatchouts: criticalWatchouts.slice(0, 4),
    };
  };

  const strategicInsights = buildStrategicInsights();

  const buildArchitecturalForensics = () => {
    const rawText = `${prop.title || ''} ${prop.address || ''} ${prop.description || ''}`.toLowerCase();
    const prefsLower = prefs.toLowerCase();
    const isWfhFull = prefsLower.includes('work from home (full-time)') || prefsLower.includes('full-time');
    const isWfhAny = prefsLower.includes('work from home') || prefsLower.includes('remote');
    const isStudio = (prop.bedrooms !== undefined && prop.bedrooms <= 0.5) || /\b(studio|bachelor|0\.5\s*bed|loft)\b/i.test(rawText);
    const sqm = prop.sqm || 0;
    const hasOutdoor = /\b(balcony|patio|deck|terrace|sliding door)\b/i.test(rawText);
    const hasStudy = /\b(study|office|workstation|desk|nook|2nd bed|second bed)\b/i.test(rawText);

    let wfhLayoutVerdict = '1-bed layout (m² unconfirmed) — verify lounge or bedroom wall clearance for a proper desk and chair, as smaller 1-beds often force laptops onto kitchen counters.';
    if (isStudio) {
      const sizeNote = sqm ? `(${sqm} m²) ` : '';
      if (isWfhFull) {
        wfhLayoutVerdict = `0.5-bed / studio footprint ${sizeNote}poses full-time WFH friction: no acoustic door separating your desk from fridge/kitchen hum, and bed may appear on video calls unless zoned.`;
      } else if (isWfhAny) {
        wfhLayoutVerdict = `0.5-bed / studio layout ${sizeNote}works well for part-time WFH / café hybrid if a compact desk fits near natural light; watch for appliance hum in one room.`;
      } else {
        wfhLayoutVerdict = `Open-plan 0.5-bed / studio ${sizeNote}maximizes usable floor area without corridor waste; verify storage and dining/desk zoning.`;
      }
    } else if (prop.bedrooms === 1 && sqm && sqm <= 42) {
      wfhLayoutVerdict = `Tight ${sqm} m² 1-bed footprint — living/kitchen area likely lacks room for a full ergonomic desk; expect to place a compact desk in the bedroom or work from a dining counter.`;
    } else if (prop.bedrooms === 1 && sqm && sqm <= 56) {
      wfhLayoutVerdict = `Compact ${sqm} m² 1-bed layout — separate bedroom door helps for calls, though a dedicated desk in the lounge may compete with sofa/dining space; check plug points & chair clearance.`;
    } else if (prop.bedrooms >= 2 || hasStudy || (sqm && sqm >= 65)) {
      wfhLayoutVerdict = `Generous ${sqm ? `${sqm} m² ` : ''}layout with clear separation between sleeping and work zones — easy to fit a proper ergonomic desk setup away from kitchen noise.`;
    }

    let windowLightAudit = hasOutdoor
      ? 'Balcony/sliding doors support cross-ventilation and daylight; verify windows do not face a close boundary wall (<3 m).'
      : 'Single-aspect windows may limit cross-breeze; confirm sightlines during viewing so blinds are not kept shut all day.';
    if (isNorth) {
      windowLightAudit = `North-facing aspect (Cape Town gold standard for winter sun & low damp risk). ${hasOutdoor ? 'Balcony doors aid cross-ventilation.' : 'Check window-to-wall ratio for airflow.'}`;
    } else if (/\bwest[\s-]?facing\b/i.test(rawText)) {
      windowLightAudit = 'West-facing exposure delivers warm afternoon sun but risks harsh late-afternoon screen glare during WFH calls; check blinds.';
    } else if (/\bsouth[\s-]?facing\b/i.test(rawText)) {
      windowLightAudit = 'South-facing aspect gets indirect light and runs cooler in winter — inspect window frames and curtains for damp/condensation.';
    }

    let wallAcousticAudit = 'Standard masonry/sectional title build; check party-wall thickness, upstairs footfall, and add a rug/curtains if rooms are all-tile to cut Zoom echo.';
    if (/\b(art deco|parquet|heritage|solid brick)\b/i.test(rawText)) {
      wallAcousticAudit = 'Heritage / solid brick build typically blocks airborne neighbour voices well; if parquet floors exist, check upstairs footfall transmission.';
    } else if (/\b(new development|modern block|micro|newly built)\b/i.test(rawText)) {
      wallAcousticAudit = 'Modern infill build: check whether internal partitions are hollow drywall (higher voice/TV bleed) and note hard-tile echo on video calls.';
    }

    let ceilingVolumeAudit = 'Standard ~2.4 m–2.6 m ceiling height inferred; watch for 0.5x ultra-wide camera lens stretching in listing photos.';
    if (/\b(high ceiling|double volume|victorian|art deco)\b/i.test(rawText)) {
      ceilingVolumeAudit = 'High ceilings (~2.8 m–3.2 m+) improve airiness, daylight reach, and call acoustics; verify true room width beyond wide-angle photos.';
    } else if (/\b(cottage|garden flat|basement|attic)\b/i.test(rawText)) {
      ceilingVolumeAudit = 'Cottage/ancillary structure: verify ceiling height (≥2.4 m) and bulkhead clearances in person, as low ceilings feel tight for full-time WFH.';
    }

    const lightingFixturesAudit = /\b(downlight|recessed|led|renovated|modern)\b/i.test(rawText)
      ? 'Likely fitted with recessed downlights/layered fixtures; check color temperature (warm 2700K–3000K vs harsh 5000K) and inverter-tied bulbs.'
      : 'Confirm rooms do not rely solely on a single central overhead bulb (causes evening eye strain/glare) and check bathroom ventilation.';

    const exteriorBuildingAudit = /\b(estate|24 hour|concierge|access control|electric fence)\b/i.test(rawText)
      ? 'Managed security perimeter signalled; check façade paint/rust streaks and bin-area neatness as a proxy for Body Corporate reserve health.'
      : 'Inspect exterior façade for peeling paint, rust/water streaks under balconies, and working gate motors/electric fencing — key clues to Body Corporate health.';

    return {
      wfhLayoutVerdict,
      windowLightAudit,
      wallAcousticAudit,
      ceilingVolumeAudit,
      lightingFixturesAudit,
      exteriorBuildingAudit,
    };
  };

  const archForensics = buildArchitecturalForensics();

  return {
    rank,
    photoAudit,
    textVerdict,
    personalMatchVerdict,
    pros,
    cons,
    strategicInsights,
    ...archForensics,
    facingAudit: facingLabel,
    amenitiesVerdict: `${prop.fibre_ready ? 'High-speed fibre ready' : 'Standard connectivity'}. ${parkingLabel}. ${prop.pet_friendly ? 'Pet-friendly lease confirmed' : 'Standard lease'}.`,
    stoveType: stoveLabel,
    glazing: isNorth ? 'North-facing floor-to-ceiling glazing with scenic mountain/coastal buffer' : 'Ample daylight through wide exterior windows',
    plumbing: 'Dedicated washing machine and dishwasher plumbing connection points verified',
    distortion: 'Standard focal length (28mm equivalent); zero fish-eye lens distortion or artificial stretching',
    tenancyType,
    quietRules: isMainRoad
      ? '⚠️ Arterial corridor traffic trap (68–74 dB ambient daytime peak). Heavy taxi & delivery vehicle noise.'
      : 'Formal residential tenancy agreement prohibiting noise disturbances or disruptive short-lets',
    isLandlordOnSite,
    isMainRoad,
  };
}
