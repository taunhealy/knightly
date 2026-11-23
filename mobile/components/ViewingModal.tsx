import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import {
  fetchListingComments,
  fetchNearbyListings,
  MobileProperty,
  postListingComment,
  submitListingUnit,
} from '@/lib/api';
import { useHomeSeek } from '@/lib/store';

interface ViewingModalProps {
  visible: boolean;
  onClose: () => void;
  initialProperty?: MobileProperty | null;
}

interface PendingMedia {
  type: 'image' | 'video';
  uri: string;
  dataUrl: string;
  caption: string;
}

const VIEWING_CHECKBOXES = [
  'Noise upstairs',
  'Tenant upstairs',
  'Landlord upstairs / on-site',
  'Thin walls (hear neighbours)',
  'Thick brick walls (quiet)',
  'Wooden / parquet flooring',
  'Tiled floors (echo)',
  'Street / traffic noise',
  'Damp / musty smell',
  'Good natural light',
  'Dark / shaded unit',
  'Weak cell signal',
  'Fibre box visible',
  'Low water pressure',
  'Gas hob / inverter',
  'Tight parking bay',
];

export const ViewingModal: React.FC<ViewingModalProps> = ({ visible, onClose, initialProperty }) => {
  const { apiBaseUrl, authUser } = useHomeSeek();
  const [selected, setSelected] = useState<MobileProperty | null>(initialProperty || null);
  const [nearby, setNearby] = useState<any[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('Detecting GPS location...');

  const [floorNumber, setFloorNumber] = useState('');
  const [unitNumber, setUnitNumber] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [commentBody, setCommentBody] = useState('');
  const [pendingMedia, setPendingMedia] = useState<PendingMedia[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected(initialProperty || null);
    if (!initialProperty) {
      detectLocationAndFetch('');
    }
  }, [visible, initialProperty]);

  useEffect(() => {
    if (!visible || !selected) return;
    fetchListingComments(apiBaseUrl, selected.id, selected.address)
      .then((res) => setComments(res?.comments || []))
      .catch(() => setComments([]));
  }, [visible, selected, apiBaseUrl]);

  const detectLocationAndFetch = async (queryText: string) => {
    setLoadingNearby(true);
    let lat: number | undefined;
    let lng: number | undefined;
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status === 'granted') {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        setGpsStatus(`GPS locked (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      } else {
        setGpsStatus('GPS permission denied — showing area listings');
      }
    } catch {
      setGpsStatus('GPS unavailable — showing area listings');
    }

    try {
      const res = await fetchNearbyListings(apiBaseUrl, { lat, lng, q: queryText.trim() });
      setNearby(res?.listings || []);
    } catch {
      setNearby([]);
    } finally {
      setLoadingNearby(false);
    }
  };

  const addMedia = async (fromCamera: boolean) => {
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission Needed', 'Please allow camera/gallery access to attach viewing photos or videos.');
      return;
    }
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images', 'videos'],
      base64: true,
      quality: 0.55,
      videoMaxDuration: 20,
    };
    const res = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);

    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      const isVid = a.type === 'video';
      const dataUrl = a.base64
        ? `data:${isVid ? 'video/mp4' : 'image/jpeg'};base64,${a.base64}`
        : a.uri;
      setPendingMedia((prev) => [
        ...prev,
        { type: isVid ? 'video' : 'image', uri: a.uri, dataUrl, caption: '' },
      ]);
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!selected) return;
    if (!commentBody.trim() && pendingMedia.length === 0 && selectedTags.length === 0) {
      Alert.alert('Add Details', 'Check at least one observation, enter feedback, or attach a photo/video.');
      return;
    }
    setPosting(true);
    try {
      const res = await postListingComment(apiBaseUrl, selected.id, {
        user_id: authUser.uid,
        body: commentBody.trim(),
        floor_number: floorNumber.trim(),
        unit_number: unitNumber.trim(),
        address: selected.address || '',
        tags: selectedTags,
        media: pendingMedia.map((m) => ({
          type: m.type,
          data: m.dataUrl,
          caption: m.caption.trim(),
        })),
      });
      if (res?.comment) {
        setComments((prev) => [res.comment, ...prev]);
      }
      setCommentBody('');
      setSelectedTags([]);
      setPendingMedia([]);
      Alert.alert('Posted', 'Your viewing photos & notes are now saved to this listing.');
    } catch {
      Alert.alert('Post Failed', 'Could not post viewing update to backend.');
    } finally {
      setPosting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.screen}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>At a Viewing · Community Intel</Text>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={20} color="#09090b" />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {!selected ? (
            <View style={{ gap: 10 }}>
              <Text style={styles.gpsBadge}>{gpsStatus}</Text>
              <View style={styles.searchRow}>
                <TextInput
                  value={searchQ}
                  onChangeText={setSearchQ}
                  onSubmitEditing={() => detectLocationAndFetch(searchQ)}
                  placeholder="Filter by street, suburb, or title..."
                  style={[styles.input, { flex: 1 }]}
                />
                <Pressable style={styles.searchBtn} onPress={() => detectLocationAndFetch(searchQ)}>
                  <Ionicons name="search" size={16} color="#fff" />
                </Pressable>
              </View>

              {loadingNearby ? (
                <ActivityIndicator size="large" color="#4f46e5" style={{ marginTop: 24 }} />
              ) : nearby.length === 0 ? (
                <Text style={styles.empty}>No cached listings found nearby. Search a suburb in Search first.</Text>
              ) : (
                nearby.map((item) => (
                  <Pressable key={item.id} style={styles.pickRow} onPress={() => setSelected(item)}>
                    {item.image ? <Image source={{ uri: item.image }} style={styles.thumb} /> : null}
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={[styles.tierPill, item.match_tier === 'proximity' && styles.tierProx]}>
                          {item.match_tier === 'proximity'
                            ? `${item.distance_m}m away`
                            : item.suburb || 'Area'}
                        </Text>
                      </View>
                      <Text style={styles.pickTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.pickAddr} numberOfLines={1}>{item.address}</Text>
                    </View>
                    <Text style={styles.pickPrice}>R {Number(item.price || 0).toLocaleString()}</Text>
                  </Pressable>
                ))
              )}
            </View>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={styles.selectedCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.pickTitle}>{selected.title}</Text>
                  <Text style={styles.pickAddr}>{selected.address}</Text>
                </View>
                <Pressable onPress={() => setSelected(null)} style={styles.changeBtn}>
                  <Text style={styles.changeText}>Change</Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Add Viewing Photos, Video & Notes</Text>
                <View style={styles.row}>
                  <TextInput
                    value={floorNumber}
                    onChangeText={setFloorNumber}
                    placeholder="Floor (e.g. Ground, 3)"
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TextInput
                    value={unitNumber}
                    onChangeText={setUnitNumber}
                    placeholder="Apt / Unit # (e.g. 4B)"
                    style={[styles.input, { flex: 1 }]}
                  />
                </View>
                {(floorNumber.trim() || unitNumber.trim()) ? (
                  <Pressable
                    style={styles.mediaBtn}
                    onPress={async () => {
                      try {
                        await submitListingUnit(apiBaseUrl, selected.id, floorNumber, unitNumber);
                        Alert.alert('Saved', 'Floor & apartment number saved to this listing.');
                      } catch {
                        Alert.alert('Error', 'Could not save unit details to listing.');
                      }
                    }}
                  >
                    <Ionicons name="checkmark-circle-outline" size={15} color="#4f46e5" />
                    <Text style={styles.mediaBtnText}>Save Floor / Apt to Listing</Text>
                  </Pressable>
                ) : null}
                <View style={styles.row}>
                  <Pressable style={styles.mediaBtn} onPress={() => addMedia(true)}>
                    <Ionicons name="camera" size={15} color="#4f46e5" />
                    <Text style={styles.mediaBtnText}>Camera (Photo/Video)</Text>
                  </Pressable>
                  <Pressable style={styles.mediaBtn} onPress={() => addMedia(false)}>
                    <Ionicons name="images" size={15} color="#4f46e5" />
                    <Text style={styles.mediaBtnText}>Gallery</Text>
                  </Pressable>
                </View>

                {pendingMedia.map((m, idx) => (
                  <View key={idx} style={styles.pendingItem}>
                    {m.type === 'image' ? (
                      <Image source={{ uri: m.uri }} style={styles.pendingImg} />
                    ) : (
                      <View style={[styles.pendingImg, { backgroundColor: '#18181b', alignItems: 'center', justifyContent: 'center' }]}>
                        <Ionicons name="videocam" size={22} color="#fff" />
                      </View>
                    )}
                    <TextInput
                      value={m.caption}
                      onChangeText={(txt) =>
                        setPendingMedia((prev) => prev.map((x, i) => (i === idx ? { ...x, caption: txt } : x)))
                      }
                      placeholder="Caption (e.g. Damp behind wardrobe, loud road)"
                      style={[styles.input, { flex: 1 }]}
                    />
                  </View>
                ))}

                <Text style={styles.sectionTitle}>Unlisted Details Observed (Tap to Check)</Text>
                <View style={styles.tagWrap}>
                  {VIEWING_CHECKBOXES.map((tag) => {
                    const checked = selectedTags.includes(tag);
                    return (
                      <Pressable
                        key={tag}
                        onPress={() => toggleTag(tag)}
                        style={[styles.tagChip, checked && styles.tagChipActive]}
                      >
                        <Ionicons
                          name={checked ? 'checkbox' : 'square-outline'}
                          size={14}
                          color={checked ? '#4338ca' : '#71717a'}
                        />
                        <Text style={[styles.tagChipText, checked && styles.tagChipTextActive]}>
                          {tag}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <TextInput
                  value={commentBody}
                  onChangeText={setCommentBody}
                  multiline
                  placeholder="Viewing feedback (noise, natural light, landlord vibe, damp, cell signal)..."
                  style={[styles.input, { minHeight: 70 }]}
                />

                <Pressable style={styles.postBtn} onPress={handleSubmit} disabled={posting}>
                  <Text style={styles.postBtnText}>{posting ? 'Posting...' : 'Post Viewing Update'}</Text>
                </Pressable>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Community Viewing Feed ({comments.length})</Text>
                {comments.length === 0 ? (
                  <Text style={styles.empty}>No viewing notes or photos yet. Be the first!</Text>
                ) : (
                  comments.map((c) => (
                    <View key={c.id} style={styles.commentCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={styles.commentAuthor}>u/{c.nickname}</Text>
                        {(c.floor_number || c.unit_number) ? (
                          <Text style={styles.unitTag}>
                            {[c.floor_number ? `Floor ${c.floor_number}` : '', c.unit_number ? `Unit ${c.unit_number}` : '']
                              .filter(Boolean)
                              .join(' · ')}
                          </Text>
                        ) : null}
                      </View>
                      {c.body ? <Text style={styles.commentBody}>{c.body}</Text> : null}
                      {Array.isArray(c.tags) && c.tags.length > 0 ? (
                        <View style={styles.tagWrap}>
                          {c.tags.map((t: string, ti: number) => (
                            <Text key={ti} style={styles.savedTagPill}>✓ {t}</Text>
                          ))}
                        </View>
                      ) : null}
                      {(c.media || []).map((m: any, mi: number) => {
                        const uri = String(m.url || '').startsWith('/api/') ? `${apiBaseUrl}${m.url}` : m.url;
                        return (
                          <View key={mi} style={{ gap: 4, marginTop: 4 }}>
                            {m.type === 'image' && uri ? (
                              <Image source={{ uri }} style={styles.commentImg} />
                            ) : (
                              <Text style={styles.videoBadge}>Video clip attached</Text>
                            )}
                            {m.caption ? <Text style={styles.captionText}>{m.caption}</Text> : null}
                          </View>
                        );
                      })}
                    </View>
                  ))
                )}
              </View>
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f4f5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e4e4e7' },
  headerTitle: { fontSize: 16, fontWeight: '900', color: '#09090b' },
  closeBtn: { padding: 6, borderRadius: 999, backgroundColor: '#f4f4f5' },
  content: { padding: 12, gap: 10, paddingBottom: 40 },
  gpsBadge: { fontSize: 11.5, fontWeight: '700', color: '#4338ca', backgroundColor: '#eef2ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  searchRow: { flexDirection: 'row', gap: 8 },
  searchBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  input: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 12.5, color: '#09090b' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#fff', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: '#e4e4e7' },
  thumb: { width: 52, height: 52, borderRadius: 10, backgroundColor: '#e4e4e7' },
  tierPill: { fontSize: 10, fontWeight: '800', color: '#52525b', backgroundColor: '#f4f4f5', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  tierProx: { color: '#065f46', backgroundColor: '#d1fae5' },
  pickTitle: { fontSize: 13, fontWeight: '800', color: '#09090b' },
  pickAddr: { fontSize: 11.5, color: '#71717a' },
  pickPrice: { fontSize: 12, fontWeight: '800', color: '#059669' },
  selectedCard: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#eef2ff', padding: 12, borderRadius: 14, borderWidth: 1, borderColor: '#c7d2fe' },
  changeBtn: { backgroundColor: '#fff', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#c7d2fe' },
  changeText: { fontSize: 11, fontWeight: '800', color: '#4f46e5' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e4e4e7', gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', color: '#3f3f46' },
  row: { flexDirection: 'row', gap: 8 },
  mediaBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 12, paddingVertical: 9 },
  mediaBtnText: { fontSize: 11.5, fontWeight: '800', color: '#312e81' },
  pendingItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  pendingImg: { width: 52, height: 52, borderRadius: 10 },
  postBtn: { backgroundColor: '#09090b', borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  postBtnText: { color: '#fff', fontSize: 12.5, fontWeight: '800' },
  empty: { fontSize: 12, color: '#71717a' },
  commentCard: { backgroundColor: '#fafafa', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e4e4e7', gap: 4 },
  commentAuthor: { fontSize: 11.5, fontWeight: '800', color: '#4f46e5' },
  unitTag: { fontSize: 10.5, fontWeight: '800', color: '#09090b', backgroundColor: '#e4e4e7', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 999 },
  commentBody: { fontSize: 12.5, color: '#18181b', lineHeight: 18 },
  commentImg: { width: '100%', height: 180, borderRadius: 10, backgroundColor: '#e4e4e7' },
  videoBadge: { fontSize: 11.5, fontWeight: '700', color: '#4338ca' },
  captionText: { fontSize: 11.5, fontStyle: 'italic', color: '#52525b' },
  tagWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 999, backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7' },
  tagChipActive: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
  tagChipText: { fontSize: 11.5, fontWeight: '700', color: '#52525b' },
  tagChipTextActive: { color: '#4338ca' },
  savedTagPill: { fontSize: 10.5, fontWeight: '800', color: '#312e81', backgroundColor: '#e0e7ff', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
});
