// app/api/qr/revoke/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest } from '@/lib/server/auth';
import { qrService } from '@/lib/server/qrService';

export async function POST(req: NextRequest) {
  try {
    const actor = getActorFromRequest(req);
    const body: any = await req.json().catch(() => ({}));
    const token = body?.token || body?.rawToken || body?.tokenHash;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token or tokenHash is required' },
        { status: 400 }
      );
    }

    const revoked = await qrService.revokeToken(token, actor);

    return NextResponse.json({
      success: true,
      message: revoked ? 'Token revoked successfully' : 'Token not found or already inactive'
    });
  } catch (err: any) {
    const message = err.message || 'Revocation failed';
    const isIdor = message.includes('IDOR_VIOLATION');
    return NextResponse.json(
      { success: false, error: message },
      { status: isIdor ? 403 : 400 }
    );
  }
}
