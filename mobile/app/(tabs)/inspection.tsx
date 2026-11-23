import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  analyzeInspectionPhoto,
  fetchInspections,
  fetchLiveListings,
  fetchPublicSnags,
  generateInspectionCriteria,
  MobileProperty,
  saveInspection,
} from '@/lib/api';
import { useHomeSeek } from '@/lib/store';
import { CAPE_TOWN_SUBURBS } from '@/constants/capeTown';

interface InspectionEntry {
  id: string;
  room: string;
  note: string;
  checks?: string[];
  photoUri?: string;
  photoData?: string;
  timestamp: string;
}

type PropertySourceTab = 'select' | 'address' | 'p24';

export default function InspectionScreen() {
  const { apiBaseUrl, authUser, compareList, favourites } = useHomeSeek();
  const [sourceTab, setSourceTab] = useState<PropertySourceTab>('select');
  const [selectedProperty, setSelectedProperty] = useState<MobileProperty | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchedListings, setSearchedListings] = useState<MobileProperty[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [inspectionId, setInspectionId] = useState<string | undefined>(undefined);
  const [propertyInput, setPropertyInput] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [waterMeter, setWaterMeter] = useState('');
  const [electricityMeter, setElectricityMeter] = useState('');
  const [keysNotes, setKeysNotes] = useState('');
  const [isPublicSnags, setIsPublicSnags] = useState(true);
  const [privacyConfirmed, setPrivacyConfirmed] = useState(false);
  const [privacyModalOpen, setPrivacyModalOpen] = useState(false);
  const [keepPrivateChecked, setKeepPrivateChecked] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<InspectionEntry[] | null>(null);
  const [publicSnags, setPublicSnags] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const [roomName, setRoomName] = useState('Lounge / Living Room');
  const [note, setNote] = useState('');
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [photoBase64, setPhotoBase64] = useState<string | undefined>(undefined);
  const [entries, setEntries] = useState<InspectionEntry[]>([]);
  const [criteriaRooms, setCriteriaRooms] = useState<{ room: string; checks: string[] }[]>([]);
  const [isGeneratingCriteria, setIsGeneratingCriteria] = useState(false);
  const [isAnalyzingPhoto, setIsAnalyzingPhoto] = useState(false);
  const [analyzingEntryId, setAnalyzingEntryId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchInspections(apiBaseUrl, authUser.idToken, authUser.uid)
      .then((res) => {
        if (!active || !res?.inspections?.length) return;
        const latest = res.inspections[0];
        setInspectionId(latest.id);
        setPropertyAddress(latest.property_address || '');
        setWaterMeter(latest.water_meter || '');
        setElectricityMeter(latest.electricity_meter || '');
        setKeysNotes(latest.keys_notes || '');
        setIsPublicSnags(Boolean(latest.is_public_snags));
        const mapped: InspectionEntry[] = (latest.items || []).map((it: any) => {
          const pData = it.photo_data || '';
          const fullUri = pData.startsWith('/api/') ? `${apiBaseUrl}${pData}` : pData || undefined;
          return {
            id: it.id,
            room: it.room || 'General',
            note: it.notes || '',
            photoUri: fullUri,
            photoData: pData,
            timestamp: it.captured_at || '',
          };
        });
        setEntries(mapped);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [apiBaseUrl, authUser.uid, authUser.idToken]);

  useEffect(() => {
    const pid = selectedProperty?.p24_id || selectedProperty?.id || '';
    const addr = propertyAddress.trim();
    const sub = selectedProperty?.suburb || '';
    if (!pid && !addr && !sub) {
      setPublicSnags([]);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      fetchPublicSnags(apiBaseUrl, { property_id: pid, address: addr, suburb: sub })
        .then((res) => {
          if (active) setPublicSnags(res?.reports || []);
        })
        .catch(() => {});
    }, 350);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [apiBaseUrl, selectedProperty, propertyAddress]);

  const candidateProperties = useMemo(() => {
    const map = new Map<string, MobileProperty>();
    [...favourites, ...compareList, ...searchedListings].forEach((p) => {
      if (p?.id && (p?.title || p?.address) && !map.has(p.id)) map.set(p.id, p);
    });
    const all = Array.from(map.values());
    const q = searchQuery.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) =>
      `${p.title} ${p.address} ${p.suburb || ''}`.toLowerCase().includes(q)
    );
  }, [favourites, compareList, searchedListings, searchQuery]);

  const handlePropertySearch = async (overrideArea?: string) => {
    const q = (overrideArea ?? searchQuery).trim();
    if (overrideArea !== undefined) setSearchQuery(overrideArea);
    setIsSearching(true);
    try {
      const matchedAreas = q
        ? CAPE_TOWN_SUBURBS.filter((s) => s.toLowerCase().includes(q.toLowerCase())).slice(0, 3)
        : ['Noordhoek', 'Hout Bay', 'Claremont'];
      const areas = matchedAreas.length > 0 ? matchedAreas : [q || 'Noordhoek'];
      const res = await fetchLiveListings(apiBaseUrl, {
        suburbs: areas,
        min_price: 5000,
        max_price: 45000,
        bedrooms: 'any',
        force_fresh: false,
      });
      setSearchedListings(res.listings || []);
    } catch {
      Alert.alert('Search Error', `Could not reach backend at ${apiBaseUrl}`);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectProperty = (prop: MobileProperty) => {
    setSelectedProperty(prop);
    setPropertyAddress(prop.address || prop.title);
    setPropertyInput(prop.url || prop.title);
  };

  const handleGenerateCriteria = async () => {
    if (!propertyInput.trim() && !propertyAddress.trim()) {
      Alert.alert('Enter Property Details', 'Paste a Property24 link, address, or unit description first.');
      return;
    }
    setIsGeneratingCriteria(true);
    try {
      const res = await generateInspectionCriteria(apiBaseUrl, propertyInput, propertyAddress);
      const rooms: { room: string; checks: string[] }[] = res?.criteria?.rooms || [];
      setCriteriaRooms(rooms);
      if (rooms.length > 0) {
        setEntries((prev) => {
          const existingRooms = new Set(prev.map((e) => e.room.toLowerCase()));
          const stamp = new Date().toLocaleString();
          const generated: InspectionEntry[] = rooms
            .filter((r) => !existingRooms.has(r.room.toLowerCase()))
            .map((r, idx) => ({
              id: `insp-${Date.now()}-${idx}`,
              room: r.room,
              checks: r.checks || [],
              note: (r.checks || []).join(' • '),
              timestamp: stamp,
            }));
          return [...prev, ...generated];
        });
      }
    } catch {
      Alert.alert('Error', 'Could not reach backend inspection AI.');
    } finally {
      setIsGeneratingCriteria(false);
    }
  };

  const attachPhotoToEntry = async (entryId: string, fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow camera/photo access to document condition.');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 });

    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const target = entries.find((e) => e.id === entryId);
    const dataUrl = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : '';

    let nextNote = target?.note || '';
    if (dataUrl) {
      setAnalyzingEntryId(entryId);
      try {
        const aiRes = await analyzeInspectionPhoto(apiBaseUrl, target?.room || 'General', dataUrl, nextNote);
        if (aiRes?.description) {
          nextNote = aiRes.description;
        }
      } catch {
        // Keep existing note if AI fails
      } finally {
        setAnalyzingEntryId(null);
      }
    }

    const updated = entries.map((e) =>
      e.id === entryId
        ? {
            ...e,
            photoUri: asset.uri,
            photoData: dataUrl || e.photoData || '',
            note: nextNote,
            timestamp: new Date().toLocaleString(),
          }
        : e
    );
    setEntries(updated);

    if (!privacyConfirmed) {
      setKeepPrivateChecked(!isPublicSnags);
      setPendingEntries(updated);
      setPrivacyModalOpen(true);
    } else {
      await persistInspectionToDb(updated);
    }
  };

  const pickImage = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow camera/photo access to document condition.');
      return;
    }
    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.6 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.6 });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      if (asset.base64) {
        const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
        setPhotoBase64(dataUrl);
        setIsAnalyzingPhoto(true);
        try {
          const aiRes = await analyzeInspectionPhoto(apiBaseUrl, roomName, dataUrl, note);
          if (aiRes?.description) {
            setNote(aiRes.description);
          }
        } catch {
          // Allow manual note entry
        } finally {
          setIsAnalyzingPhoto(false);
        }
      }
    }
  };

  const persistInspectionToDb = async (nextEntries: InspectionEntry[], overridePublic?: boolean) => {
    setIsSaving(true);
    const effectivePublic = overridePublic !== undefined ? overridePublic : isPublicSnags;
    try {
      const res = await saveInspection(
        apiBaseUrl,
        {
          id: inspectionId,
          property_id: selectedProperty?.p24_id || selectedProperty?.id || '',
          property_address: propertyAddress || propertyInput,
          suburb: selectedProperty?.suburb || '',
          lat: selectedProperty?.lat || 0,
          lng: selectedProperty?.lng || 0,
          is_public_snags: effectivePublic,
          water_meter: waterMeter,
          electricity_meter: electricityMeter,
          keys_notes: keysNotes,
          items: nextEntries.map((e) => ({
            id: e.id,
            room: e.room,
            status: 'defect',
            notes: e.note,
            captured_at: e.timestamp,
            photo_data: e.photoData || '',
          })),
        },
        authUser.idToken,
        authUser.uid
      );
      if (res?.id) setInspectionId(res.id);
      if (Array.isArray(res?.items)) {
        setEntries(
          res.items.map((it: any) => {
            const pData = it.photo_data || '';
            const fullUri = pData.startsWith('/api/') ? `${apiBaseUrl}${pData}` : pData || undefined;
            return {
              id: it.id,
              room: it.room,
              note: it.notes,
              photoUri: fullUri,
              photoData: pData,
              timestamp: it.captured_at,
            };
          })
        );
      }
    } catch {
      Alert.alert('Save Warning', 'Entry added locally, but could not sync to backend DB.');
    } finally {
      setIsSaving(false);
    }
  };

  const addEntry = async () => {
    if (!roomName.trim() || (!note.trim() && !photoUri)) return;
    const newEntry: InspectionEntry = {
      id: `insp-${Date.now()}`,
      room: roomName.trim(),
      note: note.trim() || 'Condition photo documented.',
      photoUri,
      photoData: photoBase64 || '',
      timestamp: new Date().toLocaleString(),
    };
    const nextEntries = [newEntry, ...entries];
    setEntries(nextEntries);
    setNote('');
    setPhotoUri(undefined);
    setPhotoBase64(undefined);
    if (!privacyConfirmed) {
      setKeepPrivateChecked(!isPublicSnags);
      setPendingEntries(nextEntries);
      setPrivacyModalOpen(true);
      return;
    }
    await persistInspectionToDb(nextEntries);
  };

  const confirmPrivacyAndSave = async () => {
    const nextPublic = !keepPrivateChecked;
    setIsPublicSnags(nextPublic);
    setPrivacyConfirmed(true);
    setPrivacyModalOpen(false);
    const toSave = pendingEntries || entries;
    setPendingEntries(null);
    await persistInspectionToDb(toSave, nextPublic);
  };

  const shareReport = async () => {
    const header = `INGOING MOVE-IN INSPECTION REPORT\nProperty: ${propertyAddress || propertyInput || 'Unspecified'}\nMeters: Water ${waterMeter || '-'} | Elec ${electricityMeter || '-'}\nKeys: ${keysNotes || '-'}\nGenerated: ${new Date().toLocaleString()}\n\n`;
    const body = entries
      .map((e, i) => `${i + 1}. [${e.room}] (${e.timestamp})\n   ${e.note}`)
      .join('\n\n');
    await Share.share({ message: header + (body || 'No entries recorded yet.') });
  };

  const openPhotoPdf = async () => {
    if (!inspectionId) {
      await persistInspectionToDb(entries);
    }
    if (inspectionId) {
      Linking.openURL(`${apiBaseUrl}/api/inspections/${inspectionId}/pdf`);
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Property Details & AI Criteria Generator */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>1. Property Details & AI Checklist</Text>

        {/* Source Tabs: Select / Address / P24 Link */}
        <View style={styles.tabRow}>
          {(
            [
              { key: 'select', label: 'Select' },
              { key: 'address', label: 'Address' },
              { key: 'p24', label: 'P24 Link' },
            ] as const
          ).map((t) => {
            const active = sourceTab === t.key;
            return (
              <Pressable
                key={t.key}
                onPress={() => setSourceTab(t.key)}
                style={[styles.tabPill, active && styles.tabPillActive]}
              >
                <Text style={[styles.tabPillText, active && styles.tabPillTextActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {sourceTab === 'select' && (
          <View style={{ gap: 8 }}>
            {selectedProperty ? (
              <View style={styles.selectedPropCard}>
                {selectedProperty.image ? (
                  <Image source={{ uri: selectedProperty.image }} style={styles.propThumb} />
                ) : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.propTitle} numberOfLines={1}>{selectedProperty.title}</Text>
                  <Text style={styles.propSub} numberOfLines={1}>{selectedProperty.address}</Text>
                  <Text style={styles.propPrice}>R {selectedProperty.price?.toLocaleString()}/mo</Text>
                </View>
                <Pressable onPress={() => setSelectedProperty(null)} style={styles.changeBtn}>
                  <Text style={styles.changeBtnText}>Change</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <View style={styles.searchRow}>
                  <TextInput
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    onSubmitEditing={() => handlePropertySearch()}
                    placeholder="Search suburb or property (e.g. Noordhoek)..."
                    style={[styles.input, { flex: 1 }]}
                    returnKeyType="search"
                  />
                  <Pressable
                    style={styles.searchBtn}
                    onPress={() => handlePropertySearch()}
                    disabled={isSearching}
                  >
                    {isSearching ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Ionicons name="search" size={16} color="#fff" />
                    )}
                  </Pressable>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                  {['Noordhoek', 'Hout Bay', 'Muizenberg', 'Claremont', 'Sea Point'].map((area) => (
                    <Pressable
                      key={area}
                      onPress={() => handlePropertySearch(area)}
                      style={styles.areaChip}
                    >
                      <Text style={styles.areaChipText}>{area}</Text>
                    </Pressable>
                  ))}
                </ScrollView>

                {candidateProperties.length === 0 ? (
                  <Text style={styles.emptySub}>
                    Tap a suburb chip or search above to pick a property from cached listings, favourites, or compare.
                  </Text>
                ) : (
                  <View style={{ gap: 6, maxHeight: 240 }}>
                    <Text style={styles.selectHint}>Tap a property below to select it:</Text>
                    <ScrollView nestedScrollEnabled contentContainerStyle={{ gap: 6 }}>
                      {candidateProperties.slice(0, 12).map((prop) => (
                        <Pressable
                          key={prop.id}
                          onPress={() => handleSelectProperty(prop)}
                          style={styles.propRow}
                        >
                          {prop.image ? (
                            <Image source={{ uri: prop.image }} style={styles.propThumb} />
                          ) : null}
                          <View style={{ flex: 1 }}>
                            <Text style={styles.propTitle} numberOfLines={1}>{prop.title}</Text>
                            <Text style={styles.propSub} numberOfLines={1}>{prop.address}</Text>
                            {prop.price ? (
                              <Text style={styles.propPrice}>R {Number(prop.price).toLocaleString()}/mo</Text>
                            ) : null}
                          </View>
                          <View style={styles.selectPill}>
                            <Text style={styles.selectPillText}>Select</Text>
                          </View>
                        </Pressable>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {sourceTab === 'address' && (
          <View style={{ gap: 8 }}>
            <TextInput
              value={propertyAddress}
              onChangeText={setPropertyAddress}
              placeholder="Property address (e.g. 7 Chapmans Peak Dr, Hout Bay)"
              style={styles.input}
            />
            <TextInput
              value={propertyInput}
              onChangeText={setPropertyInput}
              placeholder="Optional features (gas hob, parquet, balcony, garden...)"
              style={styles.input}
            />
          </View>
        )}

        {sourceTab === 'p24' && (
          <View style={{ gap: 8 }}>
            <TextInput
              value={propertyInput}
              onChangeText={setPropertyInput}
              autoCapitalize="none"
              placeholder="Paste Property24 link (https://www.property24.com/to-rent/...)"
              style={styles.input}
            />
            <TextInput
              value={propertyAddress}
              onChangeText={setPropertyAddress}
              placeholder="Optional street address label for report"
              style={styles.input}
            />
          </View>
        )}
        <Pressable
          style={[
            styles.primaryBtn,
            sourceTab === 'select' && !selectedProperty && { opacity: 0.45 },
          ]}
          onPress={handleGenerateCriteria}
          disabled={isGeneratingCriteria || (sourceTab === 'select' && !selectedProperty)}
        >
          {isGeneratingCriteria ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Ionicons name="sparkles" size={14} color="#fde047" />
          )}
          <Text style={styles.primaryBtnText}>
            {isGeneratingCriteria
              ? 'Generating Checklist...'
              : sourceTab === 'select' && !selectedProperty
              ? 'Select a Property Above First'
              : 'Generate Tailored AI Room Criteria'}
          </Text>
        </Pressable>

        {criteriaRooms.length > 0 && (
          <Text style={styles.aiStatus}>
            Generated {criteriaRooms.length} room cards below — just snap photos and AI will write the report!
          </Text>
        )}
      </View>

      {/* Add Timestamped Photo & Note */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>2. Add Room Photo & Condition Note</Text>
        <TextInput
          value={roomName}
          onChangeText={setRoomName}
          placeholder="Room (e.g. Kitchen, Main Bedroom)"
          style={styles.input}
        />
        <View style={styles.rowBtns}>
          <Pressable style={styles.secondaryBtn} onPress={() => pickImage(true)}>
            <Ionicons name="camera" size={15} color="#4f46e5" />
            <Text style={styles.secondaryBtnText}>Take Photo</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={() => pickImage(false)}>
            <Ionicons name="images" size={15} color="#4f46e5" />
            <Text style={styles.secondaryBtnText}>Choose Photo</Text>
          </Pressable>
        </View>
        {photoUri && <Image source={{ uri: photoUri }} style={styles.previewImg} />}
        {isAnalyzingPhoto && (
          <Text style={styles.aiStatus}>AI inspecting photo for scuffs, damp & defects...</Text>
        )}
        <TextInput
          value={note}
          onChangeText={setNote}
          multiline
          placeholder="Condition note (auto-filled by AI when you attach a photo, or type manually)..."
          style={[styles.input, { minHeight: 68 }]}
        />
        <Pressable style={styles.saveBtn} onPress={addEntry}>
          <Text style={styles.primaryBtnText}>+ Save Timestamped Entry</Text>
        </Pressable>
      </View>

      {/* Meters, Keys & Public Snags Opt-In */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Meters, Keys & Community Snags</Text>
        <View style={styles.rowBtns}>
          <TextInput
            value={waterMeter}
            onChangeText={setWaterMeter}
            placeholder="Water meter"
            style={[styles.input, { flex: 1 }]}
          />
          <TextInput
            value={electricityMeter}
            onChangeText={setElectricityMeter}
            placeholder="Electricity meter"
            style={[styles.input, { flex: 1 }]}
          />
        </View>
        <TextInput
          value={keysNotes}
          onChangeText={setKeysNotes}
          placeholder="Keys, remotes & tags count (e.g. 2x front, 1x gate remote)"
          style={styles.input}
        />
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={styles.propTitle}>Share snags anonymously</Text>
            <Text style={styles.propSub}>Warn future renters if this address is relisted (PII stripped)</Text>
          </View>
          <Switch value={isPublicSnags} onValueChange={setIsPublicSnags} trackColor={{ true: '#4f46e5' }} />
        </View>
        <Pressable style={styles.secondaryBtn} onPress={() => persistInspectionToDb(entries)} disabled={isSaving}>
          <Text style={styles.secondaryBtnText}>{isSaving ? 'Saving...' : 'Save Inspection to Database'}</Text>
        </Pressable>
      </View>

      {publicSnags.length > 0 && (
        <View style={[styles.card, { borderColor: '#fde68a', backgroundColor: '#fffbeb' }]}>
          <Text style={[styles.sectionTitle, { color: '#92400e' }]}>
            Past Reported Snags Nearby / At Address ({publicSnags.length})
          </Text>
          {publicSnags.slice(0, 3).map((rep, idx) => (
            <View key={idx} style={{ gap: 2 }}>
              <Text style={styles.propTitle}>
                {rep.match_type === 'exact_property' ? 'Exact Listing Match' : rep.match_type === 'address_match' ? 'Address Match' : 'Area Ghost Snag'} · {rep.property_address || rep.suburb}
              </Text>
              {(rep.snags || []).slice(0, 3).map((s: any, si: number) => (
                <Text key={si} style={styles.criteriaCheck}>• [{s.room}] {s.notes}</Text>
              ))}
            </View>
          ))}
        </View>
      )}

      {/* Recorded Entries */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Recorded Evidence ({entries.length})</Text>
          {entries.length > 0 && (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {inspectionId && (
                <Pressable style={[styles.shareBtn, { backgroundColor: '#4f46e5' }]} onPress={openPhotoPdf}>
                  <Ionicons name="document-text-outline" size={14} color="#fff" />
                  <Text style={styles.primaryBtnText}>Photo PDF</Text>
                </Pressable>
              )}
              <Pressable style={styles.shareBtn} onPress={shareReport}>
                <Ionicons name="share-outline" size={14} color="#fff" />
                <Text style={styles.primaryBtnText}>Share</Text>
              </Pressable>
            </View>
          )}
        </View>
        {entries.length === 0 ? (
          <Text style={styles.emptySub}>
            Tap &quot;Generate Tailored AI Room Criteria&quot; above to auto-populate room cards, or add a custom room below.
          </Text>
        ) : (
          entries.map((item) => (
            <View key={item.id} style={styles.roomEntryCard}>
              <View style={styles.rowBetween}>
                <Text style={styles.entryRoom}>{item.room}</Text>
                <Text style={styles.entryTime}>{item.timestamp}</Text>
              </View>
              {item.checks && item.checks.length > 0 && (
                <View style={{ gap: 2 }}>
                  {item.checks.map((c, ci) => (
                    <Text key={ci} style={styles.criteriaCheck}>• {c}</Text>
                  ))}
                </View>
              )}
              {item.photoUri ? <Image source={{ uri: item.photoUri }} style={styles.previewImg} /> : null}
              {analyzingEntryId === item.id && (
                <Text style={styles.aiStatus}>AI analyzing photo & writing condition report...</Text>
              )}
              <TextInput
                value={item.note}
                onChangeText={(txt) =>
                  setEntries((prev) => prev.map((e) => (e.id === item.id ? { ...e, note: txt } : e)))
                }
                multiline
                placeholder="Condition / defect report (auto-written by AI when you add a photo)..."
                style={[styles.input, { minHeight: 58 }]}
              />
              <View style={styles.rowBtns}>
                <Pressable style={styles.secondaryBtn} onPress={() => attachPhotoToEntry(item.id, true)}>
                  <Ionicons name="camera" size={14} color="#4f46e5" />
                  <Text style={styles.secondaryBtnText}>Take Photo</Text>
                </Pressable>
                <Pressable style={styles.secondaryBtn} onPress={() => attachPhotoToEntry(item.id, false)}>
                  <Ionicons name="images" size={14} color="#4f46e5" />
                  <Text style={styles.secondaryBtnText}>Choose Photo</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </View>

      {/* Snag Privacy Check Popup */}
      <Modal visible={privacyModalOpen} transparent animationType="fade" onRequestClose={() => setPrivacyModalOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="shield-checkmark" size={20} color="#4f46e5" />
              <Text style={styles.modalTitle}>Public Snag Privacy Check</Text>
            </View>
            <Text style={styles.modalBody}>
              Reporting snags publicly is <Text style={{ fontWeight: '800', color: '#09090b' }}>ON by default</Text> so future tenants can see prior damage (such as damp, broken locks, or leaks) before signing a lease. Your name, contact info, agent details, and meter readings are never shared.
            </Text>
            <Pressable
              style={styles.checkboxRow}
              onPress={() => setKeepPrivateChecked((v) => !v)}
            >
              <Ionicons
                name={keepPrivateChecked ? 'checkbox' : 'square-outline'}
                size={22}
                color={keepPrivateChecked ? '#4f46e5' : '#71717a'}
              />
              <Text style={styles.checkboxLabel}>
                Keep this inspection Private (do not share snags publicly)
              </Text>
            </Pressable>
            <Pressable style={styles.primaryBtn} onPress={confirmPrivacyAndSave}>
              <Text style={styles.primaryBtnText}>
                {keepPrivateChecked ? 'Save Privately' : 'Confirm & Share Snags Anonymously'}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f4f5' },
  content: { padding: 12, gap: 12, paddingBottom: 30 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e4e4e7', gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', color: '#3f3f46' },
  input: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12.5, color: '#09090b' },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 11 },
  primaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  saveBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#09090b', borderRadius: 12, paddingVertical: 11 },
  rowBtns: { flexDirection: 'row', gap: 8 },
  secondaryBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 12, paddingVertical: 10 },
  secondaryBtnText: { color: '#312e81', fontSize: 12, fontWeight: '800' },
  previewImg: { width: '100%', height: 170, borderRadius: 12 },
  aiStatus: { fontSize: 11.5, fontWeight: '700', color: '#6d28d9' },
  criteriaCard: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 3 },
  criteriaRoom: { fontSize: 12.5, fontWeight: '800', color: '#09090b' },
  criteriaCheck: { fontSize: 11.5, color: '#334155' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#059669', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  emptySub: { fontSize: 12, color: '#71717a' },
  entryCard: { flexDirection: 'row', gap: 10, padding: 10, borderRadius: 12, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7' },
  roomEntryCard: { gap: 8, padding: 12, borderRadius: 14, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7' },
  entryImg: { width: 64, height: 64, borderRadius: 10 },
  entryRoom: { fontSize: 13, fontWeight: '800', color: '#09090b' },
  entryTime: { fontSize: 10.5, color: '#71717a', marginBottom: 3 },
  entryNote: { fontSize: 12, color: '#27272a', lineHeight: 17 },
  tabRow: { flexDirection: 'row', backgroundColor: '#f4f4f5', borderRadius: 12, padding: 3, gap: 4 },
  tabPill: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center' },
  tabPillActive: { backgroundColor: '#ffffff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 3, elevation: 1 },
  tabPillText: { fontSize: 12, fontWeight: '700', color: '#71717a' },
  tabPillTextActive: { color: '#4f46e5', fontWeight: '800' },
  searchRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  searchBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  areaChip: { backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 },
  areaChipText: { fontSize: 11.5, fontWeight: '700', color: '#4338ca' },
  propRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7' },
  selectedPropCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  propThumb: { width: 46, height: 46, borderRadius: 9, backgroundColor: '#e4e4e7' },
  propTitle: { fontSize: 12.5, fontWeight: '800', color: '#09090b' },
  propSub: { fontSize: 11, color: '#71717a' },
  propPrice: { fontSize: 11.5, fontWeight: '800', color: '#059669' },
  changeBtn: { backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  changeBtnText: { fontSize: 11, fontWeight: '800', color: '#4f46e5' },
  selectHint: { fontSize: 11.5, fontWeight: '700', color: '#4338ca' },
  selectPill: { backgroundColor: '#4f46e5', borderRadius: 999, paddingHorizontal: 11, paddingVertical: 6 },
  selectPillText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,9,11,0.55)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 20, padding: 18, gap: 12 },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#09090b' },
  modalBody: { fontSize: 12.5, lineHeight: 18, color: '#3f3f46' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, backgroundColor: '#f4f4f5' },
  checkboxLabel: { flex: 1, fontSize: 12.5, fontWeight: '700', color: '#09090b' },
});
