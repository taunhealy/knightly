import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { deleteUserAlert, fetchUserAlerts, saveUserAlert } from '@/lib/api';
import { useHomeSeek } from '@/lib/store';
import { CAPE_TOWN_SUBURBS } from '@/constants/capeTown';

export default function AlertsScreen() {
  const router = useRouter();
  const { apiBaseUrl, setSearchPrefill } = useHomeSeek();
  const [alerts, setAlerts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [readIds, setReadIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const [newArea, setNewArea] = useState('Hout Bay, Llandudno');
  const [areaQuery, setAreaQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('18000');
  const [minFit, setMinFit] = useState(80);
  const [dealbreakers, setDealbreakers] = useState('WFH / Quiet calls · Natural light');

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserAlerts(apiBaseUrl, 'taun_test_user');
      const list = Array.isArray(data?.searches) ? data.searches : Array.isArray(data) ? data : [];
      setAlerts(list);
    } catch {
      setAlerts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, [apiBaseUrl]);

  const unreadCount = alerts.filter((a) => !readIds.includes(String(a.id || a.search_id))).length;

  const markAllRead = () => {
    setReadIds(alerts.map((a) => String(a.id || a.search_id)));
  };

  const handleCreate = async () => {
    try {
      await saveUserAlert(apiBaseUrl, {
        user_id: 'taun_test_user',
        target_area: newArea,
        search_query: `AI Radar: ${newArea} (max R${maxPrice})`,
        max_price: parseInt(maxPrice, 10) || 18000,
        min_fit_score: minFit,
        personal_tastes: dealbreakers,
        trigger_initial_scan: false,
      });
      setCreateOpen(false);
      loadAlerts();
    } catch {
      // Ignore
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Top Action Bar */}
      <View style={styles.topRow}>
        <View>
          <Text style={styles.title}>Active Radar Alerts</Text>
          <Text style={styles.sub}>{unreadCount} unread · AI-filtered</Text>
        </View>
        <View style={styles.actions}>
          <Pressable style={styles.markBtn} onPress={markAllRead}>
            <Text style={styles.markBtnText}>Mark read</Text>
          </Pressable>
          <Pressable style={styles.newBtn} onPress={() => setCreateOpen(true)}>
            <Ionicons name="add" size={15} color="#fff" />
            <Text style={styles.newBtnText}>New Alert</Text>
          </Pressable>
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} color="#4f46e5" />
      ) : alerts.length === 0 ? (
        <View style={styles.emptyBox}>
          <Ionicons name="notifications-off-outline" size={30} color="#a1a1aa" />
          <Text style={styles.title}>No Alerts Yet</Text>
          <Text style={styles.sub}>Tap &ldquo;+ New Alert&rdquo; above or &ldquo;Save Alert&rdquo; in Search.</Text>
        </View>
      ) : (
        alerts.map((alert, idx) => {
          const id = String(alert.id || alert.search_id || idx);
          const area = alert.target_area || 'Cape Town';
          const isUnread = !readIds.includes(id);
          return (
            <View key={id} style={[styles.alertCard, isUnread && { borderColor: '#818cf8' }]}>
              <View style={styles.rowBetween}>
                <Text style={styles.areaBadge}>{area}</Text>
                <Text style={styles.fitBadge}>≥ {alert.min_fit_score ?? 80}% AI Fit</Text>
              </View>
              <Text style={styles.alertTitle}>{alert.search_query || `Monitor for ${area}`}</Text>
              {alert.personal_tastes ? (
                <Text style={styles.tastes}>{alert.personal_tastes}</Text>
              ) : null}
              <View style={styles.cardFooter}>
                <Pressable
                  style={styles.viewBtn}
                  onPress={() => {
                    setSearchPrefill({
                      suburbs: area.split(',').map((s: string) => s.trim()).filter(Boolean),
                      maxPrice: alert.max_price,
                    });
                    router.push('/(tabs)');
                  }}
                >
                  <Text style={styles.viewBtnText}>View in Search →</Text>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    await deleteUserAlert(apiBaseUrl, 'taun_test_user', id);
                    setAlerts((prev) => prev.filter((a) => String(a.id || a.search_id) !== id));
                  }}
                >
                  <Ionicons name="trash-outline" size={18} color="#e11d48" />
                </Pressable>
              </View>
            </View>
          );
        })
      )}

      {/* New Alert Modal with Suburb Auto-Suggest */}
      <Modal visible={createOpen} animationType="slide" transparent onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.title}>New Radar Alert</Text>
              <Pressable onPress={() => setCreateOpen(false)}>
                <Ionicons name="close" size={22} color="#09090b" />
              </Pressable>
            </View>
            <TextInput
              value={newArea}
              onChangeText={setNewArea}
              placeholder="Target areas (e.g. Hout Bay, Gardens)"
              style={styles.input}
            />
            <TextInput
              value={areaQuery}
              onChangeText={setAreaQuery}
              placeholder="Search suburb to add..."
              style={styles.input}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
              {CAPE_TOWN_SUBURBS.filter((s) => !areaQuery.trim() || s.toLowerCase().includes(areaQuery.toLowerCase()))
                .slice(0, 8)
                .map((sub) => (
                  <Pressable
                    key={sub}
                    style={styles.subChip}
                    onPress={() => {
                      const list = newArea.split(',').map((x) => x.trim()).filter(Boolean);
                      if (!list.includes(sub)) setNewArea([...list, sub].join(', '));
                      setAreaQuery('');
                    }}
                  >
                    <Text style={styles.subChipText}>+ {sub}</Text>
                  </Pressable>
                ))}
            </ScrollView>
            <TextInput
              value={maxPrice}
              onChangeText={setMaxPrice}
              keyboardType="numeric"
              placeholder="Max Price (R)"
              style={styles.input}
            />
            <View style={styles.fitRow}>
              {[70, 80, 90].map((v) => (
                <Pressable
                  key={v}
                  onPress={() => setMinFit(v)}
                  style={[styles.fitOpt, minFit === v && { backgroundColor: '#4f46e5', borderColor: '#4f46e5' }]}
                >
                  <Text style={[styles.markBtnText, minFit === v && { color: '#fff' }]}>{v}%+ Fit</Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              value={dealbreakers}
              onChangeText={setDealbreakers}
              placeholder="AI Dealbreakers & Lifestyle Fit"
              style={styles.input}
            />
            <Pressable style={styles.saveBtn} onPress={handleCreate}>
              <Text style={styles.newBtnText}>Create Radar Alert</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f4f5' },
  content: { padding: 12, gap: 10, paddingBottom: 30 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 16, fontWeight: '900', color: '#09090b' },
  sub: { fontSize: 12, color: '#71717a' },
  actions: { flexDirection: 'row', gap: 6 },
  markBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d4d4d8', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  markBtnText: { fontSize: 11.5, fontWeight: '800', color: '#18181b' },
  newBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#09090b', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  newBtnText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  emptyBox: { backgroundColor: '#fff', borderRadius: 16, padding: 28, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#e4e4e7' },
  alertCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1.5, borderColor: '#e4e4e7', gap: 6 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  areaBadge: { fontSize: 11, fontWeight: '800', backgroundColor: '#f4f4f5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, color: '#09090b' },
  fitBadge: { fontSize: 11, fontWeight: '800', backgroundColor: '#eef2ff', color: '#3730a3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  alertTitle: { fontSize: 14, fontWeight: '800', color: '#09090b' },
  tastes: { fontSize: 11.5, color: '#52525b' },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  viewBtn: { backgroundColor: '#eef2ff', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  viewBtnText: { fontSize: 11.5, fontWeight: '800', color: '#4338ca' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(9,9,11,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18, gap: 10 },
  input: { backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13 },
  subChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe' },
  subChipText: { fontSize: 11, fontWeight: '700', color: '#3730a3' },
  fitRow: { flexDirection: 'row', gap: 8 },
  fitOpt: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 10, backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7' },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
