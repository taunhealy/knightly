import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import type { AuthUserState } from './store';

WebBrowser.maybeCompleteAuthSession();

export function isGoogleAuthConfigured(): boolean {
  return Boolean(
    process.env.EXPO_PUBLIC_FIREBASE_API_KEY && process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID
  );
}

/**
 * Signs into Firebase Auth (free Spark tier) using Google OAuth via Expo WebBrowser +
 * Firebase Identity Toolkit REST API (`accounts:signInWithIdp`), compatible with Expo Go.
 */
export async function signInWithGoogleFirebase(): Promise<AuthUserState> {
  const firebaseApiKey = (process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '').trim();
  const googleClientId = (process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '').trim();
  if (!firebaseApiKey || !googleClientId) {
    throw new Error(
      'Set EXPO_PUBLIC_FIREBASE_API_KEY and EXPO_PUBLIC_GOOGLE_CLIENT_ID in mobile/.env to enable Google Sign-In.'
    );
  }

  const redirectUri = Linking.createURL('auth');
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${encodeURIComponent(googleClientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=id_token` +
    `&scope=${encodeURIComponent('openid email profile')}` +
    `&nonce=${encodeURIComponent(nonce)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
  if (result.type !== 'success' || !result.url) {
    throw new Error('Google sign-in was cancelled.');
  }

  const hashPart = result.url.split('#')[1] || '';
  const params = new URLSearchParams(hashPart);
  const googleIdToken = params.get('id_token');
  if (!googleIdToken) {
    throw new Error('No Google ID token returned.');
  }

  const fbRes = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithIdp?key=${encodeURIComponent(firebaseApiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        postBody: `id_token=${encodeURIComponent(googleIdToken)}&providerId=google.com`,
        requestUri: redirectUri,
        returnIdpCredential: true,
        returnSecureToken: true,
      }),
    }
  );
  if (!fbRes.ok) {
    const errText = await fbRes.text();
    throw new Error(`Firebase Auth error: ${errText}`);
  }
  const fbData = await fbRes.json();
  return {
    uid: fbData.localId,
    email: fbData.email,
    displayName: fbData.displayName || fbData.fullName || 'Knightly User',
    idToken: fbData.idToken,
  };
}
