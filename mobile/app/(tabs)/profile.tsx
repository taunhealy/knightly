import React, { useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import * as ExpoLinking from 'expo-linking';
import { KnightBadge } from '@/components/KnightBadge';
import { signInWithGoogleFirebase } from '@/lib/firebaseGoogleAuth';
import { useHomeSeek } from '@/lib/store';

const PRIORITY_CHIPS = [
  'Work from home (part-time)',
  '100% Private (no landlord on-site)',
  'Quiet sanctuary (no traffic)',
  'Fibre ready',
  'Secure off-street parking',
  'Pet-friendly',
];

export default function ProfileScreen() {
  const {
    apiBaseUrl,
    setApiBaseUrl,
    authUser,
    setAuthUser,
    favourites,
    toggleFavourite,
    hiddenIds,
    toggleHide,
    personalPreferences,
    setPersonalPreferences,
  } = useHomeSeek();

  const [urlInput, setUrlInput] = useState(apiBaseUrl);
  const [savedNote, setSavedNote] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [nickname, setNickname] = useState('');
  const [nickStatus, setNickStatus] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(authUser.email || '');
  const [whatsapp, setWhatsapp] = useState('');
  const [contactSaved, setContactSaved] = useState(false);
  const [prefsInput, setPrefsInput] = useState(personalPreferences);
  const [prefsSaved, setPrefsSaved] = useState(false);
  const [aiCredits, setAiCredits] = useState<number | null>(null);

  useEffect(() => {
    const headers: Record<string, string> = { 'X-User-Id': authUser.uid };
    if (authUser.idToken) headers.Authorization = `Bearer ${authUser.idToken}`;
    fetch(`${apiBaseUrl}/api/credits/balance`, { headers })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (typeof d?.ai_credits === 'number') setAiCredits(d.ai_credits);
      })
      .catch(() => {});
  }, [apiBaseUrl, authUser.uid, authUser.idToken]);

  useEffect(() => {
    setPrefsInput(personalPreferences);
  }, [personalPreferences]);

  useEffect(() => {
    if (authUser.email && !notifyEmail) {
      setNotifyEmail(authUser.email);
    }
  }, [authUser.email]);

  useEffect(() => {
    fetch(`${apiBaseUrl}/api/listings/nickname/${encodeURIComponent(authUser.uid)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.nickname) setNickname(d.nickname);
      })
      .catch(() => {});
  }, [apiBaseUrl, authUser.uid]);

  const handleSaveNickname = async () => {
    if (!nickname.trim()) return;
    setNickStatus('Saving...');
    try {
      const res = await fetch(`${apiBaseUrl}/api/user-profile/${encodeURIComponent(authUser.uid)}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.detail || 'Invalid nickname');
      setNickname(data.nickname || nickname.trim());
      setNickStatus('Saved ✓');
      setTimeout(() => setNickStatus(''), 2500);
    } catch (e: any) {
      setNickStatus('');
      Alert.alert('Nickname', e?.message || 'Could not update nickname.');
    }
  };

  const handleSaveContact = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/update-profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: authUser.uid,
          email: notifyEmail.trim(),
          whatsapp: whatsapp.trim(),
        }),
      });
      if (!res.ok) throw new Error('Save failed');
      setContactSaved(true);
      setTimeout(() => setContactSaved(false), 2500);
    } catch {
      Alert.alert('Error', 'Could not save notification settings.');
    }
  };

  const togglePriorityChip = (chip: string) => {
    const parts = prefsInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const exists = parts.some((p) => p.toLowerCase() === chip.toLowerCase());
    const next = exists
      ? parts.filter((p) => p.toLowerCase() !== chip.toLowerCase()).join(', ')
      : [...parts, chip].join(', ');
    setPrefsInput(next);
    setPersonalPreferences(next);
  };

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const signedIn = await signInWithGoogleFirebase();
      setAuthUser(signedIn);
    } catch (err: any) {
      Alert.alert('Google Sign-In', err?.message || 'Could not complete Google Sign-In.');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleBuyCredits = async (packId: string) => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-User-Id': authUser.uid,
      };
      if (authUser.idToken) headers.Authorization = `Bearer ${authUser.idToken}`;
      const returnUrl = ExpoLinking.createURL('auth');
      // Try Paystack (ZAR) first, fallback to PayPal (USD)
      const psRes = await fetch(`${apiBaseUrl}/api/payments/paystack/initialize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pack_id: packId, email: authUser.email || undefined, callback_url: returnUrl }),
      });
      if (psRes.ok) {
        const psData = await psRes.json();
        if (psData?.authorization_url) {
          const authRes = await WebBrowser.openAuthSessionAsync(psData.authorization_url, returnUrl);
          if (authRes.type === 'success') {
            const vRes = await fetch(`${apiBaseUrl}/api/payments/paystack/verify`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ reference: psData.reference, pack_id: packId }),
            });
            const vData = await vRes.json();
            if (vRes.ok && typeof vData?.ai_credits === 'number') {
              setAiCredits(vData.ai_credits);
              Alert.alert('Credits Added', `New balance: ${vData.ai_credits} AI Credits`);
            }
          }
          return;
        }
      }

      const res = await fetch(`${apiBaseUrl}/api/payments/paypal/create-order`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pack_id: packId, return_url: returnUrl, cancel_url: returnUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data?.approve_url) {
        Alert.alert('Checkout', data?.detail || 'Set PAYSTACK_SECRET_KEY or PAYPAL_* in api/.env.');
        return;
      }
      const authRes = await WebBrowser.openAuthSessionAsync(data.approve_url, returnUrl);
      if (authRes.type === 'success') {
        const capRes = await fetch(`${apiBaseUrl}/api/payments/paypal/capture-order`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ order_id: data.order_id, pack_id: packId }),
        });
        const capData = await capRes.json();
        if (capRes.ok && typeof capData?.ai_credits === 'number') {
          setAiCredits(capData.ai_credits);
          Alert.alert('Credits Added', `New balance: ${capData.ai_credits} AI Credits`);
        }
      }
    } catch {
      Alert.alert('PayPal Checkout', 'Could not start PayPal checkout.');
    }
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Account Identity Card */}
      <View style={styles.card}>
        <View style={styles.profileRow}>
          <KnightBadge size={48} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{authUser.displayName || 'CapeTownExplorer'}</Text>
            <Text style={styles.sub}>
              {authUser.email || `Workspace ID: ${authUser.uid} (synced to FastAPI)`}
            </Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 4 }}>
            <View style={styles.planPill}>
              <Text style={styles.planText}>{authUser.idToken ? 'Google Auth' : 'Local Sync'}</Text>
            </View>
            {aiCredits !== null && (
              <View style={[styles.planPill, { backgroundColor: '#ecfdf5' }]}>
                <Text style={[styles.planText, { color: '#047857' }]}>{aiCredits} AI Credits</Text>
              </View>
            )}
          </View>
        </View>
        {authUser.idToken ? (
          <Pressable
            style={[styles.p24Btn, { alignSelf: 'flex-start', paddingHorizontal: 12, paddingVertical: 7 }]}
            onPress={() => setAuthUser({ uid: 'local-dev-user', displayName: 'CapeTownExplorer', idToken: null })}
          >
            <Text style={styles.p24Text}>Sign out</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.saveBtn, { paddingVertical: 10, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }]}
            onPress={handleGoogleSignIn}
            disabled={isSigningIn}
          >
            <Ionicons name="logo-google" size={15} color="#fff" />
            <Text style={styles.saveText}>{isSigningIn ? 'Signing in...' : 'Sign in with Google (Firebase)'}</Text>
          </Pressable>
        )}
      </View>

      {/* Top Up AI Credits (Paystack ZAR / PayPal) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Top Up AI Credits (ZAR / Paystack)</Text>
        <Text style={styles.sub}>Pay only for live AI Vision, Compare, and qualifying Alert matches.</Text>
        <View style={styles.urlRow}>
          {[
            { id: 'starter_25', label: '25 Credits', price: 'R55' },
            { id: 'scout_75', label: '75 Credits', price: 'R135' },
            { id: 'pro_200', label: '200 Credits', price: 'R290' },
          ].map((pk) => (
            <Pressable
              key={pk.id}
              onPress={() => handleBuyCredits(pk.id)}
              style={[styles.chip, { flex: 1, alignItems: 'center' }]}
            >
              <Text style={styles.favTitle}>{pk.label}</Text>
              <Text style={styles.favPrice}>{pk.price}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Community Handle */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Community Handle (Viewing Comments & Photos)</Text>
        <Text style={styles.sub}>Shown publicly as u/{nickname || 'KnightlyScout'} instead of your real name.</Text>
        <View style={styles.urlRow}>
          <TextInput
            value={nickname}
            onChangeText={setNickname}
            autoCapitalize="none"
            placeholder="e.g. CoastalScout24"
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable style={styles.saveBtn} onPress={handleSaveNickname}>
            <Text style={styles.saveText}>{nickStatus || 'Save'}</Text>
          </Pressable>
        </View>
      </View>

      {/* AI Search & Compare Priorities */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>AI Fit & Compare Priorities</Text>
        <Text style={styles.sub}>Used by AI Analysis and Compare to score rentals for your lifestyle.</Text>
        <View style={styles.chipWrap}>
          {PRIORITY_CHIPS.map((chip) => {
            const active = prefsInput.toLowerCase().includes(chip.toLowerCase());
            const handleBuyCredits = async (packId: string) => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-User-Id': authUser.uid,
      };
      if (authUser.idToken) headers.Authorization = `Bearer ${authUser.idToken}`;
      const returnUrl = ExpoLinking.createURL('auth');
      // Try Paystack (ZAR) first, fallback to PayPal (USD)
      const psRes = await fetch(`${apiBaseUrl}/api/payments/paystack/initialize`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pack_id: packId, email: authUser.email || undefined, callback_url: returnUrl }),
      });
      if (psRes.ok) {
        const psData = await psRes.json();
        if (psData?.authorization_url) {
          const authRes = await WebBrowser.openAuthSessionAsync(psData.authorization_url, returnUrl);
          if (authRes.type === 'success') {
            const vRes = await fetch(`${apiBaseUrl}/api/payments/paystack/verify`, {
              method: 'POST',
              headers,
              body: JSON.stringify({ reference: psData.reference, pack_id: packId }),
            });
            const vData = await vRes.json();
            if (vRes.ok && typeof vData?.ai_credits === 'number') {
              setAiCredits(vData.ai_credits);
              Alert.alert('Credits Added', `New balance: ${vData.ai_credits} AI Credits`);
            }
          }
          return;
        }
      }

      const res = await fetch(`${apiBaseUrl}/api/payments/paypal/create-order`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ pack_id: packId, return_url: returnUrl, cancel_url: returnUrl }),
      });
      const data = await res.json();
      if (!res.ok || !data?.approve_url) {
        Alert.alert('Checkout', data?.detail || 'Set PAYSTACK_SECRET_KEY or PAYPAL_* in api/.env.');
        return;
      }
      const authRes = await WebBrowser.openAuthSessionAsync(data.approve_url, returnUrl);
      if (authRes.type === 'success') {
        const capRes = await fetch(`${apiBaseUrl}/api/payments/paypal/capture-order`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ order_id: data.order_id, pack_id: packId }),
        });
        const capData = await capRes.json();
        if (capRes.ok && typeof capData?.ai_credits === 'number') {
          setAiCredits(capData.ai_credits);
          Alert.alert('Credits Added', `New balance: ${capData.ai_credits} AI Credits`);
        }
      }
    } catch {
      Alert.alert('PayPal Checkout', 'Could not start PayPal checkout.');
    }
  };

  return (
              <Pressable
                key={chip}
                onPress={() => togglePriorityChip(chip)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{chip}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={prefsInput}
          onChangeText={setPrefsInput}
          multiline
          placeholder="Custom priorities (e.g. north-facing, gas hob, quiet street)..."
          style={[styles.input, { minHeight: 56 }]}
        />
        <Pressable
          style={[styles.saveBtn, { paddingVertical: 10, alignItems: 'center' }]}
          onPress={() => {
            setPersonalPreferences(prefsInput.trim());
            setPrefsSaved(true);
            setTimeout(() => setPrefsSaved(false), 2500);
          }}
        >
          <Text style={styles.saveText}>{prefsSaved ? 'Priorities Synced ✓' : 'Save AI Priorities'}</Text>
        </Pressable>
      </View>

      {/* Radar Alert Notifications */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Alert Notifications (Email & WhatsApp)</Text>
        <TextInput
          value={notifyEmail}
          onChangeText={setNotifyEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="Notification email"
          style={styles.input}
        />
        <TextInput
          value={whatsapp}
          onChangeText={setWhatsapp}
          keyboardType="phone-pad"
          placeholder="WhatsApp number (e.g. +27821234567)"
          style={styles.input}
        />
        <Pressable style={[styles.saveBtn, { paddingVertical: 10, alignItems: 'center' }]} onPress={handleSaveContact}>
          <Text style={styles.saveText}>{contactSaved ? 'Notification Settings Saved ✓' : 'Save Notification Settings'}</Text>
        </Pressable>
      </View>

      {/* Saved Favourites */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Saved Favourites ({favourites.length})</Text>
          <Ionicons name="heart" size={16} color="#e11d48" />
        </View>
        {favourites.length === 0 ? (
          <Text style={styles.sub}>
            Star any property in Search to keep your shortlist right here.
          </Text>
        ) : (
          favourites.map((fav) => (
            <View key={fav.id} style={styles.favRow}>
              <Image
                source={{ uri: fav.image || 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=300' }}
                style={styles.favThumb}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.favTitle} numberOfLines={1}>{fav.title || `Listing ${fav.id}`}</Text>
                <Text style={styles.sub} numberOfLines={1}>{fav.address || fav.suburb || 'Cape Town'}</Text>
                <Text style={styles.favPrice}>R {Number(fav.price || 0).toLocaleString()}/mo</Text>
              </View>
              {fav.url ? (
                <Pressable style={styles.p24Btn} onPress={() => Linking.openURL(fav.url!)}>
                  <Text style={styles.p24Text}>P24</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={() => toggleFavourite(fav)}>
                <Ionicons name="trash-outline" size={18} color="#e11d48" />
              </Pressable>
            </View>
          ))
        )}
      </View>

      {/* Hidden Listings Management */}
      {hiddenIds.length > 0 && (
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.sectionTitle}>Hidden Listings ({hiddenIds.length})</Text>
              <Text style={styles.sub}>Properties hidden from your Search feed.</Text>
            </View>
            <Pressable
              style={styles.p24Btn}
              onPress={() => hiddenIds.forEach((id) => toggleHide(id))}
            >
              <Text style={styles.p24Text}>Restore All</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* Backend Server Connection (for physical phone via Expo Go) */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Backend API Server URL</Text>
        <Text style={styles.sub}>
          Use http://10.0.2.2:8000 on Android Emulator, http://127.0.0.1:8000 on iOS Simulator/Web, or your PC&apos;s LAN IP (e.g. http://192.168.1.50:8000) on a physical phone.
        </Text>
        <View style={styles.urlRow}>
          <TextInput
            value={urlInput}
            onChangeText={setUrlInput}
            autoCapitalize="none"
            style={[styles.input, { flex: 1 }]}
          />
          <Pressable
            style={styles.saveBtn}
            onPress={() => {
              setApiBaseUrl(urlInput.trim().replace(/\/$/, ''));
              setSavedNote(true);
              setTimeout(() => setSavedNote(false), 2500);
            }}
          >
            <Text style={styles.saveText}>{savedNote ? 'Saved ✓' : 'Save'}</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f4f4f5' },
  content: { padding: 12, gap: 12, paddingBottom: 30 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#e4e4e7', gap: 10 },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontSize: 16, fontWeight: '900', color: '#09090b' },
  sub: { fontSize: 12, color: '#71717a' },
  planPill: { backgroundColor: '#eef2ff', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  planText: { fontSize: 11, fontWeight: '800', color: '#4338ca' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 11, fontWeight: '900', textTransform: 'uppercase', color: '#3f3f46' },
  favRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 12, backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7' },
  favThumb: { width: 52, height: 52, borderRadius: 10 },
  favTitle: { fontSize: 13, fontWeight: '800', color: '#09090b' },
  favPrice: { fontSize: 11.5, fontWeight: '800', color: '#059669' },
  p24Btn: { backgroundColor: '#09090b', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 8 },
  p24Text: { color: '#fff', fontSize: 10.5, fontWeight: '800' },
  urlRow: { flexDirection: 'row', gap: 8 },
  input: { backgroundColor: '#fafafa', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, fontSize: 12.5 },
  saveBtn: { backgroundColor: '#4f46e5', borderRadius: 12, paddingHorizontal: 14, justifyContent: 'center' },
  saveText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: '#f4f4f5', borderWidth: 1, borderColor: '#e4e4e7' },
  chipActive: { backgroundColor: '#eef2ff', borderColor: '#6366f1' },
  chipText: { fontSize: 11.5, fontWeight: '700', color: '#52525b' },
  chipTextActive: { color: '#4338ca' },
});
