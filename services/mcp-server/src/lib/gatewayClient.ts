const GATEWAY_URL = process.env.GATEWAY_URL;
if (!GATEWAY_URL) throw new Error('GATEWAY_URL is not defined');

export interface GatewayClient {
  search: (query: string) => Promise<{ answer: string; sources: any[] }>;
  getVideo: (videoId: string) => Promise<{ id: string; title: string; status: string; files: any[] }>;
  listVideos: (userId: string) => Promise<{ videos: any[] }>;
  createVideo: (payload: { userId: string; title: string; originalResolution: string; duration: number }) => Promise<{ videoId: string }>;
  getUploadUrl: (videoId: string, contentType: string) => Promise<{ url: string; key: string }>;
  confirmUpload: (videoId: string) => Promise<{ message: string }>;
}

export function createGatewayClient(authHeader?: string): GatewayClient {
  async function gatewayFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options?.headers as Record<string, string>),
    };

    if (authHeader) {
      headers['Authorization'] = authHeader;
    }

    const response = await fetch(`${GATEWAY_URL}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gateway error ${response.status}: ${error}`);
    }

    return response.json() as Promise<T>;
  }

  return {
    search: (query) =>
      gatewayFetch('/search', {
        method: 'POST',
        body: JSON.stringify({ query }),
      }),

    getVideo: (videoId) =>
      gatewayFetch(`/videos/${videoId}`),

    listVideos: (userId) =>
      gatewayFetch(`/videos?userId=${userId}`),

    createVideo: (payload) =>
      gatewayFetch('/videos', {
        method: 'POST',
        body: JSON.stringify(payload),
      }),

    getUploadUrl: (videoId, contentType) =>
      gatewayFetch(`/videos/${videoId}/upload-url`, {
        method: 'POST',
        body: JSON.stringify({ contentType }),
      }),

    confirmUpload: (videoId) =>
      gatewayFetch(`/videos/${videoId}/confirm`, {
        method: 'POST',
      }),
  };
}