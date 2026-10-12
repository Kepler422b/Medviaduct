// app/api/auth/switch/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest, switchActor, SEEDED_ACCOUNTS } from '@/lib/server/auth';
import { recordAudit } from '@/lib/server/audit';

export async function POST(req: NextRequest) {
  try {
    const currentActor = getActorFromRequest(req);
    const body: any = await req.json().catch(() => ({}));
    const targetAccountId = body?.accountId || body?.actorId;

    if (!targetAccountId || !SEEDED_ACCOUNTS[targetAccountId]) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid accountId. Valid options: ${Object.keys(SEEDED_ACCOUNTS).join(', ')}`
        },
        { status: 400 }
      );
    }

    const switched = switchActor(targetAccountId);

    recordAudit({
      actorUserId: currentActor.userId,
      actorRole: currentActor.role,
      actorName: currentActor.name,
      action: 'AUTH_LOGIN',
      resourceName: `actor:${targetAccountId}`,
      outcome: 'ALLOW',
      reasonCode: 'SESSION_SWITCHED',
      clientIp: req.headers.get('x-forwarded-for') || '127.0.0.1',
      requestId: `req-sw-${Date.now()}`,
      metadata: { previousActor: currentActor.userId, newActor: switched.userId }
    });

    const response = NextResponse.json({
      success: true,
      message: `Switched active session to ${switched.name} (${switched.role})`,
      actor: switched
    });

    // Set cookie for browser sessions
    response.cookies.set('medviaduct_actor', targetAccountId, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax'
    });

    return response;
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
