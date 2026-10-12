// app/api/patients/[id]/clinical-summary/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest } from '@/lib/server/auth';
import { aiService } from '@/lib/server/aiService';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const actor = getActorFromRequest(req);
    const targetPatientId = params.id;
    const accessGrantId =
      req.headers.get('x-access-grant-id') ||
      req.nextUrl.searchParams.get('grantId') ||
      undefined;

    const requestId = `req-ai-sum-${Date.now()}`;
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // aiService enforces mandatory pre-model RBAC check
    const summary = await aiService.generateClinicalSummary({
      actor,
      patientId: targetPatientId,
      accessGrantId,
      requestId,
      clientIp
    });

    return NextResponse.json({
      success: true,
      data: summary
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 403;
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Clinical summary generation denied',
        reasonCode: 'UNAUTHORIZED_AI_REQUEST'
      },
      { status: statusCode }
    );
  }
}
