import { cookies } from 'next/headers';
import type { Video } from '@/lib/types';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

class GatewayError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'GatewayError';
  }
}

async function gatewayFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('access_token')?.value;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>),
  };

  if (accessToken) {
    headers['Cookie'] = `access_token=${accessToken}`;
  }

  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...options,
    headers,
    cache: 'no-store', // always fresh — auth-gated data shouldn't be cached at edge
  });

  if (!res.ok) {
    const text = await res.text();
    throw new GatewayError(res.status, text);
  }

  return res.json() as Promise<T>;
}

export const gateway = {
  // Videos
  listVideos: (userId: string) =>
    gatewayFetch<{ videos: any[] }>(`/videos?userId=${userId}`),

  getVideo: (videoId: string) =>
    gatewayFetch<Video>(`/videos/${videoId}`),

  createVideo: (payload: { userId: string; title: string; originalResolution: string; duration: number }) =>
    gatewayFetch<{ videoId: string }>('/videos', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getUploadUrl: (videoId: string, contentType: string) =>
    gatewayFetch<{ url: string; key: string }>(`/videos/${videoId}/upload-url`, {
      method: 'POST',
      body: JSON.stringify({ contentType }),
    }),

  confirmUpload: (videoId: string) =>
    gatewayFetch<{ message: string }>(`/videos/${videoId}/confirm`, {
      method: 'POST',
    }),

  getTranscript: (videoId: string) =>
    gatewayFetch<{ content: string; segmentsJson?: string | null; createdAt: string }>(`/videos/${videoId}/transcript`),

  deleteVideo: (videoId: string) =>
    gatewayFetch<{ message: string }>(`/videos/${videoId}`, {
      method: 'DELETE',
    }),

  // Search
  search: (query: string) =>
    gatewayFetch<{ answer: string; sources: any[] }>('/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  // API Keys
  createApiKey: (name: string) =>
    gatewayFetch<{ keyId: string; key: string; name: string }>('/api-keys', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),

  listApiKeys: () =>
    gatewayFetch<{ keys: { id: string; name: string; createdAt: string; lastUsedAt: string | null }[] }>('/api-keys'),

  revokeApiKey: (keyId: string) =>
    gatewayFetch<{ message: string }>(`/api-keys/${keyId}`, {
      method: 'DELETE',
    }),

  // Auth
  logout: () =>
    gatewayFetch<{ message: string }>('/auth/logout', {
      method: 'POST',
    }),
};

export { GatewayError };