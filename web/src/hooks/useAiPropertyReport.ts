import { useState, useEffect } from 'react';
import type { PropertyMapItem } from '@/components/PropertyMap';
import type { CommuteAnchor } from '@/constants/locations';
import { generatePropertyAiAudit } from '@/lib/forensicAudit';
import {
  getPlanSummary,
  consumeAuditCredit,
  compressImageToDataUrl,
  getCompareList,
  type PlanSummary,
} from '@/lib/pro-plan';

export type ReportHistoryEntry = Record<string, unknown> & {
  reportId: string;
  generatedAtMs: number;
};

type GalleryFeatures = {
  description?: string;
  has_garage?: boolean;
  has_secure_bay?: boolean;
  stove_type?: string;
  has_inverter?: boolean;
  pet_friendly?: boolean | null;
};

type AuditShape = Record<string, unknown> & {
  hasAiRun?: boolean;
  generatedAt?: string;
  verdict?: string;
  personalMatchVerdict?: string;
  photoStory?: string;
  wfhLayoutVerdict?: string;
  windowLightAudit?: string;
  wallAcousticAudit?: string;
  ceilingVolumeAudit?: string;
  lightingFixturesAudit?: string;
  exteriorBuildingAudit?: string;
  pros?: string[];
  cons?: string[];
  strategicInsights?: { criticalWatchouts?: string[] };
  appliedPreferences?: string;
};

export interface UseAiPropertyReportOptions {
  user: { uid?: string; getIdToken?: () => Promise<string> } | null | undefined;
  personalPreferences: string;
  setPersonalPreferences: (val: string) => void;
  cardGalleries: Record<string, string[]>;
  fetchCardGallery: (
    propId: string,
    url: string
  ) => Promise<{ photos: string[]; features: GalleryFeatures } | null>;
  allCandidateProperties: PropertyMapItem[];
  activeAnchor: CommuteAnchor | null | undefined;
  setProperties: React.Dispatch<React.SetStateAction<PropertyMapItem[]>>;
  setSelectedPropertyId: (id: string | null) => void;
}

export function useAiPropertyReport({
  user,
  personalPreferences,
  setPersonalPreferences,
  cardGalleries,
  fetchCardGallery,
  allCandidateProperties,
  activeAnchor,
  setProperties,
  setSelectedPropertyId,
}: UseAiPropertyReportOptions) {
  const [viewingAiReportProp, setViewingAiReportProp] = useState<PropertyMapItem | null>(null);
  const [reportHistoryByProp, setReportHistoryByProp] = useState<Record<string, ReportHistoryEntry[]>>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem('homeseek_ai_report_history_v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') return parsed;
        }
      } catch { }
    }
    return {};
  });

  const saveReportVersion = (propId: string, auditObj: Record<string, unknown>): ReportHistoryEntry => {
    const versionEntry: ReportHistoryEntry = {
      ...auditObj,
      reportId:
        typeof auditObj.reportId === 'string' && auditObj.reportId
          ? auditObj.reportId
          : `rep-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      generatedAtMs: typeof auditObj.generatedAtMs === 'number' ? auditObj.generatedAtMs : Date.now(),
    };
    setReportHistoryByProp((prev) => {
      const existing = Array.isArray(prev[propId]) ? prev[propId] : [];
      const nextList = [versionEntry, ...existing].slice(0, 8);
      const nextMap = { ...prev, [propId]: nextList };
      try {
        localStorage.setItem('homeseek_ai_report_history_v1', JSON.stringify(nextMap));
      } catch { }
      return nextMap;
    });
    return versionEntry;
  };

  const [planSummary, setPlanSummary] = useState<PlanSummary | null>(null);
  const [uploadedViewingPhotos, setUploadedViewingPhotos] = useState<string[]>([]);
  const [photoSourceMode, setPhotoSourceMode] = useState<'both' | 'uploaded' | 'listing'>('both');
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [snagCopied, setSnagCopied] = useState(false);

  useEffect(() => {
    setPlanSummary(getPlanSummary());
    setCompareIds(getCompareList().map((p) => String(p.id)));
    const syncPlan = () => setPlanSummary(getPlanSummary());
    const syncCompare = () => setCompareIds(getCompareList().map((p) => String(p.id)));
    window.addEventListener('homeseek-plan-updated', syncPlan);
    window.addEventListener('homeseek-compare-updated', syncCompare);
    return () => {
      window.removeEventListener('homeseek-plan-updated', syncPlan);
      window.removeEventListener('homeseek-compare-updated', syncCompare);
    };
  }, []);

  const handleUploadViewingPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const remainingSlots = Math.max(0, 8 - uploadedViewingPhotos.length);
    const selected = Array.from(files).slice(0, remainingSlots);
    const compressed = await Promise.all(selected.map((f) => compressImageToDataUrl(f, 1024, 0.8)));
    setUploadedViewingPhotos((prev) => [...prev, ...compressed].slice(0, 8));
  };

  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isEmailPdfOpen, setIsEmailPdfOpen] = useState(false);
  const [emailPdfTarget, setEmailPdfTarget] = useState('');
  const [isSendingEmailPdf, setIsSendingEmailPdf] = useState(false);
  const [emailPdfStatus, setEmailPdfStatus] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const buildReportPdfPayload = (prop: PropertyMapItem) => {
    const audit = ((prop as PropertyMapItem & { deep_ai_audit?: AuditShape }).deep_ai_audit || {}) as AuditShape;
    return {
      id: prop.id,
      title: prop.title,
      address: prop.address,
      price: prop.price,
      bedrooms: prop.bedrooms,
      bathrooms: prop.bathrooms,
      sqm: prop.sqm,
      url: prop.url,
      generated_at: audit.generatedAt || new Date().toLocaleString(),
      verdict: audit.verdict || '',
      photo_story: audit.photoStory || '',
      pros: Array.isArray(audit.pros) ? audit.pros : [],
      cons: Array.isArray(audit.cons) ? audit.cons : [],
      architecture: {
        wfhLayoutVerdict: audit.wfhLayoutVerdict || '',
        windowLightAudit: audit.windowLightAudit || '',
        wallAcousticAudit: audit.wallAcousticAudit || '',
        ceilingVolumeAudit: audit.ceilingVolumeAudit || '',
        lightingFixturesAudit: audit.lightingFixturesAudit || '',
        exteriorBuildingAudit: audit.exteriorBuildingAudit || '',
      },
    };
  };

  const handleDownloadReportPdf = async (prop: PropertyMapItem) => {
    setIsExportingPdf(true);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/reports/pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ report: buildReportPdfPayload(prop) }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `homeseek-report-${prop.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleEmailReportPdf = async (prop: PropertyMapItem) => {
    const to = emailPdfTarget.trim();
    if (!to) {
      setEmailPdfStatus({ type: 'err', text: 'Enter an email address.' });
      return;
    }
    setIsSendingEmailPdf(true);
    setEmailPdfStatus(null);
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';
      const res = await fetch(`${backendBase}/api/reports/email-pdf`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: to, report: buildReportPdfPayload(prop) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEmailPdfStatus({ type: 'err', text: data?.detail || 'Failed to send PDF.' });
        return;
      }
      setEmailPdfStatus({ type: 'ok', text: `Sent PDF to ${to}` });
    } catch {
      setEmailPdfStatus({ type: 'err', text: 'Network error sending PDF.' });
    } finally {
      setIsSendingEmailPdf(false);
    }
  };

  const handleCopySnagReport = async (prop: PropertyMapItem) => {
    const audit = (prop as PropertyMapItem & { deep_ai_audit?: AuditShape }).deep_ai_audit;
    if (!audit) return;
    const lines = [
      `# Home-Seek Viewing & Snagging Report`,
      `**Property:** ${prop.title} (${prop.address})`,
      `**Rent:** R ${prop.price.toLocaleString()}/mo | ${prop.bedrooms} bed | ${prop.sqm ? `${prop.sqm} m²` : 'N/A'}`,
      `**Generated:** ${audit.generatedAt || new Date().toLocaleString()}`,
      `**Lifestyle Brief:** ${audit.appliedPreferences || personalPreferences || 'Standard'}`,
      ``,
      `## Verdict`,
      audit.personalMatchVerdict || '',
      ``,
      `## Photo Story`,
      audit.photoStory || '',
      ``,
      `## Architectural & WFH Audit`,
      `- Space & WFH: ${audit.wfhLayoutVerdict || ''}`,
      `- Windows & Light: ${audit.windowLightAudit || ''}`,
      `- Walls & Acoustics: ${audit.wallAcousticAudit || ''}`,
      `- Ceilings & Volume: ${audit.ceilingVolumeAudit || ''}`,
      `- Lighting Fixtures: ${audit.lightingFixturesAudit || ''}`,
      `- Exterior & Building: ${audit.exteriorBuildingAudit || ''}`,
      ``,
      `## Pros`,
      ...(audit.pros || []).map((p: string) => `- [+] ${p}`),
      ``,
      `## Cons & Risks`,
      ...(audit.cons || []).map((c: string) => `- [-] ${c}`),
      ``,
      `## Things to Be Aware Of`,
      ...(audit.strategicInsights?.criticalWatchouts || []).map((w: string) => `- [!] ${w}`),
    ];
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setSnagCopied(true);
      setTimeout(() => setSnagCopied(false), 2500);
    } catch { }
  };

  const handleUpdatePreferences = (newPrefs: string) => {
    setPersonalPreferences(newPrefs);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('homeseek_personal_preferences', newPrefs);
      } catch { }
    }
    if (viewingAiReportProp) {
      const updatedAudit = generatePropertyAiAudit(viewingAiReportProp, viewingAiReportProp.rank || 1, {
        userPreferences: newPrefs,
        cardGalleries,
        allCandidateProperties,
        activeAnchor,
      });
      setViewingAiReportProp({
        ...viewingAiReportProp,
        deep_ai_audit: updatedAudit,
      });
    }
  };

  const runForensicAiInspection = async (propToInspect: PropertyMapItem) => {
    let fullGallery =
      cardGalleries[propToInspect.id]?.length
        ? cardGalleries[propToInspect.id]
        : Array.isArray(propToInspect.images) && propToInspect.images.length > 0
          ? propToInspect.images
          : propToInspect.image
            ? [propToInspect.image]
            : [];

    setViewingAiReportProp((prev) =>
      prev && prev.id === propToInspect.id
        ? { ...prev, deep_ai_audit: { ...(prev.deep_ai_audit || {}), isVisionLoading: true } }
        : prev
    );

    let updatedProp: PropertyMapItem = { ...propToInspect, images: fullGallery };
    if (fullGallery.length <= 1 && propToInspect.url) {
      const galleryRes = await fetchCardGallery(propToInspect.id, propToInspect.url);
      if (galleryRes && galleryRes.photos.length > 0) {
        fullGallery = galleryRes.photos;
        const f = galleryRes.features || {};
        updatedProp = {
          ...updatedProp,
          images: fullGallery,
          description: f.description || updatedProp.description,
          has_garage: Boolean(updatedProp.has_garage || f.has_garage),
          has_secure_bay: Boolean(updatedProp.has_secure_bay || f.has_secure_bay),
          parking_type: f.has_garage || updatedProp.has_garage ? 'garage' : f.has_secure_bay || updatedProp.has_secure_bay ? 'secure_bay' : updatedProp.parking_type,
          stove_type: (f.stove_type as PropertyMapItem['stove_type']) || updatedProp.stove_type,
          has_inverter: Boolean(updatedProp.has_inverter || f.has_inverter),
          pet_friendly: f.pet_friendly !== null && f.pet_friendly !== undefined ? Boolean(updatedProp.pet_friendly || f.pet_friendly) : updatedProp.pet_friendly,
        };
        const refreshedAudit = generatePropertyAiAudit(updatedProp, propToInspect.rank || 1, {
          userPreferences: personalPreferences,
          galleryOverride: fullGallery,
          cardGalleries,
          allCandidateProperties,
          activeAnchor,
        });
        setViewingAiReportProp((prev) =>
          prev && prev.id === propToInspect.id
            ? {
              ...updatedProp,
              deep_ai_audit: {
                ...refreshedAudit,
                isVisionLoading: true,
              },
            }
            : prev
        );
      }
    }

    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = user?.getIdToken ? await user.getIdToken().catch(() => null) : null;
      const visionHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-User-Id': user?.uid || 'local-dev-user',
      };
      if (token) visionHeaders['Authorization'] = `Bearer ${token}`;

      const visionRes = await fetch(`${backendBase}/api/listing/forensic-vision`, {
        method: 'POST',
        headers: visionHeaders,
        body: JSON.stringify({
          id: updatedProp.id,
          url: updatedProp.url || '',
          title: updatedProp.title || '',
          address: updatedProp.address || '',
          price: updatedProp.price || 0,
          bedrooms: updatedProp.bedrooms || 1,
          bathrooms: updatedProp.bathrooms || 1,
          sqm: updatedProp.sqm || null,
          description: updatedProp.description || updatedProp.ai_insight || '',
          images: fullGallery,
          uploaded_images: uploadedViewingPhotos,
          photo_source_mode: photoSourceMode,
          personal_preferences: personalPreferences || '',
          force_refresh: true,
        }),
      });
      if (!visionRes.ok) {
        const errPayload = await visionRes.json().catch(() => ({}));
        const errMsg = errPayload?.detail || `Vision service returned HTTP ${visionRes.status}`;
        setViewingAiReportProp((prev) =>
          prev && prev.id === propToInspect.id
            ? {
              ...prev,
              deep_ai_audit: {
                ...(prev.deep_ai_audit || {}),
                isVisionLoading: false,
                visionError: errMsg,
              },
            }
            : prev
        );
        return;
      }
      consumeAuditCredit();
      const visionData = await visionRes.json();
      const v = visionData?.vision;
      if (v) {
        const resolvedStove = (v.stove_type && v.stove_type !== 'unknown') ? v.stove_type : updatedProp.stove_type;
        const validPrivacy = ['apartment_block', 'freestanding_house', 'garden_cottage', 'attached_flatlet', 'room_shared'].includes(v.dwelling_privacy)
          ? v.dwelling_privacy
          : undefined;
        const isSharedPrivacy = validPrivacy ? ['garden_cottage', 'attached_flatlet', 'room_shared'].includes(validPrivacy) : undefined;
        updatedProp = {
          ...updatedProp,
          stove_type: resolvedStove,
          ...(v.privacy_verdict ? { vision_privacy_verdict: v.privacy_verdict } : {}),
          ...(validPrivacy ? { dwelling_privacy: validPrivacy, is_landlord_on_site: isSharedPrivacy, vision_verified: true } : {}),
        };
        setProperties((prev) =>
          prev.map((p) =>
            p.id === propToInspect.id
              ? {
                ...p,
                stove_type: resolvedStove || p.stove_type,
                ...(v.privacy_verdict ? { vision_privacy_verdict: v.privacy_verdict } : {}),
                ...(validPrivacy ? { dwelling_privacy: validPrivacy, is_landlord_on_site: isSharedPrivacy, vision_verified: true } : {}),
                images: fullGallery.length > 0 ? fullGallery : p.images,
                has_garage: updatedProp.has_garage,
                has_secure_bay: updatedProp.has_secure_bay,
                parking_type: updatedProp.parking_type,
                has_inverter: updatedProp.has_inverter,
                pet_friendly: updatedProp.pet_friendly,
              }
              : p
          )
        );
        const baseAudit = generatePropertyAiAudit(updatedProp, propToInspect.rank || 1, {
          userPreferences: personalPreferences,
          galleryOverride: fullGallery,
          cardGalleries,
          allCandidateProperties,
          activeAnchor,
        });
        const mergedPros = Array.from(new Set([...(Array.isArray(v.photo_pros) ? v.photo_pros : []), ...(baseAudit.pros || [])])).slice(0, 9);
        const mergedCons = Array.from(new Set([...(Array.isArray(v.photo_cons) ? v.photo_cons : []), ...(baseAudit.cons || [])])).slice(0, 9);
        const completedAudit = {
          ...baseAudit,
          pros: mergedPros,
          cons: mergedCons,
          photoStory: v.photo_story || '',
          inspectedPhotoCount: fullGallery.length > 1
            ? Math.max(v.inspected_photo_count || 0, fullGallery.length)
            : (v.inspected_photo_count || fullGallery.length),
          glazing: v.glazing || baseAudit.glazing,
          distortion: v.distortion || baseAudit.distortion,
          wfhLayoutVerdict: v.wfh_layout_verdict || baseAudit.wfhLayoutVerdict,
          windowLightAudit: v.window_light_audit || baseAudit.windowLightAudit,
          wallAcousticAudit: v.wall_acoustic_audit || baseAudit.wallAcousticAudit,
          ceilingVolumeAudit: v.ceiling_volume_audit || baseAudit.ceilingVolumeAudit,
          lightingFixturesAudit: v.lighting_fixtures_audit || baseAudit.lightingFixturesAudit,
          exteriorBuildingAudit: v.exterior_building_audit || baseAudit.exteriorBuildingAudit,
          buildingIntel: v.building_intel || null,
          stoveType:
            v.stove_type && v.stove_type !== 'unknown'
              ? `${v.stove_type.charAt(0).toUpperCase() + v.stove_type.slice(1)} hob/stove observed in kitchen photo`
              : baseAudit.stoveType,
          isVisionFallback: Boolean(v.is_fallback),
          fallbackReason: v.fallback_reason || null,
          privacyVerdict: v.privacy_verdict || '',
          isVisionLoading: false,
          hasAiRun: true,
          isCached: Boolean(visionData?.cached),
          generatedAt:
            v.generated_at ||
            new Date().toLocaleString([], {
              day: '2-digit',
              month: 'short',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            }),
          generatedAtMs: typeof v.generated_at_ms === 'number' ? v.generated_at_ms : Date.now(),
          appliedPreferences: personalPreferences.trim() || 'Standard optimal rental baseline',
        };
        const savedVersion = saveReportVersion(propToInspect.id, completedAudit);
        setProperties((prev) =>
          prev.map((p) => (p.id === propToInspect.id ? { ...p, deep_ai_audit: savedVersion } : p))
        );
        setViewingAiReportProp((prev) =>
          prev && prev.id === propToInspect.id
            ? {
              ...updatedProp,
              deep_ai_audit: savedVersion,
            }
            : prev
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not reach backend Vision AI service.';
      setViewingAiReportProp((prev) =>
        prev && prev.id === propToInspect.id
          ? {
            ...prev,
            deep_ai_audit: {
              ...(prev.deep_ai_audit || {}),
              isVisionLoading: false,
              visionError: msg,
            },
          }
          : prev
      );
    }
  };

  const handleOverrideDwellingPrivacy = async (propId: string, dwellingPrivacy: string) => {
    try {
      const backendBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const res = await fetch(`${backendBase}/api/listing/update-privacy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_id: propId, dwelling_privacy: dwellingPrivacy }),
      });
      if (!res.ok) return;
      const data = await res.json();
      const patch = {
        dwelling_privacy: data.dwelling_privacy,
        is_landlord_on_site: Boolean(data.is_landlord_on_site),
        vision_verified: true,
        vision_privacy_verdict: data.privacy_verdict,
      };
      setProperties((prev) =>
        prev.map((p) => (p.id === propId ? { ...p, ...patch } : p))
      );
      setViewingAiReportProp((prev) =>
        prev && prev.id === propId
          ? {
            ...prev,
            ...patch,
            deep_ai_audit: {
              ...(prev.deep_ai_audit || {}),
              privacyVerdict: data.privacy_verdict,
            },
          }
          : prev
      );
    } catch { }
  };

  const handleTogglePropertyAiReport = (prop: PropertyMapItem) => {
    if (viewingAiReportProp?.id === prop.id) {
      setViewingAiReportProp(null);
      return;
    }

    const fullGallery =
      cardGalleries[prop.id]?.length
        ? cardGalleries[prop.id]
        : Array.isArray(prop.images) && prop.images.length > 0
          ? prop.images
          : prop.image
            ? [prop.image]
            : [];

    const latestSaved = reportHistoryByProp[prop.id]?.[0] || (prop.deep_ai_audit?.hasAiRun ? prop.deep_ai_audit : null);
    const initialAudit = latestSaved || {
      ...generatePropertyAiAudit(prop, prop.rank || 1, {
        userPreferences: personalPreferences,
        galleryOverride: fullGallery,
        cardGalleries,
        allCandidateProperties,
        activeAnchor,
      }),
      isVisionLoading: false,
      hasAiRun: false,
    };
    setViewingAiReportProp({
      ...prop,
      images: fullGallery,
      deep_ai_audit: initialAudit,
    });
    setSelectedPropertyId(prop.id);
  };

  return {
    viewingAiReportProp,
    setViewingAiReportProp,
    reportHistoryByProp,
    planSummary,
    uploadedViewingPhotos,
    setUploadedViewingPhotos,
    photoSourceMode,
    setPhotoSourceMode,
    compareIds,
    snagCopied,
    handleUploadViewingPhotos,
    isExportingPdf,
    isEmailPdfOpen,
    setIsEmailPdfOpen,
    emailPdfTarget,
    setEmailPdfTarget,
    isSendingEmailPdf,
    emailPdfStatus,
    setEmailPdfStatus,
    handleDownloadReportPdf,
    handleEmailReportPdf,
    handleCopySnagReport,
    handleUpdatePreferences,
    runForensicAiInspection,
    handleOverrideDwellingPrivacy,
    handleTogglePropertyAiReport,
  };
}
