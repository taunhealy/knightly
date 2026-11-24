import React from 'react';
import { Eye, EyeSlash, Heart } from '@phosphor-icons/react';

export interface FilterPillsBarProps {
  belowMarketFilter: boolean;
  setBelowMarketFilter: (val: boolean) => void;
  fibreFilter: boolean;
  setFibreFilter: (val: boolean) => void;
  safeishFilter: boolean;
  setSafeishFilter: (val: boolean) => void;
  offMainRoadFilter: boolean;
  setOffMainRoadFilter: (val: boolean) => void;
  offBarsFilter: boolean;
  setOffBarsFilter: (val: boolean) => void;
  activeAnchor: { label: string } | null | undefined;
  withinRadiusFilter: boolean;
  setWithinRadiusFilter: (val: boolean) => void;
  locationRadiusKm: number;
  parkingFilter: boolean;
  setParkingFilter: (val: boolean) => void;
  petFriendlyFilter: boolean;
  setPetFriendlyFilter: (val: boolean) => void;
  privateOnlyFilter: boolean;
  setPrivateOnlyFilter: (val: boolean) => void;
  hiddenCount: number;
  showHidden: boolean;
  setShowHidden: (val: boolean) => void;
  setIsImportModalOpen: (open: boolean) => void;
  totalFavouritesCount: number;
  favouriteCount: number;
  showOnlyFavourites: boolean;
  setShowOnlyFavourites: (val: boolean) => void;
}

export function FilterPillsBar({
  belowMarketFilter,
  setBelowMarketFilter,
  fibreFilter,
  setFibreFilter,
  safeishFilter,
  setSafeishFilter,
  offMainRoadFilter,
  setOffMainRoadFilter,
  offBarsFilter,
  setOffBarsFilter,
  activeAnchor,
  withinRadiusFilter,
  setWithinRadiusFilter,
  locationRadiusKm,
  parkingFilter,
  setParkingFilter,
  petFriendlyFilter,
  setPetFriendlyFilter,
  privateOnlyFilter,
  setPrivateOnlyFilter,
  hiddenCount,
  showHidden,
  setShowHidden,
  setIsImportModalOpen,
  totalFavouritesCount,
  favouriteCount,
  showOnlyFavourites,
  setShowOnlyFavourites,
}: FilterPillsBarProps) {
  return (
    <div className="w-full flex items-center flex-wrap gap-1.5 pt-1.5 mt-1.5 border-t border-zinc-100/80">
      <button
        type="button"
        onClick={() => setBelowMarketFilter(!belowMarketFilter)}
        className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${belowMarketFilter
          ? 'bg-emerald-700 text-white border-emerald-700 shadow-2xs ring-1 ring-emerald-400/30'
          : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
          }`}
        title="Filter listings: Only show properties priced below area market value"
      >
        <span className={belowMarketFilter ? "text-emerald-200" : "text-emerald-600"}>📉</span>
        <span>Below market value</span>
      </button>

      <button
        type="button"
        onClick={() => setFibreFilter(!fibreFilter)}
        className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${fibreFilter
          ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
          : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
          }`}
        title="Filter listings: Fibre ready internet only"
      >
        <span className={fibreFilter ? "text-cyan-300" : "text-zinc-500"}>🌐</span>
        <span>Fibre ready</span>
      </button>

      {/* Safe-ish Crime Hotspot Filter Button (ON by default) */}
      <button
        type="button"
        onClick={() => setSafeishFilter(!safeishFilter)}
        className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${safeishFilter
          ? 'bg-emerald-950 text-emerald-300 border-emerald-800 shadow-2xs ring-1 ring-emerald-500/30'
          : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
          }`}
        title={
          safeishFilter
            ? "Safe-ish: ON (Default: hiding properties within High-Risk crime radii). Click to show all properties."
            : "Safe-ish: OFF (Showing all properties including those near High-Risk crime zones). Click to filter."
        }
      >
        <span className={safeishFilter ? "text-emerald-400" : "text-zinc-400"}>🛡️</span>
        <span>Safe-ish</span>
        {safeishFilter && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
        )}
      </button>

      {/* Off-Main Rd Traffic & Noise Filter Button (ON by default) */}
      <button
        type="button"
        onClick={() => setOffMainRoadFilter(!offMainRoadFilter)}
        className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${offMainRoadFilter
          ? 'bg-amber-950 text-amber-300 border-amber-800 shadow-2xs ring-1 ring-amber-500/30'
          : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
          }`}
        title={
          offMainRoadFilter
            ? "Off-Main Rd: ON (Default: hiding noisy arterial road properties like Main Rd/M4). Click to show all properties."
            : "Off-Main Rd: OFF (Showing all properties including noisy arterial road corridors). Click to filter."
        }
      >
        <span className={offMainRoadFilter ? "text-amber-400" : "text-zinc-400"}>🔇</span>
        <span>Off-Main Rd</span>
        {offMainRoadFilter && (
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse ml-0.5" />
        )}
      </button>

      {/* Off-Bars & Clubs Filter Button */}
      <button
        type="button"
        onClick={() => setOffBarsFilter(!offBarsFilter)}
        className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${offBarsFilter
          ? 'bg-rose-950 text-rose-200 border-rose-800 shadow-2xs ring-1 ring-rose-500/30'
          : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
          }`}
        title={
          offBarsFilter
            ? "Off-Bars & Clubs: ON (hiding properties within close bar & nightlife noise radii). Click to show all."
            : "Off-Bars & Clubs: OFF (showing properties near bars & clubs). Click to filter out."
        }
      >
        <span className={offBarsFilter ? "text-rose-300" : "text-zinc-400"}>🍸</span>
        <span>Off-Bars/Clubs</span>
        {offBarsFilter && (
          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse ml-0.5" />
        )}
      </button>

      {/* Within Radius Filter Button (ON by default when activeAnchor is present) */}
      {activeAnchor && (
        <button
          type="button"
          onClick={() => setWithinRadiusFilter(!withinRadiusFilter)}
          className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${withinRadiusFilter
            ? 'bg-indigo-950 text-indigo-300 border-indigo-800 shadow-2xs ring-1 ring-indigo-500/30'
            : 'bg-zinc-100 border-zinc-200 text-zinc-500 hover:bg-zinc-200/70'
            }`}
          title={
            withinRadiusFilter
              ? `Within ${activeAnchor.label} radius: ON (Only showing properties within ${locationRadiusKm.toFixed(1)} km). Click to show all properties.`
              : `Within ${activeAnchor.label} radius: OFF (Showing all properties; listings inside ${locationRadiusKm.toFixed(1)} km rank higher). Click to exclude outside listings.`
          }
        >
          <span className={withinRadiusFilter ? "text-indigo-400" : "text-zinc-400"}>🎯</span>
          <span>In Radius (≤{locationRadiusKm.toFixed(1)} km)</span>
          {withinRadiusFilter && (
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 ml-0.5" />
          )}
        </button>
      )}

      <button
        type="button"
        onClick={() => setParkingFilter(!parkingFilter)}
        className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${parkingFilter
          ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
          : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
          }`}
        title="Filter listings: Off-street parking bay, carport, or lock-up garage (excludes street parking)"
      >
        <span className={parkingFilter ? "text-emerald-300" : "text-zinc-500"}>🅿️</span>
        <span>Off-street pkg</span>
      </button>

      <button
        type="button"
        onClick={() => setPetFriendlyFilter(!petFriendlyFilter)}
        className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${petFriendlyFilter
          ? 'bg-zinc-900 text-white border-zinc-900 shadow-2xs ring-1 ring-zinc-700'
          : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
          }`}
        title="Filter listings: Verified pet-friendly leases only"
      >
        <span className={petFriendlyFilter ? "text-pink-300" : "text-zinc-500"}>🐾</span>
        <span>Pet-friendly</span>
      </button>

      <button
        type="button"
        onClick={() => setPrivateOnlyFilter(!privateOnlyFilter)}
        className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${privateOnlyFilter
          ? 'bg-purple-950 text-purple-100 border-purple-800 shadow-2xs ring-1 ring-purple-600 font-extrabold'
          : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
          }`}
        title="Filter listings: 100% private standalone homes only (excludes cottages on landlord grounds)"
      >
        <span className={privateOnlyFilter ? "text-purple-300" : "text-zinc-500"}>🔒</span>
        <span>Private</span>
      </button>

      {/* Hidden Posts Visibility Toggle Pill */}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowHidden(!showHidden)}
          className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${showHidden
            ? 'bg-amber-500 text-zinc-950 border-amber-600 shadow-xs ring-1 ring-amber-400 font-extrabold'
            : 'bg-zinc-100 border-zinc-200 text-zinc-700 hover:bg-zinc-200/70'
            }`}
          title={showHidden ? "Hide dismissed listings again" : `Show ${hiddenCount} hidden / dismissed listing${hiddenCount > 1 ? 's' : ''}`}
        >
          {showHidden ? <Eye size={12} weight="bold" /> : <EyeSlash size={12} weight="bold" />}
          <span>{showHidden ? 'Showing Hidden' : 'Hidden'}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${showHidden ? 'bg-black/15 text-zinc-950' : 'bg-zinc-200 text-zinc-800'}`}>
            {hiddenCount}
          </span>
        </button>
      )}

      {/* Import Property24 Favourites Button */}
      <button
        type="button"
        onClick={() => setIsImportModalOpen(true)}
        className="h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 transition-all cursor-pointer leading-none shrink-0"
        title="Import your favourited properties from Property24"
      >
        <Heart size={12} weight="fill" className="text-rose-600" />
        <span>Import P24 Favs</span>
      </button>

      {/* Favourites Only Filter Toggle Pill */}
      {totalFavouritesCount > 0 && (
        <button
          type="button"
          onClick={() => setShowOnlyFavourites(!showOnlyFavourites)}
          className={`h-6 flex items-center gap-1.5 px-2.5 rounded-full text-[11px] font-bold border transition-all cursor-pointer leading-none shrink-0 ${showOnlyFavourites
            ? 'bg-rose-500 text-white border-rose-600 shadow-xs ring-1 ring-rose-400 font-extrabold'
            : 'bg-rose-50/80 border-rose-200 text-rose-700 hover:bg-rose-100'
            }`}
          title={showOnlyFavourites ? "Show all properties" : `Show only ${favouriteCount} favourite${favouriteCount > 1 ? 's' : ''}`}
        >
          <Heart size={12} weight="fill" className={showOnlyFavourites ? "text-white" : "text-rose-500"} />
          <span>{showOnlyFavourites ? 'Showing Favs' : 'Favs'}</span>
          <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-black ${showOnlyFavourites ? 'bg-white/20 text-white' : 'bg-rose-200/80 text-rose-800'}`}>
            {favouriteCount}
          </span>
        </button>
      )}
    </div>
  );
}
