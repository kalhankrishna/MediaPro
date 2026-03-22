import { redirect } from 'next/navigation';

const GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:3000';

export function GET(): never {
  redirect(`${GATEWAY_URL}/auth/github`);
}
