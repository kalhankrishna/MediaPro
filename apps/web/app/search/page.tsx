import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Header from '@/app/components/Header';
import SearchForm from './SearchForm';

export const metadata: Metadata = {
  title: 'Search — MediaPro',
};

export default async function SearchPage() {
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

  return (
    <div className="min-h-screen bg-background text-white flex flex-col">
      <Header email={email} />
      <main className="flex-1 px-4 sm:px-6 pt-8 pb-6 max-w-5xl w-full mx-auto">
        <SearchForm />
      </main>
    </div>
  );
}
