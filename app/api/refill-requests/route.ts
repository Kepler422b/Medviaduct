// app/api/refill-requests/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest } from '@/lib/server/auth';
import { refillService } from '@/lib/server/refillService';

export async function POST(req: NextRequest) {
  try {
    const actor = getActorFromRequest(req);
    const body: any = await req.json().catch(() => ({}));

    const prescriptionId = body?.prescriptionId;
    if (!prescriptionId || typeof prescriptionId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: 'prescriptionId is required and must be a valid string.'
        },
        { status: 400 }
      );
    }

    const requestedQuantity = typeof body?.requestedQuantity === 'number' ? body.requestedQuantity : 30;
    const pharmacyId = typeof body?.pharmacyId === 'string' ? body.pharmacyId : undefined;
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // Intentionally pass any client-supplied pharmacy email to verify it gets ignored
    const result = await refillService.createRefillRequest({
      actor,
      prescriptionId: prescriptionId.trim(),
      requestedQuantity,
      pharmacyId,
      clientPharmacyEmail: body?.pharmacyEmail, // Ignored by refillService
      clientIp
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error
        },
        { status: result.statusCode || 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Refill request successfully recorded. Notification pending pharmacy review.',
      data: result.request
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const actor = getActorFromRequest(req);

    if (actor.role !== 'PATIENT' || !actor.domainId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Only authenticated patients can view their refill requests.'
        },
        { status: 403 }
      );
    }

    const requests = refillService.getRefillRequestsForPatient(actor.domainId);

    return NextResponse.json({
      success: true,
      data: requests
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Internal server error'
      },
      { status: 500 }
    );
  }
}
