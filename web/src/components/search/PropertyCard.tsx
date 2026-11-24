import React from 'react';
import {
  MapPin,
  CaretLeft,
  CaretRight,
  Eye,
  EyeSlash,
  Heart,
  WarningCircle,
  Sparkle,
  ArrowSquareOut,
  SpeakerHigh,
  Car,
  ShieldWarning,
  Tree,
  Waves,
  Coffee,
  Compass,
  NavigationArrow,
  Scales,
} from '@phosphor-icons/react';
import { Dumbbell } from 'lucide-react';
import {
  getPropertyBarNoiseExposure,
  getPropertyBusyRoadExposure,
  isMissingAddressListing,
  type PropertyMapItem,
} from '@/components/PropertyMap';
import {
  getDistanceKm,
  getDwellingPrivacyInfo,
  getAgencyReputationInfo,
} from '@/lib/geo';
import {
  getCrimePerimeterInfo,
  getRiskAdjustedValuation,
  formatPrice,
} from '@/lib/forensicAudit';
import type { CommuteAnchor } from '@/constants/locations';
import type { Mapbox3DTarget } from '@/components/search/Mapbox3DModal';

export interface RecentListingComment {
  id: string;
  nickname: string;
  body: string;
  created_at: number;
}

export interface PropertyCardProps {
  prop: PropertyMapItem;
  nowEpochSeconds: number;
  feedViewMode: 'cards' | 'list';
  isSelected: boolean;
  isHoveredOnMap: boolean;
  isHidden: boolean;
  allCandidateProperties: PropertyMapItem[];
  activeAnchor: CommuteAnchor | null | undefined;
  setActiveAnchorId: (id: string) => void;
  templateGyms: CommuteAnchor[];
  anchors: CommuteAnchor[];
  enableFitScore: boolean;
  setSelectedPropertyId: (id: string | null) => void;
  setFocusTarget: (target: { lat: number; lng: number; zoom: number; timestamp: number }) => void;
  compareIds: string[];
  toggleCompareProperty: (prop: PropertyMapItem) => void;
  viewingAiReportProp: PropertyMapItem | null;
  handleTogglePropertyAiReport: (prop: PropertyMapItem) => void;
  resolveProperty24Url: (prop: PropertyMapItem) => string;
  openProperty24Url: (e: React.MouseEvent, url: string) => void;
  resolveGoogleMapsUrl: (prop: PropertyMapItem) => string;
  cardGalleries: Record<string, string[]>;
  cardImageIndices: Record<string, number>;
  setCardImageIndices: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  fetchCardGallery: (id: string, url: string) => void;
  getRectifiedUrl: (url: string) => string;
  toggleFavouriteProperty: (prop: PropertyMapItem, e: React.MouseEvent) => void;
  toggleHideProperty: (id: string, e: React.MouseEvent) => void;
  editingAddressPropId: string | null;
  setEditingAddressPropId: (id: string | null) => void;
  manualAddressInput: string;
  setManualAddressInput: (val: string) => void;
  manualAddressError: string | null;
  setManualAddressError: (val: string | null) => void;
  isSubmittingAddress: boolean;
  handleSubmitManualAddress: (prop: PropertyMapItem) => void;
  openCommentsModal: (prop: PropertyMapItem) => void;
  commentCounts: Record<string, number>;
  recentComments: Record<string, RecentListingComment[]>;
  setPreview3DTarget: (target: Mapbox3DTarget | null) => void;
}

export function PropertyCard({
  prop,
  nowEpochSeconds,
  feedViewMode,
  isSelected,
  isHoveredOnMap,
  isHidden,
  allCandidateProperties,
  activeAnchor,
  setActiveAnchorId,
  templateGyms,
  anchors,
  enableFitScore,
  setSelectedPropertyId,
  setFocusTarget,
  compareIds,
  toggleCompareProperty,
  viewingAiReportProp,
  handleTogglePropertyAiReport,
  resolveProperty24Url,
  openProperty24Url,
  resolveGoogleMapsUrl,
  cardGalleries,
  cardImageIndices,
  setCardImageIndices,
  fetchCardGallery,
  getRectifiedUrl,
  toggleFavouriteProperty,
  toggleHideProperty,
  editingAddressPropId,
  setEditingAddressPropId,
  manualAddressInput,
  setManualAddressInput,
  manualAddressError,
  setManualAddressError,
  isSubmittingAddress,
  handleSubmitManualAddress,
  openCommentsModal,
  commentCounts,
  recentComments,
  setPreview3DTarget,
}: PropertyCardProps) {
  const privacyInfo = getDwellingPrivacyInfo(prop);
  const agencyRep = getAgencyReputationInfo(prop);
  const barNoiseInfo = getPropertyBarNoiseExposure(prop);
  const busyRoadInfo = getPropertyBusyRoadExposure(prop);
  const crimePerimeter = getCrimePerimeterInfo(prop);
  const marketVal = getRiskAdjustedValuation(prop, allCandidateProperties);
  const distToAnchor = activeAnchor ? getDistanceKm(prop.lat, prop.lng, activeAnchor.lat, activeAnchor.lng) : null;
  const isWalkingAnchor = distToAnchor !== null && (activeAnchor?.commute_mode === 'walking' || (activeAnchor?.commute_mode !== 'driving' && distToAnchor <= 1.2));
  const isBikingAnchor = activeAnchor?.commute_mode === 'bicycling';
  const commuteDurMins = distToAnchor !== null
    ? (isWalkingAnchor
      ? Math.max(1, Math.round((distToAnchor / 4.8) * 60))
      : isBikingAnchor
        ? Math.max(1, Math.round((distToAnchor / 15.0) * 60))
        : Math.max(2, Math.round((distToAnchor / 35.0) * 60)))
    : null;
  const commuteModeLabel = isWalkingAnchor ? 'walk' : isBikingAnchor ? 'bike' : 'drive';

  if (feedViewMode === 'list') {
    const shortAddr = (prop.address || prop.suburb || 'Address withheld')
      .replace(/\s*\(Street Address Withheld\)/i, '')
      .trim();
    return (
      <div
        id={`property-card-${prop.id}`}
        onClick={() => {
          setSelectedPropertyId(prop.id);
          setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
        }}
        className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center gap-2.5 ${isSelected
          ? 'bg-purple-50/70 border-purple-400 ring-1 ring-purple-300'
          : isHoveredOnMap
            ? 'bg-indigo-50/40 border-indigo-200'
            : 'bg-white border-zinc-200/80 hover:border-zinc-300 hover:bg-zinc-50/60'
          } ${isHidden ? 'opacity-50' : ''}`}
        title="Click to focus on map"
      >
        <img
          src={prop.image || 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=160&q=70'}
          alt={prop.title}
          className="w-12 h-12 rounded-lg object-cover shrink-0 border border-zinc-200/80 bg-zinc-100"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1.5">
            <div className="flex items-center gap-1 min-w-0">
              {prop.rank && (
                <span className="px-1.5 py-0.5 rounded bg-zinc-900 text-white text-[9.5px] font-black shrink-0">
                  #{prop.rank}
                </span>
              )}
              <span className="text-xs font-extrabold text-zinc-950 truncate">
                R {formatPrice(prop.price)}
              </span>
              {prop.fit_score && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 text-[9.5px] font-black shrink-0">
                  {prop.fit_score}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCompareProperty(prop);
                }}
                className={`px-1.5 py-1 rounded-md text-[10px] font-bold border cursor-pointer ${compareIds.includes(prop.id)
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                  : 'bg-white border-zinc-200 text-zinc-600 hover:bg-purple-50'
                  }`}
                title={compareIds.includes(prop.id) ? 'In Compare' : 'Add to Compare'}
              >
                <Scales size={11} weight="bold" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePropertyAiReport(prop);
                }}
                className="px-2 py-1 rounded-md bg-purple-700 hover:bg-purple-800 text-white text-[10px] font-black flex items-center gap-0.5 cursor-pointer"
                title="AI Forensic Analysis"
              >
                <Sparkle size={10} weight="fill" className="text-amber-300" />
                <span>AI</span>
              </button>
              <a
                href={resolveProperty24Url(prop)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => openProperty24Url(e, resolveProperty24Url(prop))}
                className="px-1.5 py-1 rounded-md bg-zinc-900 hover:bg-indigo-600 text-white text-[10px] font-black cursor-pointer"
                title="Open on Property24"
              >
                P24
              </a>
            </div>
          </div>

          <p className="text-[11px] font-bold text-zinc-800 truncate mt-0.5">
            {prop.title}
          </p>
          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 mt-0.5 truncate">
            <span className="truncate">{shortAddr}</span>
            <span>·</span>
            <span className="shrink-0">{prop.bedrooms}bd{prop.sqm ? ` · ${prop.sqm}m²` : ''}</span>
            {marketVal && (
              <span
                className={`shrink-0 font-bold ${marketVal.isUnderpriced
                  ? 'text-emerald-700'
                  : marketVal.isOverpriced
                    ? 'text-rose-700'
                    : 'text-zinc-500'
                  }`}
              >
                · {marketVal.isUnderpriced ? `-${Math.abs(marketVal.pctDiff)}%` : marketVal.isOverpriced ? `+${Math.abs(marketVal.pctDiff)}%` : 'Fair'}
              </span>
            )}
            {crimePerimeter.isNearHighRisk && !crimePerimeter.hasEstateSecurity && (
              <span className="shrink-0 font-bold text-amber-700" title={crimePerimeter.tooltipReason}>
                · ⚠️ {crimePerimeter.distanceKm}km
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      id={`property-card-${prop.id}`}
      onClick={() => {
        setSelectedPropertyId(prop.id);
        setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
      }}
      title="Click to focus and zoom in on this property on the map"
      className={`pt-3.5 first:pt-0 rounded-2xl p-2.5 transition-all cursor-pointer border ${isSelected
        ? 'bg-purple-50/85 border-purple-500 ring-2 ring-purple-500/40 shadow-xl'
        : isHidden
          ? 'bg-amber-50/30 border-dashed border-amber-300 opacity-75 hover:opacity-100'
          : isHoveredOnMap
            ? 'bg-purple-50/40 border-purple-300 ring-1 ring-purple-400/30 shadow-md'
            : 'hover:bg-zinc-50/80 border-transparent hover:border-zinc-200'
        }`}
    >
      {/* Highlighted on Map Banner */}
      {isSelected && (
        <div className="mb-2.5 flex items-center justify-between px-3 py-1.5 rounded-xl bg-purple-700 text-white text-[11px] font-extrabold shadow-sm animate-in fade-in slide-in-from-top-1 duration-150">
          <span className="flex items-center gap-1.5">
            <MapPin size={13} weight="fill" className="text-amber-300" />
            <span>Selected on Map</span>
          </span>
          <span className="text-[10px] text-purple-200 font-semibold">
            Top Fit #{prop.rank || ''}
          </span>
        </div>
      )}
      {/* Photo Gallery & RealView™ Rectifier (Wide-Angle to Normal Eye Perspective Converter) */}
      {(() => {
        const photosList: string[] = (prop.images && prop.images.length > 0)
          ? prop.images
          : (cardGalleries[prop.id] && cardGalleries[prop.id].length > 0)
            ? cardGalleries[prop.id]
            : [prop.image].filter(Boolean);

        const activePhotoIdx = cardImageIndices[prop.id] || 0;
        const activeRawPhoto = photosList[activePhotoIdx] || prop.image;
        const convertedPhotoUrl = getRectifiedUrl(activeRawPhoto);

        const handlePrevPhoto = (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          if (photosList.length <= 1 && prop.url && !cardGalleries[prop.id]) {
            fetchCardGallery(prop.id, prop.url);
          }
          setCardImageIndices((prev) => {
            const cur = prev[prop.id] || 0;
            return { ...prev, [prop.id]: cur > 0 ? cur - 1 : Math.max(0, photosList.length - 1) };
          });
        };

        const handleNextPhoto = (e: React.MouseEvent) => {
          e.stopPropagation();
          e.preventDefault();
          if (photosList.length <= 1 && prop.url && !cardGalleries[prop.id]) {
            fetchCardGallery(prop.id, prop.url);
          }
          setCardImageIndices((prev) => {
            const cur = prev[prop.id] || 0;
            return { ...prev, [prop.id]: cur < photosList.length - 1 ? cur + 1 : 0 };
          });
        };

        const p24Href = resolveProperty24Url(prop);

        return (
          <div className="relative w-full h-44 rounded-xl overflow-hidden bg-zinc-950 shadow-xs mb-2.5 group/slider select-none">
            {/* Main Converted Photo (Wide Angle -> Human Eye Normal Perspective via RealView™) */}
            <a
              href={p24Href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => openProperty24Url(e, p24Href)}
              title="Open original listing on Property24 (new tab)"
              className="block w-full h-full cursor-pointer"
            >
              <img
                src={convertedPhotoUrl}
                alt={`${prop.title} - Photo ${activePhotoIdx + 1}`}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover group-hover/slider:scale-102 transition-transform duration-300"
                loading="lazy"
                onError={(e) => {
                  // If rectifier fails, fall back gracefully to original raw photo
                  if (e.currentTarget.src !== activeRawPhoto) {
                    e.currentTarget.src = activeRawPhoto;
                  }
                }}
              />
            </a>

            {/* Image Slider: Previous Photo Button */}
            <button
              type="button"
              onClick={handlePrevPhoto}
              className="absolute left-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-zinc-950/75 hover:bg-zinc-950 text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-md cursor-pointer hover:scale-110 active:scale-95 opacity-80 group-hover/slider:opacity-100"
              title="Previous photo"
              aria-label="Previous photo"
            >
              <CaretLeft size={16} weight="bold" />
            </button>

            {/* Image Slider: Next Photo Button */}
            <button
              type="button"
              onClick={handleNextPhoto}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 z-20 w-7 h-7 rounded-full bg-zinc-950/75 hover:bg-zinc-950 text-white flex items-center justify-center backdrop-blur-xs transition-all shadow-md cursor-pointer hover:scale-110 active:scale-95 opacity-80 group-hover/slider:opacity-100"
              title="Next photo"
              aria-label="Next photo"
            >
              <CaretRight size={16} weight="bold" />
            </button>

            {/* Top Bar Overlay: Full-width responsive flex container preventing badge collision */}
            <div className="absolute top-2 left-2 right-2 z-20 flex items-center justify-between gap-1.5 pointer-events-none">
              <div className="flex items-center gap-1.5 min-w-0 shrink">
                {isHidden && (
                  <span className="px-2 py-0.5 rounded-lg bg-amber-500 text-zinc-950 font-black text-[10px] shadow-md flex items-center gap-1 shrink-0">
                    <EyeSlash size={10} weight="bold" />
                    <span>Hidden</span>
                  </span>
                )}
                <span className="px-2.5 py-1 rounded-lg bg-zinc-950/85 text-white font-extrabold text-xs shadow-md backdrop-blur-xs shrink-0 whitespace-nowrap">
                  R {formatPrice(prop.price)} <span className="text-[10px] text-zinc-400 font-normal">/mo</span>
                </span>
                {marketVal && (
                  <span
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black shadow-sm backdrop-blur-xs flex items-center gap-0.5 shrink-0 whitespace-nowrap ${marketVal.isUnderpriced
                      ? 'bg-emerald-950/90 text-emerald-400 border border-emerald-500/40'
                      : marketVal.isOverpriced
                        ? 'bg-rose-950/90 text-rose-400 border border-rose-500/40'
                        : 'bg-zinc-900/90 text-zinc-300 border border-zinc-700/50'
                      }`}
                    title={marketVal.badgeTooltip}
                  >
                    <span>{marketVal.badgeText}</span>
                  </span>
                )}
                {enableFitScore && prop.fit_score && (
                  <span className={`px-2 py-0.5 rounded-lg bg-zinc-950/85 font-black text-[10px] shadow-sm backdrop-blur-xs flex items-center gap-1 shrink-0 whitespace-nowrap ${prop.is_outside_radius
                    ? 'text-amber-400 border border-amber-500/30'
                    : 'text-emerald-400'
                    }`}>
                    <span>{prop.fit_score}% Fit</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5 pointer-events-auto shrink-0">
                {/* Heart Toggle Button */}
                <button
                  type="button"
                  onClick={(e) => toggleFavouriteProperty(prop, e)}
                  className={`p-1.5 rounded-lg backdrop-blur-md border shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${prop.is_favorite
                    ? 'bg-rose-500 text-white border-rose-400 hover:bg-rose-600 font-black'
                    : 'bg-zinc-950/80 hover:bg-zinc-950 text-zinc-300 hover:text-rose-400 border-white/20 hover:border-rose-400/40'
                    }`}
                  title={prop.is_favorite ? "Remove from favourites" : "Add to favourites (or import from P24)"}
                  aria-label={prop.is_favorite ? "Remove from favourites" : "Add to favourites"}
                >
                  <Heart size={13} weight={prop.is_favorite ? "fill" : "bold"} className={prop.is_favorite ? "text-white" : "text-zinc-200"} />
                </button>

                <button
                  type="button"
                  onClick={(e) => toggleHideProperty(prop.id, e)}
                  className={`p-1.5 rounded-lg backdrop-blur-md border shadow-md transition-all cursor-pointer hover:scale-105 active:scale-95 ${isHidden
                    ? 'bg-amber-500 text-zinc-950 border-amber-400 hover:bg-amber-400 font-black'
                    : 'bg-zinc-950/80 hover:bg-zinc-950 text-zinc-300 hover:text-white border-white/20 hover:border-white/40'
                    }`}
                  title={isHidden ? "Unhide this listing (restore to active feed)" : "Hide listing (dismiss from feed & map)"}
                  aria-label={isHidden ? "Unhide listing" : "Hide listing"}
                >
                  {isHidden ? <Eye size={13} weight="bold" /> : <EyeSlash size={13} weight="bold" />}
                </button>
              </div>
            </div>

            {/* Bottom-Center: Photo Counter Pill */}
            {photosList.length > 1 && (
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 px-2 py-0.5 rounded-full bg-zinc-950/80 backdrop-blur-xs text-[10px] font-bold text-white tracking-wider flex items-center gap-1 shadow-xs pointer-events-none">
                <span>{activePhotoIdx + 1}</span>
                <span className="text-zinc-400">/</span>
                <span>{photosList.length}</span>
              </div>
            )}

            {/* Bottom-Left: Rank Number Badge (+ optional Poor Agency Warning) */}
            <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5 pointer-events-none">
              {prop.rank && (
                <span
                  className={`px-2 py-0.5 rounded-lg text-[11px] font-black shadow-md backdrop-blur-xs border ${prop.rank === 1
                    ? 'bg-emerald-600 text-white border-emerald-400/70'
                    : 'bg-zinc-950/85 text-white border-white/15'
                    }`}
                  title={`Ranked #${prop.rank} match`}
                >
                  #{prop.rank}
                </span>
              )}
              {agencyRep.isPoorAgency && agencyRep.shortFlag && (
                <div
                  className="px-2 py-0.5 rounded-md text-[9.5px] font-black flex items-center gap-1 backdrop-blur-xs shadow-md bg-rose-950/95 text-rose-200 border border-rose-500/70"
                  title={agencyRep.tooltipReason}
                >
                  <WarningCircle size={11} weight="fill" className="text-rose-400 shrink-0" />
                  <span>{agencyRep.shortFlag}</span>
                </div>
              )}
            </div>

            <div className="absolute bottom-2 right-2 z-20 flex items-center gap-1.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTogglePropertyAiReport(prop);
                }}
                title={viewingAiReportProp?.id === prop.id ? 'Close AI Forensic Report' : 'Open AI Analysis'}
                className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 backdrop-blur-xs shadow-sm transition-colors cursor-pointer ${viewingAiReportProp?.id === prop.id
                    ? 'bg-purple-950 text-white ring-1 ring-purple-400'
                    : 'bg-purple-700/95 hover:bg-purple-800 text-white'
                  }`}
              >
                <Sparkle size={10} weight="fill" className="text-amber-300 shrink-0" />
                <span>{viewingAiReportProp?.id === prop.id ? 'Close AI' : 'AI Analysis'}</span>
              </button>

              <a
                href={p24Href}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => openProperty24Url(e, p24Href)}
                title="Open original listing on Property24"
                className="px-2 py-0.5 rounded-md bg-zinc-950/90 hover:bg-indigo-600 text-white text-[10px] font-extrabold flex items-center gap-1 backdrop-blur-xs shadow-sm transition-colors cursor-pointer"
              >
                <span>Property24</span>
                <ArrowSquareOut size={11} weight="bold" />
              </a>
            </div>
          </div>
        );
      })()}

      {/* Title & Address */}
      <h3 className="font-extrabold text-xs text-zinc-950 line-clamp-1 mb-0.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setSelectedPropertyId(prop.id);
            setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
          }}
          className="text-left hover:text-indigo-600 hover:underline transition-colors cursor-pointer"
          title="Show and center this listing on the map"
        >
          {prop.title}
        </button>
      </h3>
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-[11px] text-zinc-500 font-medium truncate">
          {prop.address}
        </p>
        {isMissingAddressListing(prop) && editingAddressPropId !== prop.id && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setEditingAddressPropId(prop.id);
              setManualAddressInput('');
              setManualAddressError(null);
            }}
            className="shrink-0 px-2 py-0.5 rounded-md bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold transition-colors cursor-pointer"
            title="Know the street address? Submit it to save for everyone"
          >
            + Add Address
          </button>
        )}
      </div>
      {isMissingAddressListing(prop) && editingAddressPropId === prop.id && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mb-2.5 p-2 rounded-xl bg-indigo-50/70 border border-indigo-200 space-y-1.5"
        >
          <div className="flex items-center gap-1.5">
            <input
              type="text"
              value={manualAddressInput}
              onChange={(e) => setManualAddressInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSubmitManualAddress(prop);
                if (e.key === 'Escape') setEditingAddressPropId(null);
              }}
              placeholder={`e.g. 14 Derwent Rd, ${(prop as PropertyMapItem & { suburb?: string }).suburb || 'Gardens'}`}
              className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] text-zinc-900 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <button
              type="button"
              disabled={isSubmittingAddress}
              onClick={() => handleSubmitManualAddress(prop)}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-[10px] font-bold cursor-pointer"
            >
              {isSubmittingAddress ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingAddressPropId(null);
                setManualAddressError(null);
              }}
              className="px-2 py-1 rounded-lg bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200 text-[10px] font-bold cursor-pointer"
            >
              Cancel
            </button>
          </div>
          {manualAddressError && (
            <p className="text-[10px] text-rose-600 font-semibold">{manualAddressError}</p>
          )}
        </div>
      )}

      {/* Primary Spec Chips: Beds, Baths, Sqm */}
      <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-semibold text-zinc-600 mb-1.5">
        <span className="bg-zinc-100 px-2 py-0.5 rounded-md">
          🛏️ {prop.bedrooms} Bed{prop.bedrooms > 1 ? 's' : ''}
        </span>
        <span className="bg-zinc-100 px-2 py-0.5 rounded-md">
          🚿 {prop.bathrooms} Bath
        </span>
        {prop.sqm && (
          <span className="bg-zinc-100 px-2 py-0.5 rounded-md">
            📐 {prop.sqm} m²
          </span>
        )}
      </div>

      {/* Visual Feature Gauges: Poor Agency Flag, Dwelling Privacy Badge, Stove, Garage, Pets, Inverter, Fibre */}
      <div className="flex items-center flex-wrap gap-1 mb-2.5">
        {marketVal && (
          <span
            className={`border px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs ${marketVal.isUnderpriced
              ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
              : marketVal.isOverpriced
                ? 'bg-rose-50 text-rose-950 border-rose-300'
                : 'bg-zinc-100 text-zinc-800 border-zinc-300'
              }`}
            title={marketVal.badgeTooltip}
          >
            <span>{marketVal.isUnderpriced ? '📉' : marketVal.isOverpriced ? '📈' : '⚖️'}</span>
            <span>{marketVal.badgeText}</span>
          </span>
        )}
        {prop.is_favorite && (
          <span
            className="bg-rose-50 text-rose-700 border border-rose-200/90 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
            title="Saved in your Property24 favourites"
          >
            <Heart size={11} weight="fill" className="text-rose-600 shrink-0" />
            <span>P24 Favourite</span>
          </span>
        )}
        {agencyRep.isPoorAgency && agencyRep.badgeLabel && (
          <span
            className="bg-rose-600 text-white border border-rose-700 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-xs"
            title={agencyRep.tooltipReason}
          >
            <WarningCircle size={11} weight="fill" className="text-white shrink-0" />
            <span>{agencyRep.badgeLabel}</span>
          </span>
        )}
        {barNoiseInfo.isExposed && barNoiseInfo.shortFlag && (
          <span
            className="bg-rose-50 text-rose-950 border border-rose-300 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
            title={barNoiseInfo.tooltipReason}
          >
            <SpeakerHigh size={11} weight="fill" className="text-rose-600 shrink-0" />
            <span>{barNoiseInfo.shortFlag}</span>
          </span>
        )}
        {busyRoadInfo.isNearBusyRoad && busyRoadInfo.shortFlag && (
          <span
            className="bg-amber-50 text-amber-950 border border-amber-300 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
            title={busyRoadInfo.tooltipReason}
          >
            <Car size={11} weight="fill" className="text-amber-700 shrink-0" />
            <span>{busyRoadInfo.shortFlag}</span>
          </span>
        )}
        {crimePerimeter.isNearHighRisk && crimePerimeter.shortFlag && (
          <span
            className={`border px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs ${crimePerimeter.hasEstateSecurity
              ? 'bg-slate-50 text-slate-800 border-slate-300'
              : 'bg-amber-50 text-amber-950 border-amber-300'
              }`}
            title={crimePerimeter.tooltipReason}
          >
            <ShieldWarning
              size={11}
              weight="fill"
              className={crimePerimeter.hasEstateSecurity ? 'text-emerald-600 shrink-0' : 'text-amber-600 shrink-0'}
            />
            <span>{crimePerimeter.shortFlag}</span>
          </span>
        )}
        {privacyInfo.badgeLabel && (
          <span
            className={`border px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs ${privacyInfo.isExplicitLandlord
              ? 'bg-rose-50 text-rose-950 border-rose-300'
              : 'bg-amber-50 text-amber-950 border-amber-300'
              }`}
            title={privacyInfo.isExplicitLandlord ? "Landlord / Owner lives on property" : "Garden cottage / flatlet on shared property"}
          >
            {privacyInfo.isExplicitLandlord ? (
              <>
                <WarningCircle size={11} weight="fill" className="text-rose-600 shrink-0" />
                <span>{privacyInfo.badgeLabel.replace(/^⚠️\s*/, '')}</span>
              </>
            ) : (
              <span>{privacyInfo.badgeLabel}</span>
            )}
          </span>
        )}
        {/* Listing Date / Stale Listing Badge */}
        {(() => {
          const extProp = prop as PropertyMapItem & { first_seen_at?: number; available_from?: string };
          const firstSeen = extProp.first_seen_at;
          const availFrom = extProp.available_from;
          const nodes: React.ReactNode[] = [];
          if (firstSeen && typeof firstSeen === 'number') {
            const days = Math.max(0, Math.floor((nowEpochSeconds - firstSeen) / 86400));
            const dateStr = new Date(firstSeen * 1000).toLocaleDateString('en-ZA', {
              day: 'numeric',
              month: 'short',
            });
            if (days >= 21) {
              nodes.push(
                <span
                  key="listed-stale"
                  className="border border-amber-300 bg-amber-50 text-amber-950 px-2 py-0.5 rounded-md text-[10px] font-black flex items-center gap-1 shadow-2xs"
                  title={`First seen ${dateStr} (${days} days ago) — still unrented`}
                >
                  <span>⏳</span>
                  <span>Listed {dateStr} ({days}d+ Stale)</span>
                </span>
              );
            } else {
              nodes.push(
                <span
                  key="listed-date"
                  className="bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
                  title={`First seen on HomeSeek: ${dateStr}${days > 0 ? ` (${days}d ago)` : ' (today)'} — Property24 does not publish upload dates`}
                >
                  <span>📅</span>
                  <span>Seen {dateStr}{days > 0 ? ` · ${days}d` : ''}</span>
                </span>
              );
            }
          }
          if (availFrom) {
            nodes.push(
              <span
                key="avail-from"
                className="bg-sky-50 text-sky-900 border border-sky-200/80 px-2 py-0.5 rounded-md text-[10px] font-bold flex items-center gap-1"
                title={`Available from ${availFrom}`}
              >
                <span>🗓️</span>
                <span>Avail {availFrom}</span>
              </span>
            );
          }
          return nodes.length > 0 ? <>{nodes}</> : null;
        })()}
        {/* Stove Badge */}
        {prop.stove_type === 'gas' ? (
          <span
            className="bg-amber-50 text-amber-900 border border-amber-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
            title="Gas Hob / Cooker (No load-shedding disruption)"
          >
            <span>🔥 Gas Hob</span>
          </span>
        ) : prop.stove_type === 'induction' ? (
          <span
            className="bg-cyan-50 text-cyan-900 border border-cyan-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
            title="Modern induction cooktop"
          >
            <span>🌀 Induction</span>
          </span>
        ) : (
          <span
            className="bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
            title="Electric stove / hob"
          >
            <span>⚡ Electric</span>
          </span>
        )}

        {/* Parking Badges (Garage and/or Off-Street Bay) */}
        {prop.has_garage && (
          <span
            className="bg-emerald-50 text-emerald-900 border border-emerald-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
            title="Lock-up / automated private garage"
          >
            <span>🚗 Garage</span>
          </span>
        )}
        {(prop.has_secure_bay || (!prop.has_garage && prop.parking_type === 'secure_bay')) && (
          <span
            className="bg-zinc-100 text-zinc-700 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
            title="Allocated secure parking bay / off-street parking"
          >
            <span>🅿️ Off-Street Bay</span>
          </span>
        )}
        {!prop.has_garage && !prop.has_secure_bay && prop.parking_type !== 'secure_bay' && prop.parking_type !== 'garage' && (
          <span
            className="bg-zinc-100 text-zinc-500 border border-zinc-200/80 px-2 py-0.5 rounded-md text-[10px] font-medium flex items-center gap-1"
            title="Street parking / unassigned"
          >
            <span>🚗 Street Pkg</span>
          </span>
        )}

        {/* Pet Friendly Badge */}
        {prop.pet_friendly && (
          <span
            className="bg-indigo-50 text-indigo-900 border border-indigo-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
            title="Verified pet-friendly lease"
          >
            <span>🐾 Pet Friendly</span>
          </span>
        )}

        {/* Inverter / Solar Badge */}
        {prop.has_inverter && (
          <span
            className="bg-teal-50 text-teal-900 border border-teal-300/80 px-2 py-0.5 rounded-md text-[10px] font-extrabold flex items-center gap-1 shadow-2xs"
            title="Inverter / solar battery backup power"
          >
            <span>🔋 Inverter</span>
          </span>
        )}

        {/* Fibre Internet Badge */}
        {prop.fibre_ready && (
          <span
            className="bg-purple-50 text-purple-900 border border-purple-300/80 px-2 py-0.5 rounded-md text-[10px] font-semibold flex items-center gap-1"
            title="High-speed fibre ready connection"
          >
            <span>🌐 Fibre</span>
          </span>
        )}
      </div>

      {/* Trailhead / Desirable Location Proximity Pill */}
      {activeAnchor && distToAnchor !== null && (
        <div className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-zinc-100/90 border border-zinc-200/80 mb-1.5">
          <span className="font-semibold text-zinc-700 flex items-center gap-1.5 truncate max-w-[210px]">
            {activeAnchor.iconType === 'gym' ? (
              <Dumbbell size={13} className="text-amber-600 shrink-0" />
            ) : activeAnchor.iconType === 'trail' ? (
              <Tree size={13} weight="fill" className="text-emerald-600 shrink-0" />
            ) : activeAnchor.iconType === 'surf' || activeAnchor.iconType === 'beach' ? (
              <Waves size={13} weight="fill" className="text-cyan-600 shrink-0" />
            ) : activeAnchor.iconType === 'cafe' ? (
              <Coffee size={13} weight="fill" className="text-amber-600 shrink-0" />
            ) : (
              <Compass size={13} weight="bold" className="text-indigo-600 shrink-0" />
            )}
            <span className="truncate">{activeAnchor.label}</span>
          </span>
          <span className="font-black text-indigo-700 shrink-0">
            {distToAnchor} km · ~{commuteDurMins}m {commuteModeLabel}
          </span>
        </div>
      )}

      {/* Gym Proximity Row in Area */}
      {(() => {
        const gymsList = templateGyms.length > 0 ? templateGyms : anchors.filter((a) => a.category === 'gym' || a.iconType === 'gym');
        if (gymsList.length === 0) return null;
        let closestGym = gymsList[0];
        let minD = getDistanceKm(prop.lat, prop.lng, closestGym.lat, closestGym.lng);
        for (let i = 1; i < gymsList.length; i++) {
          const d = getDistanceKm(prop.lat, prop.lng, gymsList[i].lat, gymsList[i].lng);
          if (d < minD) {
            minD = d;
            closestGym = gymsList[i];
          }
        }
        if (activeAnchor?.id === closestGym.id) return null;
        const gymMins = Math.max(2, Math.round((minD / 35.0) * 60));
        return (
          <div
            onClick={(e) => {
              e.stopPropagation();
              setActiveAnchorId(closestGym.id);
              setFocusTarget({
                lat: closestGym.lat,
                lng: closestGym.lng,
                zoom: 15.2,
                timestamp: Date.now()
              });
            }}
            className="flex items-center justify-between text-[11px] p-2 rounded-xl bg-amber-50/80 hover:bg-amber-100/80 border border-amber-200/80 mb-2 transition-colors cursor-pointer group/gym"
            title={`Click to set ${closestGym.label} as active focal anchor`}
          >
            <span className="font-semibold text-zinc-800 flex items-center gap-1.5 truncate max-w-[210px]">
              <Dumbbell size={13} className="text-amber-600 shrink-0 group-hover/gym:scale-110 transition-transform" />
              <span className="truncate">{closestGym.label}</span>
            </span>
            <span className="font-black text-amber-900 shrink-0">
              {minD} km · ~{gymMins}m
            </span>
          </div>
        );
      })()}

      {/* Links / Action Footer */}
      <div className="flex items-center justify-between flex-wrap gap-1.5 pt-2.5 mt-1.5 border-t border-zinc-100 text-xs">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (isSelected) {
              setSelectedPropertyId(null);
            } else {
              setSelectedPropertyId(prop.id);
              setFocusTarget({ lat: prop.lat, lng: prop.lng, zoom: 16.8, timestamp: Date.now() });
            }
          }}
          className="text-[11px] text-indigo-600 font-bold hover:underline flex items-center gap-1 cursor-pointer whitespace-nowrap"
          title="Focus and highlight this property on the map"
        >
          <span>Focus on map</span>
          <NavigationArrow size={11} weight="fill" />
        </button>

        <div className="flex items-center flex-wrap gap-1 min-w-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleCompareProperty(prop);
            }}
            className={`px-2 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1 border transition-colors whitespace-nowrap cursor-pointer ${compareIds.includes(prop.id)
              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
              : 'bg-white hover:bg-purple-50 border-zinc-200 text-zinc-700 hover:border-purple-200'
              }`}
            title={compareIds.includes(prop.id) ? 'Remove from AI Compare' : 'Add to AI Compare (2–4 properties)'}
          >
            <Scales size={12} weight="bold" className="shrink-0" />
            <span>{compareIds.includes(prop.id) ? '✓' : '+'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleTogglePropertyAiReport(prop);
            }}
            className={`px-2.5 py-1.5 rounded-lg text-[11px] font-extrabold flex items-center gap-1 shadow-2xs transition-all cursor-pointer whitespace-nowrap ${viewingAiReportProp?.id === prop.id
              ? 'bg-purple-950 text-white ring-2 ring-purple-400/50'
              : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white'
              }`}
            title={viewingAiReportProp?.id === prop.id ? "Close AI Forensic Report" : "Get AI Report for this property"}
          >
            <Sparkle size={12} weight="fill" className="text-amber-300 shrink-0" />
            <span>{viewingAiReportProp?.id === prop.id ? 'Close' : 'AI Analysis'}</span>
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openCommentsModal(prop);
            }}
            className={`px-2 py-1.5 rounded-lg text-[10.5px] font-bold flex items-center gap-1 border transition-colors whitespace-nowrap cursor-pointer ${(commentCounts[prop.id] || 0) > 0
              ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 border-zinc-200'
              }`}
            title={(commentCounts[prop.id] || 0) > 0 ? `Open ${commentCounts[prop.id]} comment(s)` : 'Add a comment on this listing'}
          >
            <span>💬</span>
            {(commentCounts[prop.id] || 0) > 0 && <span>{commentCounts[prop.id]}</span>}
          </button>

          <a
            href={resolveGoogleMapsUrl(prop)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="px-1.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-700 hover:text-zinc-950 text-[10.5px] font-bold flex items-center gap-1 border border-zinc-200 transition-colors whitespace-nowrap cursor-pointer"
            title="Show exact address / location on Google Maps (opens in a new tab)"
          >
            <MapPin size={12} weight="bold" className="text-rose-500 shrink-0" />
            <span>Maps</span>
            <ArrowSquareOut size={10} weight="bold" className="text-zinc-400 shrink-0" />
          </a>
        </div>

        {/* Right-aligned 3D Preview & View on P24 actions */}
        <div className="flex items-center gap-1.5 ml-auto shrink-0">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPreview3DTarget({
                id: prop.id,
                title: prop.title,
                address: prop.address,
                lat: prop.lat,
                lng: prop.lng,
                price: prop.price,
              });
            }}
            className="px-2.5 py-1.5 rounded-lg text-[10.5px] font-black flex items-center gap-1 border border-sky-200 bg-sky-50 hover:bg-sky-100 text-sky-800 transition-colors whitespace-nowrap cursor-pointer"
            title="Open on-demand Mapbox 3D Terrain, Buildings & Sun Shadow Preview"
          >
            <span>3D</span>
          </button>

          <a
            href={resolveProperty24Url(prop)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => openProperty24Url(e, resolveProperty24Url(prop))}
            className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-indigo-600 text-white text-[11px] font-extrabold flex items-center gap-1 shadow-2xs transition-colors whitespace-nowrap cursor-pointer"
            title="Open original listing on Property24"
          >
            <span>View on P24</span>
            <ArrowSquareOut size={11} weight="bold" className="shrink-0" />
          </a>
        </div>
      </div>
      {recentComments[prop.id] && recentComments[prop.id].length > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openCommentsModal(prop);
          }}
          className="w-full text-left mt-2 px-2.5 py-2 rounded-xl bg-indigo-50/75 hover:bg-indigo-100/75 border border-indigo-200/70 text-[11px] text-zinc-700 transition-colors cursor-pointer space-y-1"
          title="Click to view or add comments"
        >
          {recentComments[prop.id].slice(0, 3).map((c) => (
            <div key={c.id} className="leading-snug line-clamp-2">
              <span className="font-extrabold text-indigo-800">u/{c.nickname}:</span>{' '}
              <span className="text-zinc-700">{c.body}</span>
            </div>
          ))}
          {(commentCounts[prop.id] || 0) > 3 && (
            <div className="text-[10px] font-bold text-indigo-600 pt-0.5">
              View all {commentCounts[prop.id]} comments →
            </div>
          )}
        </button>
      )}
    </div>
  );
}
