// app/api/qr/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest } from '@/lib/server/auth';
import { qrService } from '@/lib/server/qrService';

export async function POST(req: NextRequest) {
  try {
    const actor = getActorFromRequest(req);
    const body: any = await req.json().catch(() => ({}));

    // Target patient is either specified in body or defaults to current patient actor's ID
    const patientId = body?.patientId || (actor.role === 'PATIENT' ? actor.domainId : 'PAT-MH-40192');
    const patientName = body?.patientName || (patientId === 'PAT-MH-40192' ? 'Ananya Deshmukh' : 'Demo Patient');
    const durationMinutes = body?.durationMinutes ? Number(body.durationMinutes) : 15;
    const singleUse = body?.singleUse === true;

    const tokenResult = await qrService.generateToken({
      patientId,
      patientName,
      issuerUser: actor,
      durationMinutes,
      singleUse,
      scopes: ['timeline:read', 'clinical-summary:generate']
    });

    return NextResponse.json({
      success: true,
      data: {
        token: tokenResult.rawToken,
        expiresAt: tokenResult.expiresAt,
        tokenHash: tokenResult.tokenHash,
        singleUse: tokenResult.singleUse,
        patientId,
        patientName
      }
    });
  } catch (err: any) {
    const message = err.message || 'Failed to generate QR token';
    const isIdor = message.includes('IDOR_VIOLATION') || message.includes('FORBIDDEN_ROLE');
    return NextResponse.json(
      { success: false, error: message },
      { status: isIdor ? 403 : 400 }
    );
  }
}
