import { Timestamp } from '@mediapro/proto';

export function toTimestamp(date: Date): Timestamp {
  const ms = date.getTime();
  return {
    seconds: BigInt(Math.floor(ms / 1000)),
    nanos: (ms % 1000) * 1_000_000,
  };
}

export function fromTimestamp(ts: Timestamp): Date {
  return new Date(Number(ts.seconds) * 1000 + ts.nanos / 1_000_000);
}