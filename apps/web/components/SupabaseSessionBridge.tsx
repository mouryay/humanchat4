'use client';

export default function SupabaseSessionBridge() {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('SupabaseSessionBridge is a no-op: Supabase has been removed.');
  }
  return null;
}
