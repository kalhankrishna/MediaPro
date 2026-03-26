import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { gateway, GatewayError } from '@/lib/gateway';
import Header from '@/app/components/Header';
import ApiKeyManager from './ApiKeyManager';

export const metadata: Metadata = {
  title: 'API Keys — MediaPro',
};

interface ApiKey {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

export default async function ApiKeysPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get('access_token')?.value;
  if (!token) redirect('/login');

  let decoded: { userId?: unknown; email?: unknown };
  try {
    const [, p] = token.split('.');
    decoded = JSON.parse(Buffer.from(p, 'base64url').toString());
  } catch {
    redirect('/login');
  }
  if (!decoded!.userId || !decoded!.email) redirect('/login');
  const email = decoded!.email as string;

  let initialKeys: ApiKey[] = [];
  try {
    const { keys } = await gateway.listApiKeys();
    initialKeys = keys;
  } catch (err) {
    if (err instanceof GatewayError && err.status === 401) {
      redirect('/login?error=session_expired');
    }
    // Other errors: render with empty list
  }

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <Header email={email} />
      <main className="flex-1 px-4 sm:px-6 pt-8 pb-6 max-w-5xl w-full mx-auto">
        <ApiKeyManager initialKeys={initialKeys} />
      </main>
    </div>
  );
}
