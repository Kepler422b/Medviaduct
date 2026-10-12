// app/api/auth/me/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest, SEEDED_ACCOUNTS } from '@/lib/server/auth';

export async function GET(req: NextRequest) {
  const actor = getActorFromRequest(req);
  return NextResponse.json({
    success: true,
    actor,
    availableAccounts: Object.entries(SEEDED_ACCOUNTS).map(([key, a]) => ({
      key,
      userId: a.userId,
      name: a.name,
      role: a.role
    }))
  });
}
