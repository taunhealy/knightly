const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export async function pullWorkspaceFromServer(idToken?: string | null, uid = 'local-dev-user') {
  try {
    const headers: Record<string, string> = { 'X-User-Id': uid };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    const res = await fetch(`${API_BASE}/api/workspace`, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    if (typeof window === 'undefined' || !data) return data;

    if (Array.isArray(data.favourites) && data.favourites.length > 0) {
      localStorage.setItem('homeseek_imported_favourites', JSON.stringify(data.favourites));
    }
    if (Array.isArray(data.compare_list) && data.compare_list.length > 0) {
      localStorage.setItem('homeseek_compare_list', JSON.stringify(data.compare_list));
    }
    if (Array.isArray(data.hidden_ids) && data.hidden_ids.length > 0) {
      localStorage.setItem('homeseek_hidden_ids', JSON.stringify(data.hidden_ids));
    }
    if (typeof data.preferences === 'string' && data.preferences.trim()) {
      localStorage.setItem('homeseek_personal_preferences', data.preferences);
    }
    window.dispatchEvent(new Event('homeseek-compare-updated'));
    return data;
  } catch {
    return null;
  }
}

export async function pushWorkspaceToServer(idToken?: string | null, uid = 'local-dev-user') {
  if (typeof window === 'undefined') return;
  try {
    const favourites = JSON.parse(localStorage.getItem('homeseek_imported_favourites') || '[]');
    const compare_list = JSON.parse(localStorage.getItem('homeseek_compare_list') || '[]');
    const hidden_ids = JSON.parse(localStorage.getItem('homeseek_hidden_ids') || '[]');
    const preferences = localStorage.getItem('homeseek_personal_preferences') || '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-User-Id': uid,
    };
    if (idToken) headers.Authorization = `Bearer ${idToken}`;
    await fetch(`${API_BASE}/api/workspace`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ favourites, compare_list, hidden_ids, preferences }),
    });
  } catch {
    // Non-blocking background sync
  }
}

export async function fetchPublicSnags(params: { propertyId?: string; address?: string; suburb?: string }) {
  try {
    const qs = new URLSearchParams();
    if (params.propertyId) qs.set('property_id', params.propertyId);
    if (params.address) qs.set('address', params.address);
    if (params.suburb) qs.set('suburb', params.suburb);
    const res = await fetch(`${API_BASE}/api/inspections/public-snags?${qs.toString()}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data?.reports || [];
  } catch {
    return [];
  }
}
