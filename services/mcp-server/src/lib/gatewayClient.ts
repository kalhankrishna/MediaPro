const GATEWAY_URL = process.env.GATEWAY_URL;
if (!GATEWAY_URL) throw new Error('GATEWAY_URL is not defined');

async function gatewayFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${GATEWAY_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gateway error ${response.status}: ${error}`);
  }

  return response.json() as Promise<T>;
}

export const gateway = {
  search: (query: string) =>
    gatewayFetch<{ answer: string; sources: any[] }>('/search', {
      method: 'POST',
      body: JSON.stringify({ query }),
    }),

  getVideo: (videoId: string) =>
    gatewayFetch<{ id: string; title: string; status: string; files: any[] }>(`/videos/${videoId}`),

  listVideos: (userId: string) =>
    gatewayFetch<{ videos: any[] }>(`/videos?userId=${userId}`),

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
};