import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { askListingChat, fetchLiveListings, runCompareAi, type MobileProperty } from '@/lib/api';
import { useHomeSeek } from '@/lib/store';
import { CAPE_TOWN_SUBURBS, KEY_DECISION_FACTORS } from '@/constants/capeTown';

export default function CompareScreen() {
  const {
    apiBaseUrl,
    compareList,
    removeCompare,
    replaceCompare,
    clearCompare,
    personalPreferences,
    setPersonalPreferences,
  } = useHomeSeek();

  const [isComparing, setIsComparing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ role: 'user' | 'assistant'; text: string }>>([]);
  const [chatInput, setChatInput] = useState('');
  const [isSendingChat, setIsSendingChat] = useState(false);

  const sendCompareChat = async () => {
    const q = chatInput.trim();
    if (!q || compareList.length === 0) return;
    setChatMessages((prev) => [...prev, { role: 'user', text: q }]);
    setChatInput('');
    setIsSendingChat(true);
    try {
      const compareCtx = {
        ...compareList[0],
        title: `Comparison of ${compareList.map((p) => p.title).join(' vs ')}`,
        description: JSON.stringify({
          compared_properties: compareList.map((p) => ({
            title: p.title,
            address: p.address,
            price: p.price,
            bedrooms: p.bedrooms,
            bathrooms: p.bathrooms,
          })),
          ai_report: result || null,
        }).slice(0, 3500),
      };
      const res = await askListingChat(
        apiBaseUrl,
        compareCtx,
        q,
        chatMessages.map((m) => ({ role: m.role, content: m.text })),
        personalPreferences
      );
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: res?.answer || 'No response received.' },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: 'assistant', text: 'Could not reach AI advisor right now.' },
      ]);
    } finally {
      setIsSendingChat(false);
    }
  };

  // Swap / Add by Area Modal
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [areaQuery, setAreaQuery] = useState('Hout Bay');
  const [areaResults, setAreaResults] = useState<MobileProperty[]>([]);
  const [isLoadingArea, setIsLoadingArea] = useState(false);

  const toggleFactor = (label: string) => {
    const exists = personalPreferences.toLowerCase().includes(label.toLowerCase());
    if (exists) {
      setPersonalPreferences(
        personalPreferences.replace(new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), '').replace(/,\s*,/g, ',').trim()
      );
    } else {
      setPersonalPreferences(personalPreferences ? `${personalPreferences}, ${label}` : label);
    }
  };

  const searchArea = async (area: string) => {
    setIsLoadingArea(true);
    try {
      const res = await fetchLiveListings(apiBaseUrl, {
        suburbs: [area.trim()],
        min_price: 0,
        max_price: 999999,
        bedrooms: 'any',
        force_fresh: false,
      });
      setAreaResults(Array.isArray(res?.listings) ? res.listings : []);
    } catch {
      setAreaResults([]);
    } finally {
      setIsLoadingArea(false);
    }
  };

  const openSwap = (prop: MobileProperty | null) => {
    const initialArea = prop?.suburb || 'Hout Bay';
    setSwapTargetId(prop ? prop.id : '__add__');
    setAreaQuery(initialArea);
    searchArea(initialArea);
  };

  const handleRunCompare = async () => {
    if (compareList.length < 2 || isComparing) return;
    setIsComparing(true);
    try {
      const res = await runCompareAi(apiBaseUrl, compareList, personalPreferences);
      setResult(res?.comparison || null);
    } finally {
      setIsComparing(false);
    }
  };

  const getRank = (id: string) =>
    (result?.rankings || []).find((r: any) => String(r.id) === String(id));

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Criteria Card */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Key Rental Decision Factors</Text>
        <View style={styles.chipGrid}>
          {KEY_DECISION_FACTORS.map((f) => {
            const active = personalPreferences.toLowerCase().includes(f.label.toLowerCase());
            return (
              <Pressable
                key={f.label}
                onPress={() => toggleFactor(f.label)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && { color: '#fff' }]}>
                  {active ? '✓ ' : ''}{f.shortLabel}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={personalPreferences}
          onChangeText={setPersonalPreferences}
          multiline
          placeholder="Describe your WFH setup, quiet needs, parking..."
          style={styles.textArea}
        />

        <View style={styles.btnRow}>
          <Pressable
            style={[styles.primaryBtn, (compareList.length < 2 || isComparing) && { opacity: 0.5 }]}
            onPress={handleRunCompare}
            disabled={compareList.length < 2 || isComparing}
          >
            {isComparing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="sparkles" size={14} color="#fde047" />
            )}
            <Text style={styles.primaryBtnText}>
              {isComparing ? 'Comparing...' : `Run AI Comparison (${compareList.length})`}
            </Text>
          </Pressable>
          {compareList.length < 4 && (
            <Pressable style={styles.secondaryBtn} onPress={() => openSwap(null)}>
              <Ionicons name="add" size={15} color="#18181b" />
              <Text style={styles.secondaryBtnText}>Add by Area</Text>
            </Pressable>
          )}
          {compareList.length > 0 && (
            <Pressable
              style={styles.clearBtn}
              onPress={() => {
                clearCompare();
                setResult(null);
              }}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* Executive Verdict */}
      {result?.executive_verdict && (
        <View style={styles.verdictCard}>
          <Text style={styles.verdictEyebrow}>AI Side-by-Side Winner Verdict</Text>
          <Text style={styles.verdictText}>{result.executive_verdict}</Text>
        </View>
      )}

      {/* Shortlist Cards */}
      {compareList.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="git-compare-outline" size={34} color="#a1a1aa" />
          <Text style={styles.emptyTitle}>No Properties in Compare</Text>
          <Text style={styles.emptySub}>
            Tap &ldquo;+ Compare&rdquo; in Search or tap &ldquo;Add by Area&rdquo; above to compare up to 4 listings.
          </Text>
        </View>
      ) : (
        compareList.map((prop) => {
          const r = getRank(prop.id);
          const isWinner = result?.winner_id && String(result.winner_id) === String(prop.id);
          return (
            <View key={prop.id} style={[styles.propCard, isWinner && styles.winnerBorder]}>
              <View style={styles.propHeader}>
                <Image
                  source={{ uri: prop.image || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400' }}
                  style={styles.thumb}
                />
                <View style={{ flex: 1 }}>
                  {r ? (
                    <Text style={styles.rankTag}>
                      #{r.rank} · {r.score}/100 {isWinner ? '· WINNER' : ''}
                    </Text>
                  ) : null}
                  <Text style={styles.propTitle} numberOfLines={1}>{prop.title}</Text>
                  <Text style={styles.propSub} numberOfLines={1}>{prop.address}</Text>
                  <Text style={styles.propPrice}>R {Number(prop.price || 0).toLocaleString()}/mo · {prop.bedrooms}bd</Text>
                </View>
                <View style={styles.propActions}>
                  <Pressable style={styles.smallBtn} onPress={() => openSwap(prop)}>
                    <Text style={styles.smallBtnText}>Edit</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.smallBtn, { backgroundColor: '#ffe4e6' }]}
                    onPress={() => removeCompare(prop.id)}
                  >
                    <Text style={[styles.smallBtnText, { color: '#be123c' }]}>×</Text>
                  </Pressable>
                </View>
              </View>

              {r && (
                <View style={styles.insightsWrap}>
                  {r.photo_story ? (
                    <View style={styles.insightBox}>
                      <Text style={styles.insightHead}>Photo & Spatial Read</Text>
                      <Text style={styles.insightBody}>{r.photo_story}</Text>
                    </View>
                  ) : null}
                  <View style={styles.insightBox}>
                    <Text style={styles.insightHead}>WFH & Desk Ergonomics</Text>
                    <Text style={styles.insightBody}>{r.wfh_fit}</Text>
                  </View>
                  <View style={styles.insightBox}>
                    <Text style={styles.insightHead}>Walls, Floor Echo & Acoustics</Text>
                    <Text style={styles.insightBody}>{r.wall_acoustic_audit || r.acoustic_verdict}</Text>
                  </View>
                  {r.window_light_audit ? (
                    <View style={styles.insightBox}>
                      <Text style={styles.insightHead}>Windows & Sun Glare</Text>
                      <Text style={styles.insightBody}>{r.window_light_audit}</Text>
                    </View>
                  ) : null}
                  {Array.isArray(r.gotchas) && r.gotchas.length > 0 && (
                    <View style={[styles.insightBox, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}>
                      <Text style={[styles.insightHead, { color: '#92400e' }]}>Gotchas & Viewing Checks</Text>
                      {r.gotchas.map((g: string, i: number) => (
                        <Text key={i} style={[styles.insightBody, { color: '#78350f' }]}>• {g}</Text>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })
      )}

      {/* AI Follow-up Chat Window below the Compare Report */}
      {compareList.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ask AI Advisor About This Comparison</Text>
          {chatMessages.map((m, i) => (
            <View
              key={i}
              style={[styles.chatBubble, m.role === 'user' ? styles.chatUser : styles.chatBot]}
            >
              <Text style={m.role === 'user' ? styles.chatUserText : styles.aiText}>{m.text}</Text>
            </View>
          ))}
          <View style={styles.searchRow}>
            <TextInput
              value={chatInput}
              onChangeText={setChatInput}
              onSubmitEditing={sendCompareChat}
              placeholder="Ask about noise, value, landlord, or commute..."
              style={[styles.input, { flex: 1 }]}
            />
            <Pressable style={styles.searchGoBtn} onPress={sendCompareChat} disabled={isSendingChat}>
              {isSendingChat ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Ionicons name="send" size={16} color="#fff" />
              )}
            </Pressable>
          </View>
        </View>
      )}

      {/* Swap / Add by Area Modal */}
      <Modal visible={Boolean(swapTargetId)} animationType="slide" transparent onRequestClose={() => setSwapTargetId(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Listing by Area</Text>
              <Pressable onPress={() => setSwapTargetId(null)}>
                <Ionicons name="close" size={22} color="#09090b" />
              </Pressable>
            </View>
            <View style={styles.searchRow}>
              <TextInput
                value={areaQuery}
                onChangeText={setAreaQuery}
                placeholder="Suburb (e.g. Hout Bay, Gardens)..."
                style={[styles.input, { flex: 1 }]}
              />
              <Pressable style={styles.searchGoBtn} onPress={() => searchArea(areaQuery)}>
                <Text style={styles.primaryBtnText}>Search</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingBottom: 6 }}>
              {CAPE_TOWN_SUBURBS.filter((s) => !areaQuery.trim() || s.toLowerCase().includes(areaQuery.toLowerCase()))
                .slice(0, 8)
                .map((sub) => (
                  <Pressable
                    key={sub}
                    style={styles.subChip}
                    onPress={() => {
                      setAreaQuery(sub);
                      searchArea(sub);
                    }}
                  >
                    <Text style={styles.subChipText}>{sub}</Text>
                  </Pressable>
                ))}
            </ScrollView>
            <ScrollView style={{ maxHeight: 320 }}>
              {isLoadingArea ? (
                <ActivityIndicator style={{ marginVertical: 20 }} color="#4f46e5" />
              ) : areaResults.length === 0 ? (
                <Text style={styles.emptySub}>No cached listings found for &ldquo;{areaQuery}&rdquo;.</Text>
              ) : (
                areaResults.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.resultRow}
                    onPress={() => {
                      if (swapTargetId && swapTargetId !== '__add__') {
                        replaceCompare(swapTargetId, item);
                      } else {
                        replaceCompare(item.id, item);
                      }
                      setResult(null);
                      setSwapTargetId(null);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.propTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.propSub} numberOfLines={1}>{item.address}</Text>
                      <Text style={styles.propPrice}>R {Number(item.price || 0).toLocaleString()}/mo</Text>
                    </View>
                    <Text style={styles.selectPill}>Select</Text>
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f4f5' },
  content: { padding: 12, gap: 12, paddingBottom: 28 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e4e4e7', gap: 10 },
  sectionTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', color: '#3f3f46' },
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7' },
  chipActive: { backgroundColor: '#6d28d9', borderColor: '#6d28d9' },
  chipText: { fontSize: 11, fontWeight: '700', color: '#27272a' },
  textArea: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, padding: 10, fontSize: 12, minHeight: 54, color: '#09090b' },
  btnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6d28d9', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  primaryBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#d4d4d8', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  secondaryBtnText: { color: '#18181b', fontSize: 12, fontWeight: '800' },
  clearBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#ffe4e6' },
  clearBtnText: { color: '#be123c', fontSize: 12, fontWeight: '800' },
  verdictCard: { backgroundColor: '#312e81', borderRadius: 16, padding: 14, gap: 4 },
  verdictEyebrow: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: '#fcd34d' },
  verdictText: { color: '#fff', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  emptyBox: { backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#e4e4e7' },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: '#09090b' },
  emptySub: { fontSize: 12, color: '#71717a', textAlign: 'center' },
  propCard: { backgroundColor: '#fff', borderRadius: 16, padding: 12, borderWidth: 1.5, borderColor: '#e4e4e7', gap: 10 },
  winnerBorder: { borderColor: '#f59e0b' },
  propHeader: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  thumb: { width: 64, height: 64, borderRadius: 12, backgroundColor: '#e4e4e7' },
  rankTag: { fontSize: 10, fontWeight: '900', color: '#6d28d9' },
  propTitle: { fontSize: 13.5, fontWeight: '800', color: '#09090b' },
  propSub: { fontSize: 11.5, color: '#71717a' },
  propPrice: { fontSize: 12, fontWeight: '800', color: '#059669', marginTop: 2 },
  propActions: { flexDirection: 'row', gap: 4 },
  smallBtn: { backgroundColor: '#f4f4f5', paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8 },
  smallBtnText: { fontSize: 11, fontWeight: '800', color: '#18181b' },
  insightsWrap: { gap: 8 },
  insightBox: { backgroundColor: '#f8fafc', borderRadius: 12, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 3 },
  insightHead: { fontSize: 10, fontWeight: '900', textTransform: 'uppercase', color: '#334155' },
  insightBody: { fontSize: 12, lineHeight: 17, color: '#1e293b' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,9,11,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#09090b' },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 13 },
  searchGoBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  subChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  subChipText: { fontSize: 11, fontWeight: '700', color: '#3730a3' },
  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#e4e4e7', marginBottom: 8 },
  selectPill: { backgroundColor: '#09090b', color: '#fff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, fontSize: 11, fontWeight: '800', overflow: 'hidden' },
  chatBubble: { padding: 10, borderRadius: 12 },
  chatUser: { backgroundColor: '#4f46e5', alignSelf: 'flex-end' },
  chatBot: { backgroundColor: '#f8fafc', borderWidth: 1, borderColor: '#e2e8f0' },
  chatUserText: { color: '#fff', fontSize: 12.5, fontWeight: '600' },
  aiText: { color: '#18181b', fontSize: 12.5, lineHeight: 18 },
});
