import React from 'react';
import {
  CircleNotch,
  Eye,
  EyeSlash,
  SquaresFour,
  ListBullets,
  CaretLeft,
  Target,
  CheckCircle,
  Info,
  X,
  MagnifyingGlass,
} from '@phosphor-icons/react';
import type { PropertyMapItem } from '@/components/PropertyMap';
import type { CommuteAnchor } from '@/constants/locations';
import type { Mapbox3DTarget } from '@/components/search/Mapbox3DModal';
import { PropertyCard, type RecentListingComment } from '@/components/search/PropertyCard';

export interface SearchResultsListProps {
  isListCollapsed: boolean;
  setIsListCollapsed: (collapsed: boolean) => void;
  displayProperties: PropertyMapItem[];
  properties: PropertyMapItem[];
  allCandidateProperties: PropertyMapItem[];
  isScraping: boolean;
  isInitialSyncing: boolean;
  staleDataInfo: { isStale: boolean; oldestAgeSeconds: number } | null;
  selectedSuburbs: string[];
  hiddenCount: number;
  showHidden: boolean;
  setShowHidden: (show: boolean) => void;
  unhideAllProperties: () => void;
  feedViewMode: 'cards' | 'list';
  setFeedViewMode: (mode: 'cards' | 'list') => void;
  sortBy: string;
  setSortBy: (sort: 'fit' | 'price-asc' | 'price-desc' | 'distance') => void;
  enableFitScore: boolean;
  withinRadiusFilter: boolean;
  setWithinRadiusFilter: (val: boolean) => void;
  activeAnchor: CommuteAnchor | null | undefined;
  radiusExcludedCount: number;
  locationRadiusKm: number;
  handleScrapeP24: () => void;
  isRateGuardActive: boolean;
  scrapeStatusText: string;
  setScrapeStatusText: (text: string) => void;

  // Empty-state / filter reset handlers
  doesPropMatchSuburbs: (prop: PropertyMapItem, suburbs: string[]) => boolean;
  backendSyncError: string | null;
  setBackendSyncError: (err: string | null) => void;
  setSyncRetryTick: React.Dispatch<React.SetStateAction<number>>;
  setGhostRetryTick: React.Dispatch<React.SetStateAction<number>>;
  setPrivateOnlyFilter: (val: boolean) => void;
  setParkingFilter: (val: boolean) => void;
  setPetFriendlyFilter: (val: boolean) => void;
  setFibreFilter: (val: boolean) => void;
  setOffBarsFilter: (val: boolean) => void;
  setOffMainRoadFilter: (val: boolean) => void;
  setSafeishFilter: (val: boolean) => void;
  setBelowMarketFilter: (val: boolean) => void;
  setShowOnlyFavourites: (val: boolean) => void;

  // PropertyCard shared props
  selectedPropertyId: string | null;
  setSelectedPropertyId: (id: string | null) => void;
  hoveredPropertyId: string | null;
  hiddenPropertyIds: string[];
  setActiveAnchorId: (id: string) => void;
  templateGyms: CommuteAnchor[];
  anchors: CommuteAnchor[];
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

export function SearchResultsList({
  isListCollapsed,
  setIsListCollapsed,
  displayProperties,
  properties,
  allCandidateProperties,
  isScraping,
  isInitialSyncing,
  staleDataInfo,
  selectedSuburbs,
  hiddenCount,
  showHidden,
  setShowHidden,
  unhideAllProperties,
  feedViewMode,
  setFeedViewMode,
  sortBy,
  setSortBy,
  enableFitScore,
  withinRadiusFilter,
  setWithinRadiusFilter,
  activeAnchor,
  radiusExcludedCount,
  locationRadiusKm,
  handleScrapeP24,
  isRateGuardActive,
  scrapeStatusText,
  setScrapeStatusText,
  doesPropMatchSuburbs,
  backendSyncError,
  setBackendSyncError,
  setSyncRetryTick,
  setGhostRetryTick,
  setPrivateOnlyFilter,
  setParkingFilter,
  setPetFriendlyFilter,
  setFibreFilter,
  setOffBarsFilter,
  setOffMainRoadFilter,
  setSafeishFilter,
  setBelowMarketFilter,
  setShowOnlyFavourites,
  selectedPropertyId,
  setSelectedPropertyId,
  hoveredPropertyId,
  hiddenPropertyIds,
  setActiveAnchorId,
  templateGyms,
  anchors,
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
}: SearchResultsListProps) {
  const [nowEpochSeconds] = React.useState(() => Math.floor(Date.now() / 1000));
  const renderPropertyCard = (prop: PropertyMapItem) => (
    <PropertyCard
      key={prop.id}
      prop={prop}
      nowEpochSeconds={nowEpochSeconds}
      feedViewMode={feedViewMode}
      isSelected={selectedPropertyId === prop.id}
      isHoveredOnMap={hoveredPropertyId === prop.id}
      isHidden={hiddenPropertyIds.includes(prop.id) || Boolean(prop.is_hidden)}
      allCandidateProperties={allCandidateProperties}
      activeAnchor={activeAnchor}
      setActiveAnchorId={setActiveAnchorId}
      templateGyms={templateGyms}
      anchors={anchors}
      enableFitScore={enableFitScore}
      setSelectedPropertyId={setSelectedPropertyId}
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
  );

  return (
    <aside
      className={`h-full border-r border-zinc-200 bg-white flex flex-col z-20 shadow-md transition-all duration-300 ease-in-out ${isListCollapsed ? 'w-0 overflow-hidden border-none' : 'w-full sm:w-[340px] lg:w-[370px] xl:w-[410px] shrink-0'
        }`}
    >
      {/* Column Header */}
      <div className="shrink-0 px-3.5 py-2.5 border-b border-zinc-100 bg-white/95 backdrop-blur-xs">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <h2 className="font-extrabold text-sm text-zinc-950 whitespace-nowrap">
                {displayProperties.length} Properties
              </h2>
              {isScraping ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                  <CircleNotch size={11} className="animate-spin text-indigo-600" />
                  <span>Loading</span>
                </span>
              ) : staleDataInfo?.isStale ? (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-amber-50 text-amber-800 border border-amber-300 shrink-0">
                  Stale
                </span>
              ) : (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  Live
                </span>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
              <p className="text-[11px] text-zinc-400 font-medium truncate max-w-[160px]">
                {selectedSuburbs.join(', ')}
              </p>
              {hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={() => setShowHidden(!showHidden)}
                  className={`text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border transition-all cursor-pointer whitespace-nowrap shrink-0 ${showHidden
                    ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-2xs'
                    : 'bg-zinc-100 text-zinc-600 border-zinc-200 hover:bg-zinc-200 hover:text-zinc-900'
                    }`}
                  title={showHidden ? "Hide dismissed listings again" : `Show ${hiddenCount} hidden listing${hiddenCount > 1 ? 's' : ''}`}
                >
                  {showHidden ? <Eye size={11} weight="bold" /> : <EyeSlash size={11} weight="bold" />}
                  <span>{showHidden ? `Hide (${hiddenCount})` : `${hiddenCount} Hidden`}</span>
                </button>
              )}
              {showHidden && hiddenCount > 0 && (
                <button
                  type="button"
                  onClick={unhideAllProperties}
                  className="text-[10.5px] font-bold text-indigo-600 hover:text-indigo-800 underline transition-colors cursor-pointer"
                  title="Restore all hidden listings"
                >
                  Unhide All
                </button>
              )}
            </div>
          </div>

          {/* View Mode Toggle, Sorting Dropdown & Collapse Toggle */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center bg-zinc-100 border border-zinc-200 rounded-xl p-0.5" title="Switch feed view mode">
              <button
                type="button"
                onClick={() => setFeedViewMode('cards')}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${feedViewMode === 'cards'
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                title="Cards View"
                aria-label="Cards View"
              >
                <SquaresFour size={14} weight={feedViewMode === 'cards' ? 'fill' : 'bold'} />
              </button>
              <button
                type="button"
                onClick={() => setFeedViewMode('list')}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${feedViewMode === 'list'
                  ? 'bg-white text-zinc-950 shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800'
                  }`}
                title="Compact List View"
                aria-label="Compact List View"
              >
                <ListBullets size={14} weight={feedViewMode === 'list' ? 'fill' : 'bold'} />
              </button>
            </div>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'fit' | 'price-asc' | 'price-desc' | 'distance')}
              className="text-xs font-bold text-zinc-700 bg-zinc-100 border border-zinc-200 rounded-xl px-2 py-1 focus:outline-none cursor-pointer"
            >
              {enableFitScore && <option value="fit">Top Fit</option>}
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="distance">Nearest to Trailhead</option>
            </select>

            <button
              type="button"
              onClick={() => setIsListCollapsed(true)}
              className="p-1 text-zinc-400 hover:text-zinc-800 rounded-lg hover:bg-zinc-100 transition-colors"
              title="Collapse Card List (Full Screen Map)"
            >
              <CaretLeft size={16} weight="bold" />
            </button>
          </div>
        </div>

        {withinRadiusFilter && activeAnchor && radiusExcludedCount > 0 && (
          <div className="mt-2 px-2.5 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200/80 flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-indigo-900 truncate">
              🎯 <strong className="font-extrabold tabular-nums">{radiusExcludedCount}</strong> outside {locationRadiusKm.toFixed(1)} km hidden
            </span>
            <button
              type="button"
              onClick={() => setWithinRadiusFilter(false)}
              className="font-extrabold text-indigo-700 hover:text-indigo-950 underline shrink-0 cursor-pointer"
            >
              Show all {displayProperties.length + radiusExcludedCount}
            </button>
          </div>
        )}

        {staleDataInfo?.isStale && !isScraping && (
          <div className="mt-2 px-2.5 py-1.5 rounded-xl bg-amber-50 border border-amber-300/90 flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-amber-950 leading-snug">
              ⏳ {staleDataInfo.oldestAgeSeconds >= 86400
                ? `Cached data is ${Math.floor(staleDataInfo.oldestAgeSeconds / 86400)}d+ old`
                : 'Some suburb data is stale'} — refresh to update.
            </span>
            <button
              type="button"
              onClick={handleScrapeP24}
              disabled={isScraping || isRateGuardActive}
              className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-extrabold text-[10.5px] shrink-0 cursor-pointer shadow-2xs transition-colors"
            >
              {isRateGuardActive ? 'Cooldown' : 'Refresh Listings'}
            </button>
          </div>
        )}

        {/* Scrape / Status Banner in Feed Header */}
        {scrapeStatusText && (
          <div className={`mt-2 p-2 rounded-xl text-[11px] font-bold flex items-center justify-between gap-2 border animate-in fade-in duration-150 ${scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete')
            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
            : scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Connecting') || scrapeStatusText.includes('Running')
              ? 'bg-indigo-50 text-indigo-900 border-indigo-200'
              : 'bg-zinc-50 text-zinc-800 border-zinc-200'
            }`}>
            <div className="flex items-center gap-1.5 min-w-0 truncate">
              {scrapeStatusText.includes('Scraping') || scrapeStatusText.includes('Connecting') || scrapeStatusText.includes('Running') ? (
                <CircleNotch size={13} className="animate-spin text-indigo-600 shrink-0" />
              ) : scrapeStatusText.includes('Found') || scrapeStatusText.includes('complete') ? (
                <CheckCircle size={13} weight="fill" className="text-emerald-600 shrink-0" />
              ) : (
                <Info size={13} weight="bold" className="text-zinc-600 shrink-0" />
              )}
              <span className="truncate">{scrapeStatusText}</span>
            </div>
            <button
              type="button"
              onClick={() => setScrapeStatusText('')}
              className="p-0.5 text-zinc-400 hover:text-zinc-700 rounded-md cursor-pointer shrink-0"
              title="Dismiss"
            >
              <X size={11} weight="bold" />
            </button>
          </div>
        )}
      </div>

      {/* Scrollable Property Cards Feed */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-3.5">
        {(() => {
          if (displayProperties.length === 0) {
            return null;
          }

          const getKnownSqm = (p: PropertyMapItem) => {
            if (p.sqm && p.sqm > 0) return p.sqm;
            const m = `${p.title} ${p.address}`.match(/(\d+)\s*(?:m²|sqm|m2)/i);
            return m ? parseInt(m[1], 10) : 0;
          };

          const knownSizeProps = displayProperties.filter((p) => getKnownSqm(p) > 0);
          const unknownSizeProps = displayProperties.filter((p) => getKnownSqm(p) <= 0);

          const inRadiusProps = activeAnchor ? knownSizeProps.filter((p) => !p.is_outside_radius) : [];
          const outOfRadiusProps = activeAnchor ? knownSizeProps.filter((p) => p.is_outside_radius) : knownSizeProps;

          return (
            <>
              {activeAnchor && inRadiusProps.length > 0 && (
                <div className="rounded-2xl bg-indigo-50/75 border border-indigo-200/80 p-2.5 space-y-3">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5 min-w-0">
                      <Target size={13} weight="bold" className="text-indigo-600 shrink-0" />
                      <span className="truncate">Within Radius to {activeAnchor.label}</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-indigo-700 bg-white/90 border border-indigo-200 px-2 py-0.5 rounded-full shrink-0">
                      {inRadiusProps.length} · ≤{locationRadiusKm.toFixed(1)} km
                    </span>
                  </div>
                  <div className="space-y-3">
                    {inRadiusProps.map(renderPropertyCard)}
                  </div>
                </div>
              )}

              {outOfRadiusProps.length > 0 && (
                <div className="space-y-3 pt-1">
                  {activeAnchor && (
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[10.5px] font-bold uppercase tracking-wider text-zinc-400">
                        Outside {locationRadiusKm.toFixed(1)} km radius
                      </span>
                      <span className="text-[10px] font-bold text-zinc-400">
                        {outOfRadiusProps.length}
                      </span>
                    </div>
                  )}
                  {outOfRadiusProps.map(renderPropertyCard)}
                </div>
              )}

              {unknownSizeProps.length > 0 && (
                <div className="rounded-2xl bg-amber-50/75 border border-amber-200/80 p-2.5 space-y-3">
                  <div className="flex items-center justify-between gap-2 px-1">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-900 flex items-center gap-1.5 min-w-0">
                      <span>📐</span>
                      <span className="truncate">Size Unknown</span>
                    </span>
                    <span className="text-[10px] font-extrabold text-amber-800 bg-white/90 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                      {unknownSizeProps.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {unknownSizeProps.map(renderPropertyCard)}
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {displayProperties.length === 0 && (isInitialSyncing || isScraping) ? (
          <div className="space-y-3 p-1">
            {[0, 1, 2].map((idx) => (
              <div key={idx} className="rounded-2xl border border-zinc-200 bg-white p-3 space-y-2.5">
                <div className="w-full h-36 rounded-xl bg-zinc-100 animate-pulse" />
                <div className="w-3/4 h-4 rounded bg-zinc-200 animate-pulse" />
                <div className="w-1/2 h-3 rounded bg-zinc-100 animate-pulse" />
                <div className="flex gap-2 pt-1">
                  <div className="w-16 h-6 rounded-lg bg-zinc-100 animate-pulse" />
                  <div className="w-16 h-6 rounded-lg bg-zinc-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : displayProperties.length === 0 && (() => {
          const suburbLoadedCount = properties.filter((p) => doesPropMatchSuburbs(p, selectedSuburbs)).length;
          const isStaleEmpty = Boolean(staleDataInfo?.isStale);
          const isServerDown = Boolean(backendSyncError) && suburbLoadedCount === 0;
          const isFilteredOut = suburbLoadedCount > 0 && hiddenCount === 0;
          const staleDays = staleDataInfo?.oldestAgeSeconds ? Math.floor(staleDataInfo.oldestAgeSeconds / 86400) : 0;

          return (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isStaleEmpty ? 'bg-amber-100 text-amber-600' : isServerDown ? 'bg-rose-100 text-rose-600' : 'bg-zinc-100 text-zinc-400'
                }`}>
                <EyeSlash size={24} weight="bold" />
              </div>
              <div className="space-y-1">
                <h3 className="font-extrabold text-sm text-zinc-900">
                  {hiddenCount > 0
                    ? 'All Matching Listings Are Hidden'
                    : isServerDown
                      ? 'Listings Server Unreachable'
                      : isStaleEmpty
                        ? 'Cached Listings Are Stale'
                        : isFilteredOut
                          ? 'No Listings Match Active Filters'
                          : 'No Fresh Listings Loaded'}
                </h3>
                <p className="text-xs text-zinc-500 max-w-[270px] mx-auto leading-relaxed">
                  {hiddenCount > 0
                    ? `You have hidden ${hiddenCount} listing${hiddenCount > 1 ? 's' : ''}. Toggle visibility to review or restore them.`
                    : isServerDown
                      ? `${backendSyncError} Retry to load cached listings or refresh live data from Property24.`
                      : isStaleEmpty
                        ? `${staleDays >= 1 ? `Cached listings for these suburbs are ${staleDays}d+ old` : 'Cached data for these suburbs is stale'} and needs a refresh to load current availability.`
                        : isFilteredOut
                          ? `${suburbLoadedCount} cached listing${suburbLoadedCount > 1 ? 's' : ''} found in ${selectedSuburbs.join(', ')}, but your active filter pills (e.g. Private, Off-street pkg, Safe-ish) filtered them out.`
                          : 'No active cached listings were found for your selected suburbs. Refresh listings from Property24 or paste favourites.'}
                </p>
              </div>

              {hiddenCount > 0 ? (
                <button
                  type="button"
                  onClick={() => setShowHidden(true)}
                  className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                >
                  <Eye size={13} weight="bold" />
                  <span>Show {hiddenCount} Hidden Listing{hiddenCount > 1 ? 's' : ''}</span>
                </button>
              ) : isServerDown ? (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setBackendSyncError(null);
                      setSyncRetryTick((t) => t + 1);
                      setGhostRetryTick((t) => t + 1);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <MagnifyingGlass size={13} weight="bold" />
                    <span>Retry Connection</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleScrapeP24}
                    disabled={isScraping}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <span>{isScraping ? 'Refreshing...' : 'Refresh Listings'}</span>
                  </button>
                </div>
              ) : isFilteredOut ? (
                <div className="flex flex-wrap items-center justify-center gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPrivateOnlyFilter(false);
                      setParkingFilter(false);
                      setPetFriendlyFilter(false);
                      setFibreFilter(false);
                      setOffBarsFilter(false);
                      setOffMainRoadFilter(false);
                      setSafeishFilter(false);
                      setWithinRadiusFilter(false);
                      setBelowMarketFilter(false);
                      setShowOnlyFavourites(false);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <span>Clear Filter Pills</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleScrapeP24}
                    disabled={isScraping || isRateGuardActive}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-extrabold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                  >
                    <MagnifyingGlass size={13} weight="bold" />
                    <span>{isScraping ? 'Refreshing...' : 'Refresh Listings'}</span>
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleScrapeP24}
                  disabled={isScraping || isRateGuardActive}
                  className={`mt-1 px-4 py-2 rounded-xl font-extrabold text-xs flex items-center gap-1.5 shadow-md transition-all cursor-pointer disabled:opacity-50 ${isStaleEmpty
                      ? 'bg-amber-600 hover:bg-amber-700 text-white'
                      : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                    }`}
                >
                  <MagnifyingGlass size={14} weight="bold" />
                  <span>
                    {isScraping
                      ? 'Refreshing Listings...'
                      : isRateGuardActive
                        ? 'Rate-Limit Cooldown'
                        : isStaleEmpty
                          ? 'Refresh Listings'
                          : 'Refresh Listings (Scrape P24)'}
                  </span>
                </button>
              )}
            </div>
          );
        })()}
      </div>
    </aside>
  );
}
