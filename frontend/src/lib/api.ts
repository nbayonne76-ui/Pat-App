const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001/api';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('happi_token');
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const resp = await fetch(`${API_URL}${path}`, { ...options, headers });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ detail: resp.statusText }));
    throw new Error(err.detail || 'Erreur API');
  }
  return resp.json();
}

export const api = {
  getMe: () => request<User>('/auth/me'),

  getLocations: () => request<Location[]>('/locations'),
  syncLocations: () => request<Location[]>('/locations/sync', { method: 'POST' }),

  getReviews: (locationId: number, params: ReviewsParams) => {
    const qs = new URLSearchParams();
    if (params.start_date) qs.set('start_date', params.start_date);
    if (params.end_date) qs.set('end_date', params.end_date);
    if (params.star) qs.set('star', String(params.star));
    if (params.has_reply !== undefined) qs.set('has_reply', String(params.has_reply));
    return request<ReviewsResponse>(`/reviews/${locationId}?${qs}`);
  },

  syncReviews: (locationId: number, params: { start_date?: string; end_date?: string }) => {
    const qs = new URLSearchParams();
    if (params.start_date) qs.set('start_date', params.start_date);
    if (params.end_date) qs.set('end_date', params.end_date);
    return request<SyncResponse>(`/reviews/${locationId}/sync?${qs}`, { method: 'POST' });
  },

  postReply: (locationId: number, reviewId: number, reply_text: string) =>
    request(`/reviews/${locationId}/reviews/${reviewId}/reply`, {
      method: 'POST',
      body: JSON.stringify({ reply_text }),
    }),

  deleteReply: (locationId: number, reviewId: number) =>
    request(`/reviews/${locationId}/reviews/${reviewId}/reply`, { method: 'DELETE' }),

  importCsv: async (locationId: number, file: File): Promise<{ imported: number; skipped: number }> => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const resp = await fetch(`${API_URL}/reviews/${locationId}/import`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: form,
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ detail: resp.statusText }));
      throw new Error(err.detail || 'Erreur import');
    }
    return resp.json();
  },

  exportCsv: (locationId: number, params: { start_date?: string; end_date?: string }) => {
    const qs = new URLSearchParams();
    if (params.start_date) qs.set('start_date', params.start_date);
    if (params.end_date) qs.set('end_date', params.end_date);
    const token = getToken();
    const url = `${API_URL}/reviews/${locationId}/export?${qs}`;
    const a = document.createElement('a');
    a.href = url;
    if (token) {
      // Ouvre dans un onglet séparé (le token est dans le header, pas dans l'URL)
      // On fait un fetch et on force le download
      fetch(url, { headers: { Authorization: `Bearer ${token}` } })
        .then((r) => r.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          a.href = blobUrl;
          a.download = `avis_${locationId}.csv`;
          a.click();
          URL.revokeObjectURL(blobUrl);
        });
    }
  },
};

// Types
export interface User {
  id: number;
  email: string;
  name: string | null;
  picture: string | null;
}

export interface Location {
  id: number;
  location_name: string;
  account_name: string;
  business_name: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  synced_at: string | null;
}

export interface Review {
  id: number;
  review_id: string;
  reviewer_name: string | null;
  reviewer_photo: string | null;
  star_rating: number | null;
  comment: string | null;
  create_time: string | null;
  update_time: string | null;
  reply_text: string | null;
  reply_time: string | null;
}

export interface ReviewStats {
  total: number;
  average_rating: number;
  distribution: Record<number, number>;
}

export interface ReviewsResponse {
  reviews: Review[];
  stats: ReviewStats;
  location: Location;
}

export interface ReviewsParams {
  start_date?: string;
  end_date?: string;
  star?: number;
  has_reply?: boolean;
}

export interface SyncResponse {
  synced: number;
  location_name: string;
}
