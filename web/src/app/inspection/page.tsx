'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Camera,
  CheckCircle,
  CircleNotch,
  DownloadSimple,
  Envelope,
  FloppyDisk,
  MagnifyingGlass,
  Plus,
  Trash,
  WarningCircle,
  X,
} from '@phosphor-icons/react';
import { Navbar } from '@/components/Navbar';
import { useAuth } from '@/lib/auth-context';
import { apiUrl } from '@/lib/apiClient';
import { compressImageToDataUrl } from '@/lib/pro-plan';

interface InspectionItem {
  id: string;
  room: string;
  status: 'good' | 'minor_wear' | 'defect';
  notes: string;
  captured_at: string;
  photo_data: string;
}

const DEFAULT_ROOM_TEMPLATES: Record<string, string[]> = {
  Kitchen: [
    'Stove / oven & hob burners',
    'Extractor fan & light',
    'Sink, taps & under-sink plumbing',
    'Cupboard doors, hinges & drawers',
    'Countertops & splashback tiles',
  ],
  'Living Area': [
    'Walls, paint & skirting boards',
    'Flooring / tiles / carpets',
    'Windows, latches & blinds',
    'Light fittings & plug sockets',
    'Doors, handles & locks',
  ],
  Bedroom: [
    'Built-in cupboards & sliding doors',
    'Walls, ceiling & paintwork',
    'Flooring / carpets',
    'Windows, handles & curtain rails',
    'Light switches & plug sockets',
  ],
  Bathroom: [
    'Shower / bath seals & grout',
    'Toilet flush & seat',
    'Basin, taps & drain flow',
    'Mirror / vanity cabinet',
    'Extractor fan & damp / mould check',
  ],
  'Balcony / Exterior': [
    'Tiles / paving & drainage',
    'Balustrade / railing stability',
    'Sliding door track & lock',
    'Exterior lights & tap',
  ],
  'Windows & Locks': [
    'Window latches & hinges',
    'Burglar bars & security gates',
    'Front door deadbolt & keys',
  ],
  'Meters & Keys': [
    'Water meter reading & photo',
    'Prepaid / electricity meter reading & photo',
    'Front keys, remotes & access tags',
  ],
};

const ROOM_PRESETS = Object.keys(DEFAULT_ROOM_TEMPLATES);

export default function IngoingInspectionPage() {
  const { user, profile } = useAuth();
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [propertyAddress, setPropertyAddress] = useState('');
  const [landlordOrAgent, setLandlordOrAgent] = useState('');
  const [leaseStartDate, setLeaseStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [waterMeter, setWaterMeter] = useState('');
  const [electricityMeter, setElectricityMeter] = useState('');
  const [keysNotes, setKeysNotes] = useState('');
  const [items, setItems] = useState<InspectionItem[]>([]);

  const [selectedRoom, setSelectedRoom] = useState('Kitchen');
  const [customRoom, setCustomRoom] = useState('');
  const [roomFields, setRoomFields] = useState<Record<string, string[]>>(() => ({
    ...DEFAULT_ROOM_TEMPLATES,
  }));
  const [newFieldText, setNewFieldText] = useState('');
  const [newStatus, setNewStatus] = useState<'good' | 'minor_wear' | 'defect'>('defect');
  const [isSaving, setIsSaving] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [isEmailOpen, setIsEmailOpen] = useState(false);
  const [emailTarget, setEmailTarget] = useState('');
  const [publicSnags, setPublicSnags] = useState<any[]>([]);
  const [isPublicSnags, setIsPublicSnags] = useState(true);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [keepPrivateChecked, setKeepPrivateChecked] = useState(false);

  useEffect(() => {
    const addr = propertyAddress.trim();
    if (addr.length < 4) {
      setPublicSnags([]);
      return;
    }
    let active = true;
    const t = setTimeout(async () => {
      const { fetchPublicSnags } = await import('@/lib/workspaceSync');
      const reports = await fetchPublicSnags({ address: addr });
      if (active) setPublicSnags(reports);
    }, 400);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [propertyAddress]);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  useEffect(() => {
    const effectiveUid = user?.uid || 'guest_inspector';
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl(`/api/inspections?user_id=${encodeURIComponent(effectiveUid)}`));
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const latest = Array.isArray(data?.inspections) && data.inspections.length > 0 ? data.inspections[0] : null;
        if (latest && !cancelled) {
          setInspectionId(latest.id);
          setPropertyAddress(latest.property_address || '');
          setLandlordOrAgent(latest.landlord_or_agent || '');
          setLeaseStartDate(latest.lease_start_date || new Date().toISOString().slice(0, 10));
          setWaterMeter(latest.water_meter || '');
          setElectricityMeter(latest.electricity_meter || '');
          setKeysNotes(latest.keys_notes || '');
          setItems(Array.isArray(latest.items) ? latest.items : []);
        }
      } catch {
        // silent
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

  const activeRoomName = customRoom.trim() || selectedRoom;

  const handleUploadPhotos = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setStatusMsg(null);
    const added: InspectionItem[] = [];
    for (const file of Array.from(files).slice(0, 10)) {
      try {
        const compressed = await compressImageToDataUrl(file, 960, 0.78);
        const ts = file.lastModified ? new Date(file.lastModified) : new Date();
        const stamp = ts.toLocaleString('en-ZA', {
          year: 'numeric',
          month: 'short',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        });
        added.push({
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          room: activeRoomName,
          status: newStatus,
          notes: '',
          captured_at: stamp,
          photo_data: compressed,
        });
      } catch {
        // skip unreadable image
      }
    }
    if (added.length > 0) {
      setItems((prev) => [...added, ...prev]);
    }
  };

  const handleAddTextOnlyItem = () => {
    const stamp = new Date().toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    setItems((prev) => [
      {
        id: `item-${Date.now()}`,
        room: activeRoomName,
        status: newStatus,
        notes: '',
        captured_at: stamp,
        photo_data: '',
      },
      ...prev,
    ]);
  };

  const executeSave = async (overridePublic?: boolean) => {
    const effectiveUid = user?.uid || 'guest_inspector';
    const effectivePublic = overridePublic !== undefined ? overridePublic : isPublicSnags;
    setIsSaving(true);
    setStatusMsg(null);
    try {
      const res = await fetch(apiUrl('/api/inspections'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: inspectionId,
          user_id: effectiveUid,
          property_address: propertyAddress,
          is_public_snags: effectivePublic,
          landlord_or_agent: landlordOrAgent,
          lease_start_date: leaseStartDate,
          water_meter: waterMeter,
          electricity_meter: electricityMeter,
          keys_notes: keysNotes,
          items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Save failed');
      setInspectionId(data.id);
      setStatusMsg({ type: 'ok', text: `Saved ${items.length} inspection record(s) to Knightly.` });
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Could not save inspection.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!privacyConfirmed && items.some((it) => it.status !== 'good')) {
      setKeepPrivateChecked(!isPublicSnags);
      setPrivacyModalOpen(true);
      return;
    }
    await executeSave();
  };

  const handleConfirmPrivacyAndSave = async () => {
    const nextPublic = !keepPrivateChecked;
    setIsPublicSnags(nextPublic);
    setPrivacyConfirmed(true);
    setPrivacyModalOpen(false);
    await executeSave(nextPublic);
  };

  const buildPayload = () => ({
    property_address: propertyAddress,
    landlord_or_agent: landlordOrAgent,
    lease_start_date: leaseStartDate,
    water_meter: waterMeter,
    electricity_meter: electricityMeter,
    keys_notes: keysNotes,
    tenant_name: profile?.nickname ? `${user?.displayName || 'Tenant'} (u/${profile.nickname})` : (user?.displayName || user?.email || 'Tenant'),
    generated_at: new Date().toLocaleString('en-ZA'),
    items,
  });

  const handleDownloadPdf = async () => {
    setIsExportingPdf(true);
    setStatusMsg(null);
    try {
      const res = await fetch(apiUrl('/api/inspections/pdf'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ingoing-inspection-${leaseStartDate || 'record'}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatusMsg({ type: 'ok', text: 'Downloaded timestamped Ingoing Inspection PDF.' });
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'PDF download failed.' });
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleEmailPdf = async () => {
    const target = emailTarget.trim();
    if (!target.includes('@')) {
      setStatusMsg({ type: 'err', text: 'Please enter a valid recipient email address.' });
      return;
    }
    setIsSendingEmail(true);
    setStatusMsg(null);
    try {
      const res = await fetch(apiUrl('/api/inspections/email-pdf'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_email: target, inspection: buildPayload() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Email failed');
      setStatusMsg({ type: 'ok', text: `Emailed timestamped PDF record to ${target}.` });
      setIsEmailOpen(false);
    } catch (err: any) {
      setStatusMsg({ type: 'err', text: err?.message || 'Could not send email.' });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const activeRoomChecks = roomFields[activeRoomName] ?? [
    'Walls, ceiling & paintwork',
    'Flooring / tiles / carpets',
    'Windows, doors & locks',
    'Lights & plug sockets',
  ];

  const handleUpdateRoomField = (index: number, nextValue: string) => {
    setRoomFields((prev) => {
      const current = [...(prev[activeRoomName] ?? activeRoomChecks)];
      current[index] = nextValue;
      return { ...prev, [activeRoomName]: current };
    });
  };

  const handleRemoveRoomField = (index: number) => {
    setRoomFields((prev) => {
      const current = [...(prev[activeRoomName] ?? activeRoomChecks)];
      return { ...prev, [activeRoomName]: current.filter((_, i) => i !== index) };
    });
  };

  const handleAddRoomField = () => {
    const clean = newFieldText.trim();
    if (!clean) return;
    setRoomFields((prev) => ({
      ...prev,
      [activeRoomName]: [...(prev[activeRoomName] ?? activeRoomChecks), clean],
    }));
    setNewFieldText('');
  };

  const handleLogCheckNote = (roomName: string, checkText: string) => {
    const stamp = new Date().toLocaleString('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    setItems((prev) => [
      {
        id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        room: roomName,
        status: newStatus,
        notes: checkText,
        captured_at: stamp,
        photo_data: '',
      },
      ...prev,
    ]);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-24 pb-16 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight">Ingoing Move-In Inspection</h1>
          <p className="text-xs text-zinc-400 mt-1 max-w-2xl">
            Document pre-existing defects, meter readings, and keys with timestamped photo evidence &amp; SHA-256 hashes,
            then download or email a dispute-proof PDF to your agent/landlord on Day 1.
          </p>
        </div>
        <div className="flex items-center flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving ? <CircleNotch size={14} className="animate-spin" /> : <FloppyDisk size={14} weight="bold" />}
            <span>{isSaving ? 'Saving...' : 'Save Record'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isExportingPdf}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <DownloadSimple size={14} weight="bold" />
            <span>{isExportingPdf ? 'Building PDF...' : 'Save PDF'}</span>
          </button>
          <button
            type="button"
            onClick={() => setIsEmailOpen(!isEmailOpen)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow-md"
          >
            <Envelope size={14} weight="bold" />
            <span>Email PDF</span>
          </button>
          <Link
            href="/search"
            className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold flex items-center gap-1"
          >
            <MagnifyingGlass size={13} />
            <span>Search</span>
          </Link>
        </div>
      </div>

      {isEmailOpen && (
        <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-bold text-emerald-200">Email Timestamped PDF to Agent / Landlord:</span>
          <input
            type="email"
            value={emailTarget}
            onChange={(e) => setEmailTarget(e.target.value)}
            placeholder="agent@agency.co.za"
            className="flex-1 min-w-[220px] px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-emerald-400"
          />
          <button
            type="button"
            disabled={isSendingEmail}
            onClick={handleEmailPdf}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-extrabold cursor-pointer"
          >
            {isSendingEmail ? 'Sending...' : 'Send PDF'}
          </button>
        </div>
      )}

      {statusMsg && (
        <div className={`p-3 rounded-2xl border text-xs font-semibold flex items-center gap-2 ${statusMsg.type === 'ok'
          ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
          : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
          }`}>
          {statusMsg.type === 'ok' ? <CheckCircle size={15} weight="fill" /> : <WarningCircle size={15} weight="fill" />}
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* Property, Meters & Keys */}
      {publicSnags.length > 0 && (
        <div className="rounded-3xl bg-amber-950/40 border border-amber-500/30 p-4 space-y-2">
          <p className="text-xs font-extrabold uppercase tracking-wider text-amber-300">
            Past Reported Snags Near / At This Address ({publicSnags.length})
          </p>
          {publicSnags.slice(0, 3).map((rep: any, idx: number) => (
            <div key={idx} className="text-xs text-amber-100/90 space-y-1">
              <p className="font-bold">{rep.property_address || rep.suburb} ({rep.match_type})</p>
              {(rep.snags || []).slice(0, 3).map((s: any, si: number) => (
                <p key={si} className="text-[11px] text-amber-200/80">• [{s.room}] {s.notes}</p>
              ))}
            </div>
          ))}
        </div>
      )}

      <div className="rounded-3xl bg-zinc-900/90 border border-white/10 p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Property Address</label>
          <input
            type="text"
            value={propertyAddress}
            onChange={(e) => setPropertyAddress(e.target.value)}
            placeholder="e.g. Apt 4, 14 Derwent Rd, Gardens"
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Landlord / Managing Agent</label>
          <input
            type="text"
            value={landlordOrAgent}
            onChange={(e) => setLandlordOrAgent(e.target.value)}
            placeholder="e.g. Jane Doe · Seeff"
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Move-In / Occupation Date</label>
          <input
            type="date"
            value={leaseStartDate}
            onChange={(e) => setLeaseStartDate(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Water Meter Reading</label>
          <input
            type="text"
            value={waterMeter}
            onChange={(e) => setWaterMeter(e.target.value)}
            placeholder="e.g. 00412.6 kL"
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Prepaid / Electricity Meter</label>
          <input
            type="text"
            value={electricityMeter}
            onChange={(e) => setElectricityMeter(e.target.value)}
            placeholder="e.g. 142.8 kWh (Meter #...)"
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Keys, Remotes &amp; Access Tags</label>
          <input
            type="text"
            value={keysNotes}
            onChange={(e) => setKeysNotes(e.target.value)}
            placeholder="e.g. 2x front keys, 1x gate remote, 1x tag"
            className="w-full px-3 py-2 rounded-xl bg-black/50 border border-white/15 text-xs text-white focus:outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      {/* Add Photo / Snag Controls */}
      <div className="rounded-3xl bg-zinc-900/90 border border-white/10 p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-extrabold">Add Room Photo &amp; Condition Note</h2>
          <span className="text-[11px] text-zinc-400">
            {items.length} item(s) documented
          </span>
        </div>

        <div className="flex items-center flex-wrap gap-1.5">
          {ROOM_PRESETS.map((room) => (
            <button
              key={room}
              type="button"
              onClick={() => {
                setSelectedRoom(room);
                setCustomRoom('');
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${!customRoom && selectedRoom === room
                ? 'bg-indigo-600 border-indigo-500 text-white'
                : 'bg-black/40 border-white/10 text-zinc-300 hover:bg-white/10'
                }`}
            >
              {room}
            </button>
          ))}
          <input
            type="text"
            value={customRoom}
            onChange={(e) => setCustomRoom(e.target.value)}
            placeholder="+ Custom room..."
            className="px-3 py-1.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white w-36 focus:outline-none focus:border-indigo-400"
          />
        </div>

        <div className="p-3 rounded-2xl bg-black/35 border border-white/10 space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-indigo-300">
            Checklist fields for {activeRoomName} (edit, remove, or add fields):
          </div>
          <div className="space-y-1.5">
            {activeRoomChecks.map((chk, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-zinc-200">
                <input
                  type="text"
                  value={chk}
                  onChange={(e) => handleUpdateRoomField(idx, e.target.value)}
                  className="flex-1 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-xs text-white focus:outline-none focus:border-indigo-400"
                />
                <button
                  type="button"
                  onClick={() => handleLogCheckNote(activeRoomName, chk)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-indigo-600 text-[10px] font-bold shrink-0 cursor-pointer transition-colors"
                >
                  + Log Check
                </button>
                <button
                  type="button"
                  onClick={() => handleRemoveRoomField(idx)}
                  className="p-1 text-zinc-500 hover:text-rose-400 cursor-pointer"
                  title="Remove field"
                >
                  <X size={13} weight="bold" />
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={newFieldText}
              onChange={(e) => setNewFieldText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddRoomField();
              }}
              placeholder={`+ Add custom field for ${activeRoomName}...`}
              className="flex-1 px-2.5 py-1 rounded-lg bg-black/50 border border-white/10 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400"
            />
            <button
              type="button"
              onClick={handleAddRoomField}
              className="px-2.5 py-1 rounded-lg bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-400/30 text-[11px] font-bold text-indigo-200 cursor-pointer"
            >
              + Add Field
            </button>
          </div>
        </div>

        <div className="flex items-center flex-wrap gap-3">
          <div className="flex items-center gap-1.5 bg-black/40 p-1 rounded-xl border border-white/10">
            {[
              { id: 'defect', label: 'Defect / Snag' },
              { id: 'minor_wear', label: 'Minor Wear' },
              { id: 'good', label: 'Clean / Good' },
            ].map((st) => (
              <button
                key={st.id}
                type="button"
                onClick={() => setNewStatus(st.id as any)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${newStatus === st.id ? 'bg-white text-zinc-950' : 'text-zinc-400 hover:text-white'
                  }`}
              >
                {st.label}
              </button>
            ))}
          </div>

          <label className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-extrabold cursor-pointer flex items-center gap-1.5">
            <Camera size={15} weight="bold" />
            <span>Upload Photos ({activeRoomName})</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                handleUploadPhotos(e.target.files);
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            onClick={handleAddTextOnlyItem}
            className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} weight="bold" />
            <span>Add Note Only</span>
          </button>
        </div>
      </div>

      {/* Documented Items List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-3xl bg-zinc-900/90 border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-indigo-200 text-[11px] font-extrabold">
                  {item.room}
                </span>
                <select
                  value={item.status}
                  onChange={(e) =>
                    setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, status: e.target.value as any } : x)))
                  }
                  className="px-2 py-0.5 rounded-lg bg-black/50 border border-white/15 text-[11px] font-bold text-white"
                >
                  <option value="defect">Defect / Snag</option>
                  <option value="minor_wear">Minor Wear</option>
                  <option value="good">Clean / Good</option>
                </select>
              </div>
              <button
                type="button"
                onClick={() => setItems((prev) => prev.filter((x) => x.id !== item.id))}
                className="text-zinc-500 hover:text-rose-400 p-1 cursor-pointer"
                title="Remove entry"
              >
                <Trash size={15} weight="bold" />
              </button>
            </div>

            {item.photo_data && (
              <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black">
                <img src={item.photo_data} alt={item.room} className="w-full h-48 object-cover" />
                <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded-md bg-black/75 text-[10px] font-bold text-zinc-200">
                  🕒 {item.captured_at}
                </span>
              </div>
            )}

            {!item.photo_data && (
              <div className="text-[11px] text-zinc-400 font-semibold">🕒 {item.captured_at}</div>
            )}

            <textarea
              rows={2}
              value={item.notes}
              onChange={(e) =>
                setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, notes: e.target.value } : x)))
              }
              placeholder="Describe exact condition or pre-existing defect..."
              className="w-full p-2.5 rounded-xl bg-black/50 border border-white/15 text-xs text-white placeholder:text-zinc-500 focus:outline-none focus:border-indigo-400 resize-none"
            />
          </div>
        ))}
      </div>
      </main>

      {privacyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-zinc-900 border border-white/15 p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-extrabold text-white">Public Snag Privacy Check</h3>
            <p className="text-xs text-zinc-300 leading-relaxed">
              Reporting snags publicly is <strong className="text-white">ON by default</strong> so future tenants can be aware of prior damage before signing a lease. Your name, agent details, and meter readings are never shared.
            </p>
            <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-black/40 border border-white/10 cursor-pointer">
              <input
                type="checkbox"
                checked={keepPrivateChecked}
                onChange={(e) => setKeepPrivateChecked(e.target.checked)}
                className="mt-0.5 rounded border-zinc-600 text-indigo-500 focus:ring-indigo-500"
              />
              <span className="text-xs font-semibold text-zinc-200">
                Keep this inspection Private (do not share snags publicly)
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPrivacyModalOpen(false)}
                className="px-3.5 py-2 rounded-xl bg-zinc-800 text-xs font-bold text-zinc-300 hover:bg-zinc-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmPrivacyAndSave}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white cursor-pointer"
              >
                {keepPrivateChecked ? 'Save Privately' : 'Confirm & Share Snags'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
