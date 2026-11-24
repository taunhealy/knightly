import React from 'react';
import {
  MapPin,
  CaretDown,
  X,
  MagnifyingGlass,
  Trash,
  Plus,
  FloppyDisk,
  SlidersHorizontal,
  Ruler,
  Coffee,
  Waves,
  Tree,
  Target,
  Check,
  Compass,
  Sparkle,
  CircleNotch,
} from '@phosphor-icons/react';
import { Dumbbell, ShoppingBag } from 'lucide-react';
import type { SavedSearch, CommuteAnchor } from '@/constants/locations';
import { resolveLocationCoords, type PlaceSuggestion } from '@/lib/geo';
import { formatPriceAbbr } from '@/lib/forensicAudit';
import { FilterPillsBar, type FilterPillsBarProps } from '@/components/search/FilterPillsBar';

export interface SearchCriteriaBarProps {
  // Refs
  savedSearchMenuRef: React.RefObject<HTMLDivElement | null>;
  budgetMenuRef: React.RefObject<HTMLDivElement | null>;
  sizeMenuRef: React.RefObject<HTMLDivElement | null>;
  anchorMenuRef: React.RefObject<HTMLDivElement | null>;

  // Saved searches / Areas
  isSavedSearchMenuOpen: boolean;
  setIsSavedSearchMenuOpen: (open: boolean) => void;
  savedSearches: SavedSearch[];
  activeSavedSearchId: string;
  areaMenuFilter: string;
  setAreaMenuFilter: (val: string) => void;
  applySavedSearch: (preset: SavedSearch) => void;
  handleDeleteSavedSearch: (id: string, e: React.MouseEvent) => void;
  isSavingSearch: boolean;
  setIsSavingSearch: (val: boolean) => void;
  newSearchName: string;
  setNewSearchName: (val: string) => void;
  handleSaveCurrentSearch: () => void;
  setSelectedPropertyId: (id: string | null) => void;
  setSelectedSuburbs: (suburbs: string[]) => void;
  setFocusTarget: (target: { lat: number; lng: number; zoom: number; timestamp: number }) => void;

  // Budget
  isBudgetMenuOpen: boolean;
  setIsBudgetMenuOpen: (open: boolean) => void;
  minPrice: string;
  setMinPrice: (val: string) => void;
  maxPrice: string;
  setMaxPrice: (val: string) => void;
  displayPropertiesCount: number;

  // Bedrooms & Size
  bedrooms: string;
  setBedrooms: (val: string) => void;
  isSizeMenuOpen: boolean;
  setIsSizeMenuOpen: (open: boolean) => void;
  minSqm: number;
  setMinSqm: (val: number) => void;

  // Anchors & Radius
  isAnchorMenuOpen: boolean;
  setIsAnchorMenuOpen: (open: boolean) => void;
  activeAnchor: CommuteAnchor | null | undefined;
  activeAnchorId: string;
  setActiveAnchorId: (id: string) => void;
  activeTemplate: SavedSearch | undefined;
  withinRadiusFilter: boolean;
  setWithinRadiusFilter: (val: boolean) => void;
  locationRadiusKm: number;
  setLocationRadiusKm: (val: number) => void;
  templateGyms: CommuteAnchor[];
  templateCafes: CommuteAnchor[];
  templateShops: CommuteAnchor[];
  templateAttractions: CommuteAnchor[];
  otherAnchors: CommuteAnchor[];
  newAnchorLabel: string;
  setNewAnchorLabel: (val: string) => void;
  isAnchorInputFocused: boolean;
  setIsAnchorInputFocused: (val: boolean) => void;
  anchorAutoIndex: number;
  setAnchorAutoIndex: React.Dispatch<React.SetStateAction<number>>;
  anchorSuggestions: PlaceSuggestion[];
  handleSelectSuggestedPlace: (place: PlaceSuggestion) => void;
  handleAddCustomAnchor: () => void;

  // Suburb pills & autocomplete
  selectedSuburbs: string[];
  handleFocusSuburb: (suburb: string) => void;
  handleRemoveSuburb: (suburb: string) => void;
  suburbInput: string;
  setSuburbInput: (val: string) => void;
  isInputFocused: boolean;
  setIsInputFocused: (val: boolean) => void;
  autoIndex: number;
  setAutoIndex: React.Dispatch<React.SetStateAction<number>>;
  autocompleteSuggestions: { name: string; region: string }[];
  handleAddSuburb: (suburb: string) => void;

  // Primary actions
  setIsAiModalOpen: (open: boolean) => void;
  handleScrapeP24: () => void;
  isScraping: boolean;
  isRateGuardActive: boolean;

  // Row 3 filter pills
  filterPillsProps: FilterPillsBarProps;
}

export function SearchCriteriaBar({
  savedSearchMenuRef,
  budgetMenuRef,
  sizeMenuRef,
  anchorMenuRef,
  isSavedSearchMenuOpen,
  setIsSavedSearchMenuOpen,
  savedSearches,
  activeSavedSearchId,
  areaMenuFilter,
  setAreaMenuFilter,
  applySavedSearch,
  handleDeleteSavedSearch,
  isSavingSearch,
  setIsSavingSearch,
  newSearchName,
  setNewSearchName,
  handleSaveCurrentSearch,
  setSelectedPropertyId,
  setSelectedSuburbs,
  setFocusTarget,
  isBudgetMenuOpen,
  setIsBudgetMenuOpen,
  minPrice,
  setMinPrice,
  maxPrice,
  setMaxPrice,
  displayPropertiesCount,
  bedrooms,
  setBedrooms,
  isSizeMenuOpen,
  setIsSizeMenuOpen,
  minSqm,
  setMinSqm,
  isAnchorMenuOpen,
  setIsAnchorMenuOpen,
  activeAnchor,
  activeAnchorId,
  setActiveAnchorId,
  activeTemplate,
  withinRadiusFilter,
  setWithinRadiusFilter,
  locationRadiusKm,
  setLocationRadiusKm,
  templateGyms,
  templateCafes,
  templateShops,
  templateAttractions,
  otherAnchors,
  newAnchorLabel,
  setNewAnchorLabel,
  isAnchorInputFocused,
  setIsAnchorInputFocused,
  anchorAutoIndex,
  setAnchorAutoIndex,
  anchorSuggestions,
  handleSelectSuggestedPlace,
  handleAddCustomAnchor,
  selectedSuburbs,
  handleFocusSuburb,
  handleRemoveSuburb,
  suburbInput,
  setSuburbInput,
  isInputFocused,
  setIsInputFocused,
  autoIndex,
  setAutoIndex,
  autocompleteSuggestions,
  handleAddSuburb,
  setIsAiModalOpen,
  handleScrapeP24,
  isScraping,
  isRateGuardActive,
  filterPillsProps,
}: SearchCriteriaBarProps) {
  return (
    <header className="sticky top-0 w-full bg-white/98 backdrop-blur-md border-b border-zinc-200 z-[100] px-3 py-2 shadow-xs shrink-0">
      <div className="w-full flex items-center justify-between flex-wrap gap-2">

        {/* Left Group: Areas & Core Property Selectors */}
        <div className="flex items-center flex-wrap gap-1.5 min-w-0">
          {/* 0. Areas (Area Group Templates Selector) */}
          <div className="relative shrink-0 flex items-center" ref={savedSearchMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsSavedSearchMenuOpen(!isSavedSearchMenuOpen);
                setIsAnchorMenuOpen(false);
                setIsBudgetMenuOpen(false);
              }}
              className="h-7 flex items-center gap-1.5 px-2.5 rounded-xl text-[11px] font-extrabold bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 border border-zinc-200 transition-all cursor-pointer shadow-2xs leading-none"
              title="Switch or Save Area Group Templates"
            >
              <MapPin size={13} weight="fill" className="text-indigo-600 shrink-0" />
              <span className="text-[10px] font-black uppercase tracking-wider text-zinc-400">Areas:</span>
              <span className="truncate max-w-[210px]">
                {savedSearches.find(s => s.id === activeSavedSearchId)?.name || 'Select Area Group'}
              </span>
              <CaretDown size={11} weight="bold" className="text-zinc-500 shrink-0" />
            </button>

            {/* Areas (Templates) Dropdown Popover */}
            {isSavedSearchMenuOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-3 z-[110] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <span className="font-extrabold text-xs text-zinc-950 flex items-center gap-1.5">
                    <MapPin size={14} className="text-indigo-600" weight="fill" />
                    Areas (Suburb Group Templates)
                  </span>
                  <button
                    onClick={() => {
                      setIsSavedSearchMenuOpen(false);
                      setAreaMenuFilter('');
                    }}
                    className="text-zinc-400 hover:text-zinc-700 p-0.5 cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Quick Area / Suburb Search Input */}
                <div className="relative pt-2">
                  <MagnifyingGlass size={13} weight="bold" className="absolute left-2.5 top-[18px] text-zinc-400 pointer-events-none" />
                  <input
                    type="text"
                    value={areaMenuFilter}
                    onChange={(e) => setAreaMenuFilter(e.target.value)}
                    placeholder="Filter areas or type a suburb..."
                    autoFocus
                    className="w-full pl-8 pr-7 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs text-zinc-900 focus:bg-white focus:outline-none focus:border-indigo-500"
                  />
                  {areaMenuFilter && (
                    <button
                      type="button"
                      onClick={() => setAreaMenuFilter('')}
                      className="absolute right-2 top-[17px] text-zinc-400 hover:text-zinc-700 p-0.5 cursor-pointer"
                      aria-label="Clear area filter"
                    >
                      <X size={12} weight="bold" />
                    </button>
                  )}
                </div>

                {(() => {
                  const q = areaMenuFilter.trim().toLowerCase();
                  const filteredPresets = savedSearches.filter(
                    (preset) =>
                      !q ||
                      preset.name.toLowerCase().includes(q) ||
                      preset.suburbs.some((s) => s.toLowerCase().includes(q))
                  );
                  const allKnownSuburbs = Array.from(
                    new Set([
                      ...savedSearches.flatMap((s) => s.suburbs),
                      'Llandudno', 'Noordhoek', 'Kommetjie', 'Scarborough', 'Tokai', 'Kenilworth', 'Wynberg', 'Plumstead',
                    ])
                  );
                  const matchingSuburbs = q
                    ? allKnownSuburbs.filter((s) => s.toLowerCase().includes(q)).slice(0, 5)
                    : [];

                  return (
                    <div className="max-h-64 overflow-y-auto space-y-1.5 py-2">
                      {matchingSuburbs.length > 0 && (
                        <div className="pb-1.5 mb-1.5 border-b border-zinc-100 space-y-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 px-1">
                            Jump to Suburb
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {matchingSuburbs.map((sub) => (
                              <button
                                key={sub}
                                type="button"
                                onClick={() => {
                                  setSelectedPropertyId(null);
                                  setSelectedSuburbs([sub]);
                                  const coords = resolveLocationCoords(sub);
                                  if (coords) {
                                    setFocusTarget({ lat: coords.lat, lng: coords.lng, zoom: 13.5, timestamp: Date.now() });
                                  }
                                  setIsSavedSearchMenuOpen(false);
                                  setAreaMenuFilter('');
                                }}
                                className="px-2.5 py-1 rounded-full bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-[11px] font-bold text-indigo-900 cursor-pointer transition-colors"
                              >
                                + {sub}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {filteredPresets.length === 0 && matchingSuburbs.length === 0 ? (
                        <div className="py-4 text-center text-[11px] text-zinc-500">
                          No matching area groups for &ldquo;{areaMenuFilter}&rdquo;
                        </div>
                      ) : (
                        filteredPresets.map((preset) => (
                          <div
                            key={preset.id}
                            onClick={() => {
                              applySavedSearch(preset);
                              setAreaMenuFilter('');
                            }}
                            className={`p-2.5 rounded-xl text-xs cursor-pointer transition-all border ${activeSavedSearchId === preset.id
                              ? 'bg-indigo-50 border-indigo-200 text-indigo-950 font-bold shadow-2xs'
                              : 'bg-zinc-50/60 hover:bg-zinc-100 border-zinc-200/60 text-zinc-700'
                              }`}
                          >
                            <div className="flex items-center justify-between gap-1 mb-1">
                              <span className="font-extrabold text-xs text-zinc-950 truncate">{preset.name}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="px-1.5 py-0.5 rounded-md bg-indigo-100/80 text-indigo-800 text-[9px] font-black">
                                  {preset.suburbs.length} {preset.suburbs.length === 1 ? 'area' : 'areas'}
                                </span>
                                {preset.isCustom && (
                                  <button
                                    type="button"
                                    onClick={(e) => handleDeleteSavedSearch(preset.id, e)}
                                    className="text-zinc-400 hover:text-rose-600 p-1"
                                    title="Delete area template"
                                  >
                                    <Trash size={12} weight="bold" />
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center flex-wrap gap-1 mt-1">
                              {preset.suburbs.map((sub) => (
                                <span
                                  key={sub}
                                  className="px-1.5 py-0.5 rounded-md bg-white border border-zinc-200/80 text-[10px] font-semibold text-zinc-600"
                                >
                                  {sub}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  );
                })()}

                {/* Save Current Area Group Form */}
                <div className="pt-2 border-t border-zinc-100">
                  {!isSavingSearch ? (
                    <button
                      type="button"
                      onClick={() => setIsSavingSearch(true)}
                      className="w-full py-1.5 px-3 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Plus size={13} weight="bold" className="text-indigo-600" />
                      <span>Save Current Areas As Template</span>
                    </button>
                  ) : (
                    <div className="space-y-1.5 animate-in fade-in duration-100">
                      <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">Area Group Name:</span>
                      <input
                        type="text"
                        placeholder="e.g. Atlantic Seaboard & Surfs"
                        value={newSearchName}
                        onChange={(e) => setNewSearchName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCurrentSearch();
                        }}
                        className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-indigo-600"
                        autoFocus
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handleSaveCurrentSearch}
                          className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-pointer"
                        >
                          <FloppyDisk size={13} weight="bold" />
                          <span>Save Areas</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSavingSearch(false);
                            setNewSearchName('');
                          }}
                          className="px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 1. Budget Interactive Dual-Slider Filter (In & Out Points) */}
          <div className="relative shrink-0 flex items-center" ref={budgetMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsBudgetMenuOpen(!isBudgetMenuOpen);
                setIsSavedSearchMenuOpen(false);
                setIsAnchorMenuOpen(false);
              }}
              className={`h-7 w-[172px] sm:w-[185px] shrink-0 flex items-center justify-between gap-1 px-2.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer leading-none shadow-2xs ${isBudgetMenuOpen
                ? 'bg-zinc-950 text-white border-zinc-950 ring-2 ring-zinc-950/20 shadow-xs'
                : (minPrice && minPrice !== '0') || (maxPrice && maxPrice !== '50000' && maxPrice !== '999999')
                  ? 'bg-indigo-50 hover:bg-indigo-100/70 border-indigo-300 text-indigo-950 font-extrabold'
                  : 'bg-zinc-100 hover:bg-zinc-200/80 border-zinc-200 text-zinc-700'
                }`}
              title="Click to adjust monthly budget range with in & out slider handles"
            >
              <div className="flex items-center gap-1 min-w-0 truncate">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider shrink-0">Budget:</span>
                <span className="font-extrabold tabular-nums truncate">
                  {(() => {
                    const minNum = parseInt(minPrice) || 0;
                    const maxNum = parseInt(maxPrice) || 0;
                    if (!minNum && (!maxNum || maxNum >= 50000)) return 'Any';
                    if (!minNum && maxNum) return `< R ${formatPriceAbbr(maxNum)}`;
                    if (minNum && (!maxNum || maxNum >= 50000)) return `> R ${formatPriceAbbr(minNum)}`;
                    return `R ${formatPriceAbbr(minNum)} – R ${formatPriceAbbr(maxNum)}`;
                  })()}
                </span>
              </div>
              <SlidersHorizontal size={12} weight="bold" className={`shrink-0 ${isBudgetMenuOpen ? 'text-indigo-400' : 'text-zinc-500'}`} />
            </button>

            {/* Budget Slider Popover with In & Out points */}
            {isBudgetMenuOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-2 w-80 sm:w-88 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 p-4 z-[110] animate-in fade-in zoom-in-95 duration-150 select-none"
              >
                {/* Popover Header */}
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                      <SlidersHorizontal size={14} weight="bold" />
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-zinc-950 block">Monthly Budget</span>
                      <span className="text-[10px] text-zinc-400 font-medium block">Drag in &amp; out points to filter</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsBudgetMenuOpen(false)}
                    className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 transition-colors cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* In-Point (Min) and Out-Point (Max) Input Boxes */}
                {(() => {
                  const SLIDER_MIN = 5000;
                  const SLIDER_MAX = 50000;
                  const SLIDER_STEP = 500;
                  const currMin = parseInt(minPrice) || SLIDER_MIN;
                  const currMax = parseInt(maxPrice) || SLIDER_MAX;
                  const clampedMin = Math.max(SLIDER_MIN, Math.min(currMin, SLIDER_MAX - SLIDER_STEP));
                  const clampedMax = Math.max(clampedMin + SLIDER_STEP, Math.min(currMax, SLIDER_MAX));
                  const minPercent = ((clampedMin - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;
                  const maxPercent = ((clampedMax - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * 100;

                  return (
                    <div className="py-3.5 space-y-4">
                      {/* Dual Number Display / Inputs */}
                      <div className="flex items-center gap-2.5">
                        <div className="flex-1 p-2 rounded-xl bg-zinc-50 border border-zinc-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                          <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">
                            In-Point (Min)
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs font-black text-indigo-600">R</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={minPrice}
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9]/g, '');
                                setMinPrice(v);
                              }}
                              className="w-full text-xs font-black tabular-nums text-zinc-900 bg-transparent focus:outline-none"
                              placeholder="5000"
                            />
                          </div>
                        </div>

                        <div className="text-zinc-400 font-black text-xs shrink-0">to</div>

                        <div className="flex-1 p-2 rounded-xl bg-zinc-50 border border-zinc-200 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
                          <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400">
                            Out-Point (Max)
                          </span>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-xs font-black text-indigo-600">R</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={maxPrice}
                              onChange={(e) => {
                                const v = e.target.value.replace(/[^0-9]/g, '');
                                setMaxPrice(v);
                              }}
                              className="w-full text-xs font-black tabular-nums text-zinc-900 bg-transparent focus:outline-none"
                              placeholder="50000"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Dual-Handle Range Slider (In-point & Out-point) */}
                      <div className="relative pt-2 pb-1 px-1">
                        {/* Background Base Track */}
                        <div className="relative h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                          <div
                            className="absolute h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full"
                            style={{
                              left: `${minPercent}%`,
                              width: `${Math.max(0, maxPercent - minPercent)}%`,
                            }}
                          />
                        </div>

                        {/* In-Point Range Input (Min) */}
                        <input
                          type="range"
                          min={SLIDER_MIN}
                          max={SLIDER_MAX}
                          step={SLIDER_STEP}
                          value={clampedMin}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const nextMin = Math.min(val, clampedMax - SLIDER_STEP);
                            setMinPrice(String(nextMin));
                          }}
                          style={{ zIndex: clampedMin > (SLIDER_MAX - SLIDER_MIN) * 0.7 ? 35 : 25 }}
                          className="absolute inset-x-1 top-1.5 w-[calc(100%-8px)] h-3 appearance-none bg-transparent pointer-events-none
                                [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                                [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full
                                [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-indigo-600
                                [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                                [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[2.5px]
                                [&::-moz-range-thumb]:border-indigo-600 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab
                                [&::-moz-range-thumb]:active:cursor-grabbing"
                          aria-label="Minimum price in-point slider"
                        />

                        {/* Out-Point Range Input (Max) */}
                        <input
                          type="range"
                          min={SLIDER_MIN}
                          max={SLIDER_MAX}
                          step={SLIDER_STEP}
                          value={clampedMax}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            const nextMax = Math.max(val, clampedMin + SLIDER_STEP);
                            setMaxPrice(String(nextMax));
                          }}
                          style={{ zIndex: clampedMin > (SLIDER_MAX - SLIDER_MIN) * 0.7 ? 25 : 35 }}
                          className="absolute inset-x-1 top-1.5 w-[calc(100%-8px)] h-3 appearance-none bg-transparent pointer-events-none
                                [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none
                                [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:rounded-full
                                [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[2.5px] [&::-webkit-slider-thumb]:border-indigo-600
                                [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:active:cursor-grabbing
                                [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5
                                [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[2.5px]
                                [&::-moz-range-thumb]:border-indigo-600 [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab
                                [&::-moz-range-thumb]:active:cursor-grabbing"
                          aria-label="Maximum price out-point slider"
                        />

                        {/* Scale Markers */}
                        <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 mt-3 px-0.5">
                          <span>R 5k</span>
                          <span>R 15k</span>
                          <span>R 25k</span>
                          <span>R 35k</span>
                          <span>R 50k+</span>
                        </div>
                      </div>

                      {/* Quick Presets */}
                      <div className="pt-2.5 border-t border-zinc-100">
                        <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                          Quick Presets
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {[
                            { label: '< R 12k', min: '5000', max: '12000' },
                            { label: 'R 10k–16k', min: '10000', max: '16000' },
                            { label: 'R 14k–20k', min: '14000', max: '20000' },
                            { label: 'R 18k–30k', min: '18000', max: '30000' },
                            { label: 'Any', min: '5000', max: '50000' },
                          ].map((preset) => {
                            const isSelected = minPrice === preset.min && maxPrice === preset.max;
                            return (
                              <button
                                key={preset.label}
                                type="button"
                                onClick={() => {
                                  setMinPrice(preset.min);
                                  setMaxPrice(preset.max);
                                }}
                                className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${isSelected
                                  ? 'bg-indigo-600 text-white shadow-2xs'
                                  : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                                  }`}
                              >
                                {preset.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Popover Footer: Live Count & Done Button */}
                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-500">
                    <strong className="text-zinc-950 font-extrabold tabular-nums inline-block min-w-[14px]">{displayPropertiesCount}</strong> listings in range
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsBudgetMenuOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className="h-7 flex items-center gap-1 bg-zinc-100 px-2.5 rounded-xl text-[11px] border border-zinc-200 leading-none">
            <span className="text-[10px] font-bold text-zinc-400">Beds:</span>
            <select
              value={bedrooms}
              onChange={(e) => setBedrooms(e.target.value)}
              className="font-bold text-zinc-800 bg-transparent focus:outline-none cursor-pointer leading-none"
            >
              <option value="0.5+">0.5+ Bed</option>
              <option value="1+">1+ Bed</option>
              <option value="2+">2+ Beds</option>
              <option value="3+">3+ Beds</option>
              <option value="any">Any</option>
            </select>
          </div>

          {/* 2B. Minimum Size (sqm) Slider Filter */}
          <div className="relative shrink-0 flex items-center" ref={sizeMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsSizeMenuOpen(!isSizeMenuOpen);
                setIsBudgetMenuOpen(false);
                setIsSavedSearchMenuOpen(false);
                setIsAnchorMenuOpen(false);
              }}
              className={`h-7 shrink-0 flex items-center justify-between gap-1.5 px-2.5 rounded-xl text-[11px] font-bold border transition-colors cursor-pointer leading-none shadow-2xs ${isSizeMenuOpen
                ? 'bg-zinc-950 text-white border-zinc-950 ring-2 ring-zinc-950/20 shadow-xs'
                : minSqm > 0
                  ? 'bg-indigo-50 hover:bg-indigo-100/70 border-indigo-300 text-indigo-950 font-extrabold'
                  : 'bg-zinc-100 hover:bg-zinc-200/80 border-zinc-200 text-zinc-700'
                }`}
              title="Filter by minimum floor size in square metres (m²)"
            >
              <div className="flex items-center gap-1 whitespace-nowrap">
                <Ruler size={12} weight="bold" className={isSizeMenuOpen ? 'text-indigo-400' : minSqm > 0 ? 'text-indigo-600' : 'text-zinc-500'} />
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Size:</span>
                <span className="font-extrabold tabular-nums">
                  {minSqm > 0 ? `${minSqm}+ m²` : 'Any'}
                </span>
              </div>
              <CaretDown size={10} weight="bold" className={`shrink-0 ${isSizeMenuOpen ? 'text-indigo-400' : 'text-zinc-500'}`} />
            </button>

            {/* Minimum Size Slider Popover */}
            {isSizeMenuOpen && (
              <div
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                className="absolute left-0 top-full mt-2 w-72 sm:w-80 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 p-4 z-[110] animate-in fade-in zoom-in-95 duration-150 select-none"
              >
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-xl bg-indigo-50 border border-indigo-200/60 flex items-center justify-center text-indigo-600">
                      <Ruler size={14} weight="bold" />
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs text-zinc-950 leading-tight">Minimum Floor Size</h4>
                      <p className="text-[10px] text-zinc-400 font-medium">Drag slider to filter by minimum m²</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSizeMenuOpen(false)}
                    className="text-zinc-400 hover:text-zinc-700 p-1 rounded-lg hover:bg-zinc-100 cursor-pointer"
                  >
                    <X size={14} weight="bold" />
                  </button>
                </div>

                <div className="py-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">
                      Minimum Size
                    </span>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-zinc-50 border border-zinc-200">
                      <input
                        type="number"
                        min={0}
                        max={200}
                        step={5}
                        value={minSqm}
                        onChange={(e) => setMinSqm(Math.max(0, Math.min(200, parseInt(e.target.value) || 0)))}
                        className="w-12 text-xs font-black text-zinc-950 bg-transparent focus:outline-none text-right tabular-nums"
                      />
                      <span className="text-[11px] font-bold text-zinc-500">m²</span>
                    </div>
                  </div>

                  {/* Interactive Range Slider */}
                  <div className="relative pt-1 pb-1">
                    <div className="relative h-2 w-full bg-zinc-200 rounded-full overflow-hidden">
                      <div
                        className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full"
                        style={{ width: `${Math.min(100, (minSqm / 120) * 100)}%` }}
                      />
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={120}
                      step={5}
                      value={Math.min(120, minSqm)}
                      onChange={(e) => setMinSqm(Number(e.target.value))}
                      className="absolute inset-x-0 top-0 w-full h-4 appearance-none bg-transparent cursor-pointer
                            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:h-5
                            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-[2.5px]
                            [&::-webkit-slider-thumb]:border-indigo-600 [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:cursor-grab
                            [&::-webkit-slider-thumb]:active:cursor-grabbing
                            [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:rounded-full
                            [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-[2.5px] [&::-moz-range-thumb]:border-indigo-600
                            [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:cursor-grab"
                      aria-label="Minimum size in square metres"
                    />
                    <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-400 mt-3 px-0.5">
                      <span>Any</span>
                      <span>40m²</span>
                      <span>55m²</span>
                      <span>75m²</span>
                      <span>100m²+</span>
                    </div>
                  </div>

                  {/* Quick Size Presets */}
                  <div className="pt-2.5 border-t border-zinc-100">
                    <span className="block text-[9.5px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      Quick Size Presets
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { label: 'Any', val: 0 },
                        { label: '45+ m²', val: 45 },
                        { label: '55+ m²', val: 55 },
                        { label: '65+ m²', val: 65 },
                        { label: '80+ m²', val: 80 },
                        { label: '100+ m²', val: 100 },
                      ].map((preset) => {
                        const isSelected = minSqm === preset.val;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => setMinSqm(preset.val)}
                            className={`px-2 py-1 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer ${isSelected
                              ? 'bg-indigo-600 text-white shadow-2xs'
                              : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'
                              }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-zinc-100 flex items-center justify-between">
                  <span className="text-[11px] font-medium text-zinc-500">
                    <strong className="text-zinc-950 font-extrabold tabular-nums inline-block min-w-[14px]">{displayPropertiesCount}</strong> listings match
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsSizeMenuOpen(false)}
                    className="px-3.5 py-1.5 rounded-xl bg-zinc-950 hover:bg-zinc-800 text-white text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 3. Desirable Locations & Trailheads Button */}
          <div className="relative flex items-center" ref={anchorMenuRef}>
            <button
              type="button"
              onClick={() => {
                setIsAnchorMenuOpen(!isAnchorMenuOpen);
                setIsSavedSearchMenuOpen(false);
                setIsBudgetMenuOpen(false);
                setIsSizeMenuOpen(false);
              }}
              title={
                activeAnchor
                  ? withinRadiusFilter
                    ? `Filtering properties within ${locationRadiusKm.toFixed(1)} km of ${activeAnchor.label}. Click to change location or mode.`
                    : `Ranking properties near ${activeAnchor.label} (≤${locationRadiusKm.toFixed(1)} km boosted, all shown). Click to change location or mode.`
                  : 'Select an attraction or amenity anchor'
              }
              className={`h-7 flex items-center gap-1.5 px-2.5 rounded-xl text-[11px] font-bold border transition-all cursor-pointer leading-none ${activeAnchor
                ? withinRadiusFilter
                  ? 'bg-indigo-50 border-indigo-400 text-indigo-950 shadow-xs ring-1 ring-indigo-500/25'
                  : activeAnchor.iconType === 'gym'
                    ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-xs'
                    : activeAnchor.iconType === 'cafe'
                      ? 'bg-orange-50 border-orange-300 text-orange-950 shadow-xs'
                      : activeAnchor.iconType === 'shop'
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                        : activeAnchor.iconType === 'surf' || activeAnchor.iconType === 'beach'
                          ? 'bg-cyan-50 border-cyan-300 text-cyan-950 shadow-xs'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-950 shadow-xs'
                : 'bg-zinc-100 border-zinc-200 text-zinc-700'
                }`}
            >
              {activeAnchor?.iconType === 'gym' ? (
                <Dumbbell size={13} className="text-amber-600 shrink-0" />
              ) : activeAnchor?.iconType === 'cafe' ? (
                <Coffee size={13} weight="fill" className="text-orange-600 shrink-0" />
              ) : activeAnchor?.iconType === 'shop' ? (
                <ShoppingBag size={13} className="text-emerald-600 shrink-0" />
              ) : activeAnchor?.iconType === 'surf' || activeAnchor?.iconType === 'beach' ? (
                <Waves size={13} weight="fill" className="text-cyan-600 shrink-0" />
              ) : activeAnchor?.iconType === 'trail' ? (
                <Tree size={13} weight="bold" className="text-emerald-600 shrink-0" />
              ) : (
                <Target size={13} weight="bold" className="text-indigo-600 shrink-0" />
              )}
              <span className="truncate max-w-[125px]">{activeAnchor ? activeAnchor.label : 'Select Attraction'}</span>
              {activeAnchor ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    setWithinRadiusFilter(!withinRadiusFilter);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setWithinRadiusFilter(!withinRadiusFilter);
                    }
                  }}
                  title={
                    withinRadiusFilter
                      ? `Filter mode ON (hiding properties > ${locationRadiusKm.toFixed(1)} km). Click to switch to Rank only.`
                      : `Rank mode ON (showing all properties, boosting ≤ ${locationRadiusKm.toFixed(1)} km). Click to switch to Filter.`
                  }
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold leading-none tabular-nums transition-colors ${withinRadiusFilter
                    ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                    : 'bg-white/85 text-zinc-700 border border-zinc-200/80 hover:bg-zinc-100'
                    }`}
                >
                  ≤{locationRadiusKm.toFixed(1)} km · {withinRadiusFilter ? 'Filter' : 'Rank'}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 bg-zinc-200/80 rounded-md text-[10px] font-extrabold text-zinc-800 leading-none">
                  {templateAttractions.length + templateGyms.length + templateCafes.length + templateShops.length}
                </span>
              )}
            </button>

            {/* Anchor Dropdown Popover */}
            {isAnchorMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-84 bg-white rounded-2xl shadow-2xl border border-zinc-200 p-3 z-[110] animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-2 border-b border-zinc-100">
                  <span className="font-extrabold text-xs text-zinc-950 flex items-center gap-1.5">
                    <Compass size={14} className="text-indigo-600" weight="bold" />
                    Amenities & POIs · {activeTemplate?.name ? activeTemplate.name.replace(/^[^\w\s]+\s*/, '') : 'Area'}
                  </span>
                  <button onClick={() => setIsAnchorMenuOpen(false)} className="text-zinc-400 hover:text-zinc-700 p-0.5">
                    <X size={14} />
                  </button>
                </div>

                {activeAnchor && (
                  <div className="py-2 border-b border-zinc-100 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                        Radius Mode (≤{locationRadiusKm.toFixed(1)} km)
                      </div>
                      <div className="text-[10px] text-zinc-400 truncate">
                        {withinRadiusFilter ? 'Hiding properties outside circle' : 'Showing all · boosting inside circle'}
                      </div>
                    </div>
                    <div className="flex items-center p-0.5 rounded-lg bg-zinc-100 border border-zinc-200 shrink-0">
                      <button
                        type="button"
                        onClick={() => setWithinRadiusFilter(false)}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${!withinRadiusFilter
                          ? 'bg-white text-zinc-950 shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-800'
                          }`}
                      >
                        Rank
                      </button>
                      <button
                        type="button"
                        onClick={() => setWithinRadiusFilter(true)}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all cursor-pointer ${withinRadiusFilter
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'text-zinc-500 hover:text-zinc-800'
                          }`}
                      >
                        Filter
                      </button>
                    </div>
                  </div>
                )}

                <div className="max-h-80 overflow-y-auto space-y-3 py-2 pr-1">
                  {/* 1. Gyms Group */}
                  {templateGyms.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-amber-700">
                        <span className="flex items-center gap-1">
                          <Dumbbell size={11} /> Gyms in Area
                        </span>
                        <span className="bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                          {templateGyms.length}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {templateGyms.map((anc) => (
                          <div
                            key={anc.id}
                            onClick={() => {
                              setActiveAnchorId(anc.id);
                              setIsAnchorMenuOpen(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                              ? 'bg-amber-50 text-amber-950 font-bold border border-amber-300'
                              : 'hover:bg-zinc-50 text-zinc-700'
                              }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Dumbbell size={14} className="text-amber-600 shrink-0" />
                              <span className="truncate">{anc.label}</span>
                            </div>
                            {activeAnchorId === anc.id && (
                              <Check size={14} weight="bold" className="text-amber-600 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 2. Cafes & Bakeries Group */}
                  {templateCafes.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-orange-700">
                        <span className="flex items-center gap-1">
                          <Coffee size={11} weight="fill" /> Cafes & Bakeries
                        </span>
                        <span className="bg-orange-100 text-orange-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                          {templateCafes.length}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {templateCafes.map((anc) => (
                          <div
                            key={anc.id}
                            onClick={() => {
                              setActiveAnchorId(anc.id);
                              setIsAnchorMenuOpen(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                              ? 'bg-orange-50 text-orange-950 font-bold border border-orange-300'
                              : 'hover:bg-zinc-50 text-zinc-700'
                              }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <Coffee size={14} weight="fill" className="text-orange-600 shrink-0" />
                              <span className="truncate">{anc.label}</span>
                            </div>
                            {activeAnchorId === anc.id && (
                              <Check size={14} weight="bold" className="text-orange-600 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 3. Shops & Retail Centres Group */}
                  {templateShops.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                        <span className="flex items-center gap-1">
                          <ShoppingBag size={11} /> Shops & Retail
                        </span>
                        <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                          {templateShops.length}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {templateShops.map((anc) => (
                          <div
                            key={anc.id}
                            onClick={() => {
                              setActiveAnchorId(anc.id);
                              setIsAnchorMenuOpen(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                              ? 'bg-emerald-50 text-emerald-950 font-bold border border-emerald-300'
                              : 'hover:bg-zinc-50 text-zinc-700'
                              }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <ShoppingBag size={14} className="text-emerald-600 shrink-0" />
                              <span className="truncate">{anc.label}</span>
                            </div>
                            {activeAnchorId === anc.id && (
                              <Check size={14} weight="bold" className="text-emerald-600 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 4. Main Outdoors & Attractions */}
                  {templateAttractions.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-cyan-800">
                        <span className="flex items-center gap-1">
                          <Waves size={11} weight="bold" /> Outdoors & Attractions
                        </span>
                        <span className="bg-cyan-100 text-cyan-800 px-1.5 py-0.2 rounded-md font-black text-[9px]">
                          {templateAttractions.length}
                        </span>
                      </div>
                      <div className="space-y-1">
                        {templateAttractions.map((anc) => (
                          <div
                            key={anc.id}
                            onClick={() => {
                              setActiveAnchorId(anc.id);
                              setIsAnchorMenuOpen(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                              ? 'bg-cyan-50 text-cyan-950 font-bold border border-cyan-300'
                              : 'hover:bg-zinc-50 text-zinc-700'
                              }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {anc.iconType === 'trail' ? (
                                <Tree size={14} weight="fill" className="text-emerald-600 shrink-0" />
                              ) : anc.iconType === 'surf' || anc.iconType === 'beach' ? (
                                <Waves size={14} weight="fill" className="text-cyan-600 shrink-0" />
                              ) : anc.iconType === 'cafe' ? (
                                <Coffee size={14} weight="fill" className="text-amber-600 shrink-0" />
                              ) : (
                                <Compass size={14} weight="bold" className="text-indigo-600 shrink-0" />
                              )}
                              <span className="truncate">{anc.label}</span>
                            </div>
                            {activeAnchorId === anc.id && (
                              <Check size={14} weight="bold" className="text-cyan-600 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 5. Other Regional Hubs */}
                  {otherAnchors.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between px-1 mb-1 text-[10px] font-extrabold uppercase tracking-wider text-zinc-400">
                        <span>Other Regional Hubs</span>
                        <span className="text-[9px] font-bold text-zinc-400">{otherAnchors.length}</span>
                      </div>
                      <div className="space-y-1">
                        {otherAnchors.slice(0, 6).map((anc) => (
                          <div
                            key={anc.id}
                            onClick={() => {
                              setActiveAnchorId(anc.id);
                              setIsAnchorMenuOpen(false);
                            }}
                            className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer transition-colors ${activeAnchorId === anc.id
                              ? 'bg-zinc-100 text-zinc-950 font-bold border border-zinc-300'
                              : 'hover:bg-zinc-50 text-zinc-600'
                              }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              {anc.iconType === 'gym' ? (
                                <Dumbbell size={14} className="text-zinc-500 shrink-0" />
                              ) : anc.iconType === 'cafe' ? (
                                <Coffee size={14} weight="fill" className="text-zinc-500 shrink-0" />
                              ) : anc.iconType === 'shop' ? (
                                <ShoppingBag size={14} className="text-zinc-500 shrink-0" />
                              ) : anc.iconType === 'trail' ? (
                                <Tree size={14} weight="fill" className="text-zinc-500 shrink-0" />
                              ) : anc.iconType === 'surf' || anc.iconType === 'beach' ? (
                                <Waves size={14} weight="fill" className="text-zinc-500 shrink-0" />
                              ) : (
                                <Target size={14} weight="bold" className="text-zinc-500 shrink-0" />
                              )}
                              <span className="truncate">{anc.label}</span>
                            </div>
                            {activeAnchorId === anc.id && (
                              <Check size={14} weight="bold" className="text-zinc-900 shrink-0" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Add Custom Spot Form with Real-Time Auto-Suggestions */}
                <div className="pt-2 border-t border-zinc-100 space-y-1.5 relative">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
                    Add Custom Location:
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Type location (e.g. Scarborough Beach, Deer Park)"
                      value={newAnchorLabel}
                      onChange={(e) => {
                        setNewAnchorLabel(e.target.value);
                        setIsAnchorInputFocused(true);
                        setAnchorAutoIndex(0);
                      }}
                      onFocus={() => setIsAnchorInputFocused(true)}
                      onBlur={() => {
                        // Delay closing so onMouseDown on suggestions registers
                        setTimeout(() => setIsAnchorInputFocused(false), 200);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setAnchorAutoIndex((prev) => (prev + 1) % Math.max(1, anchorSuggestions.length));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setAnchorAutoIndex((prev) => (prev - 1 + anchorSuggestions.length) % Math.max(1, anchorSuggestions.length));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          if (anchorSuggestions.length > 0 && anchorSuggestions[anchorAutoIndex]) {
                            handleSelectSuggestedPlace(anchorSuggestions[anchorAutoIndex]);
                          } else {
                            handleAddCustomAnchor();
                          }
                        } else if (e.key === 'Escape') {
                          setIsAnchorInputFocused(false);
                        }
                      }}
                      className="w-full text-xs px-2.5 py-1.5 rounded-xl border border-zinc-200 focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 font-medium"
                    />

                    {/* Auto-suggestions Dropdown Popover */}
                    {isAnchorInputFocused && newAnchorLabel.trim().length > 0 && anchorSuggestions.length > 0 && (
                      <div className="absolute bottom-full mb-1.5 inset-x-0 bg-white/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 p-1.5 z-[115] max-h-52 overflow-y-auto animate-in fade-in duration-100">
                        <div className="px-2 py-1 text-[9.5px] font-bold text-zinc-400 uppercase tracking-wider border-b border-zinc-100 flex items-center justify-between">
                          <span>Suggested Locations</span>
                          <span className="text-[9px] text-zinc-400 font-normal">Press Enter ↵</span>
                        </div>
                        <div className="space-y-0.5 mt-1">
                          {anchorSuggestions.map((place, idx) => (
                            <div
                              key={place.name + place.lat}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                handleSelectSuggestedPlace(place);
                              }}
                              className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center justify-between cursor-pointer transition-colors ${idx === anchorAutoIndex
                                ? 'bg-indigo-50 text-indigo-950 font-bold border border-indigo-200/80 shadow-2xs'
                                : 'hover:bg-zinc-50 text-zinc-800'
                                }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                {place.iconType === 'gym' ? (
                                  <Dumbbell size={13} className="text-amber-600 shrink-0" />
                                ) : place.iconType === 'surf' || place.iconType === 'beach' ? (
                                  <Waves size={13} weight="fill" className="text-cyan-600 shrink-0" />
                                ) : place.iconType === 'trail' ? (
                                  <Tree size={13} weight="fill" className="text-emerald-600 shrink-0" />
                                ) : place.iconType === 'cafe' ? (
                                  <Coffee size={13} weight="fill" className="text-amber-600 shrink-0" />
                                ) : (
                                  <Target size={13} weight="bold" className="text-indigo-600 shrink-0" />
                                )}
                                <div className="truncate text-left">
                                  <span className="block font-bold text-zinc-950 leading-tight truncate">{place.name}</span>
                                  <span className="block text-[10px] text-zinc-400 leading-tight truncate">{place.category}</span>
                                </div>
                              </div>
                              <span className="text-[10px] font-extrabold text-indigo-600 shrink-0 ml-1.5 bg-indigo-50 px-1.5 py-0.5 rounded-md border border-indigo-200/60">
                                + Add
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleAddCustomAnchor}
                    className="w-full py-1.5 bg-zinc-950 hover:bg-black text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
                  >
                    + Add to Map
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Inline Proximity Radius Slider (next to location dropdown) */}
          {activeAnchor && (
            <div className="h-7 flex items-center gap-1.5 px-2.5 rounded-xl bg-zinc-50 border border-zinc-200/90 shrink-0">
              <Target size={12} weight="bold" className="text-indigo-600 shrink-0" />
              <input
                type="range"
                min={1}
                max={20}
                step={0.5}
                value={locationRadiusKm}
                onChange={(e) => setLocationRadiusKm(parseFloat(e.target.value))}
                className="w-20 sm:w-24 h-1.5 bg-zinc-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 focus:outline-none"
                aria-label="Location Radius Ring Slider"
                title={`Adjust radius around ${activeAnchor.label}: ${locationRadiusKm.toFixed(1)} km`}
              />
              <span className="text-[11px] font-extrabold text-indigo-700 tabular-nums whitespace-nowrap">
                {locationRadiusKm.toFixed(1)} km
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ROW 2: Left = Selected Area Pills & "+ Add area..." | Right = Top 10 Rank & Scrape P24 */}
      <div className="w-full flex items-center justify-between flex-wrap gap-2 pt-1.5 mt-1.5 border-t border-zinc-100">
        {/* Left: Suburb Pills + Autocomplete */}
        <div className="flex items-center flex-wrap gap-1.5 min-w-0">
          {selectedSuburbs.map((suburb) => (
            <span
              key={suburb}
              onClick={() => handleFocusSuburb(suburb)}
              title={`Click to pan map to ${suburb}`}
              className="h-6 inline-flex items-center gap-1 px-2.5 rounded-full text-[11px] font-bold bg-indigo-50 hover:bg-indigo-100 active:scale-95 border border-indigo-200 hover:border-indigo-300 text-indigo-900 shrink-0 cursor-pointer transition-all leading-none group"
            >
              <span>{suburb}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemoveSuburb(suburb);
                }}
                className="hover:text-rose-600 p-0.5 rounded-full transition-colors cursor-pointer flex items-center justify-center"
                title={`Remove ${suburb}`}
              >
                <X size={10} weight="bold" />
              </button>
            </span>
          ))}

          {/* Places Autocomplete Typeahead Input */}
          <div className="relative flex items-center shrink-0">
            <input
              type="text"
              placeholder="+ Add area..."
              value={suburbInput}
              onFocus={() => {
                setIsInputFocused(true);
                setAutoIndex(0);
              }}
              onBlur={() => {
                setTimeout(() => setIsInputFocused(false), 200);
              }}
              onChange={(e) => {
                setSuburbInput(e.target.value);
                setIsInputFocused(true);
                setAutoIndex(0);
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setAutoIndex((prev) => (prev + 1) % Math.max(1, autocompleteSuggestions.length));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setAutoIndex((prev) => (prev - 1 + autocompleteSuggestions.length) % Math.max(1, autocompleteSuggestions.length));
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  if (autocompleteSuggestions.length > 0 && autocompleteSuggestions[autoIndex]) {
                    handleAddSuburb(autocompleteSuggestions[autoIndex].name);
                  } else if (suburbInput.trim()) {
                    handleAddSuburb(suburbInput);
                  }
                } else if (e.key === 'Escape') {
                  setIsInputFocused(false);
                }
              }}
              className="h-6 w-28 focus:w-44 text-[11px] px-2.5 rounded-full border border-zinc-200 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none transition-all placeholder:text-zinc-400 bg-zinc-50/80 font-medium leading-none"
            />

            {/* Autocomplete Suggestions Menu */}
            {isInputFocused && suburbInput.trim().length > 0 && (
              <div className="absolute top-full left-0 mt-1.5 w-64 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-200 py-1.5 z-[110] animate-in fade-in zoom-in-95 duration-100 overflow-hidden divide-y divide-zinc-50">
                <div className="px-3 py-1 text-[10px] font-black uppercase tracking-wider text-zinc-400 flex items-center justify-between">
                  <span>Neighborhoods</span>
                  <span className="text-[9px] text-zinc-400 font-normal">Press Enter ↵</span>
                </div>
                <div className="max-h-56 overflow-y-auto">
                  {autocompleteSuggestions.length > 0 ? (
                    autocompleteSuggestions.map((sub, idx) => (
                      <div
                        key={sub.name}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          handleAddSuburb(sub.name);
                        }}
                        className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${idx === autoIndex ? 'bg-indigo-50/90 text-indigo-950 font-bold' : 'hover:bg-zinc-50 text-zinc-800'
                          }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${idx === autoIndex ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500'}`}>
                            <MapPin size={12} weight="bold" />
                          </div>
                          <div className="truncate">
                            <span className="font-extrabold text-xs block leading-tight truncate">{sub.name}</span>
                            <span className="text-[10px] text-zinc-400 font-medium block leading-tight truncate">{sub.region}</span>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-md shrink-0">
                          + Add
                        </span>
                      </div>
                    ))
                  ) : (
                    <div
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddSuburb(suburbInput);
                      }}
                      className="px-3 py-2.5 text-xs text-zinc-500 hover:bg-zinc-50 cursor-pointer flex items-center justify-between"
                    >
                      <span className="truncate">Add &ldquo;{suburbInput.trim()}&rdquo;</span>
                      <span className="text-[10px] font-bold text-indigo-600">+ Add</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Primary Actions (Top 10 Rank & Scrape P24) */}
        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
          {/* Top 10 Data-Driven Match Ranker Button */}
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="h-7 flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-black border transition-all cursor-pointer leading-none shadow-xs bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-700 hover:to-purple-700 text-white border-indigo-500 ring-2 ring-purple-400/20 active:scale-[0.98] shrink-0 whitespace-nowrap"
            title="Configure walkable places & criteria to rank Top 10 matches locally ($0)"
          >
            <Sparkle size={13} weight="fill" className="text-amber-300 shrink-0" />
            <span>Rank Top 10</span>
          </button>

          {/* 4. SCRAPE P24 ACTION BUTTON */}
          <button
            type="button"
            onClick={handleScrapeP24}
            disabled={isScraping || isRateGuardActive}
            className={`h-7 flex items-center gap-1.5 px-3 rounded-xl text-[11px] font-extrabold shadow-md transition-all leading-none shrink-0 whitespace-nowrap ${isScraping
              ? 'bg-indigo-850 text-indigo-200 cursor-wait ring-2 ring-indigo-400'
              : isRateGuardActive
                ? 'bg-amber-600/90 text-white cursor-not-allowed opacity-90'
                : 'bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white shadow-indigo-600/20 cursor-pointer'
              }`}
            title={isRateGuardActive ? 'Rate-Limit Shield active — cooling down to prevent Property24 IP blocks' : 'Scrape Property24 live listings for selected suburbs'}
          >
            {isScraping ? (
              <CircleNotch size={13} className="animate-spin text-white shrink-0" />
            ) : (
              <Sparkle size={13} weight="fill" className="text-amber-300 shrink-0" />
            )}
            <span>{isScraping ? 'Scraping P24...' : isRateGuardActive ? 'Shield Cooldown' : 'Scrape P24'}</span>
          </button>
        </div>
      </div>

      {/* ROW 3: Feature Filter Buttons */}
      <FilterPillsBar {...filterPillsProps} />
    </header>
  );
}
