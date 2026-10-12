// app/api/patients/[id]/records/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest } from '@/lib/server/auth';
import { rbacService } from '@/lib/server/rbac';
import { patientService } from '@/services/patientService';
import { n8nService, getEnvConfig } from '@/lib/server/n8nService';

export async function GET(
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

    const requestId = `req-rec-${Date.now()}`;
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // Zero-trust RBAC gate
    const decision = rbacService.authorizeClinicalAccess({
      actor,
      targetPatientId,
      accessGrantId,
      requestedScope: 'timeline:read',
      resourceName: 'patient_clinical_records',
      requestId,
      clientIp
    });

    if (!decision.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: decision.errorMessage,
          reasonCode: decision.reasonCode
        },
        { status: decision.statusCode || 403 }
      );
    }

    // Access granted: fetch bundle
    const bundle = patientService.getBundle(targetPatientId);

    // GOAL 1: If an authenticated clinician accessed an authorized patient's records,
    // trigger patient access notification to n8n outbox asynchronously.
    // Temporary notification/email delivery failure must NEVER block clinical record access.
    if (actor.role === 'CLINICIAN') {
      try {
        const verifiedPatientEmail =
          getEnvConfig('VERIFIED_PATIENT_EMAIL') ||
          bundle.profile.email ||
          'patient@medviaduct.org';

        await n8nService.enqueuePatientAccessEvent({
          patientId: targetPatientId,
          patientEmail: verifiedPatientEmail,
          clinicianName: actor.name || 'Dr. Alex Morgan, MD'
        }).catch((err) => {
          console.error('[n8n Service] Notification error (access preserved):', err?.message || err);
        });
      } catch (err: any) {
        console.error('[n8n Service] Outbox enqueue error:', err?.message || err);
      }
    }

    return NextResponse.json({
      success: true,
      accessMode: decision.accessMode,
      patientId: targetPatientId,
      profile: bundle.profile,
      consultations: bundle.consultations,
      prescriptions: bundle.prescriptions,
      allergies: bundle.allergies,
      conditions: bundle.conditions,
      labResults: bundle.labResults,
      timelineEvents: bundle.consultations.map(c => ({
        date: c.date,
        type: 'Consultation',
        title: `${c.specialty} visit with ${c.clinicianName || c.clinician || 'Attending Physician'}`,
        details: c.clinicalFindings || c.assessment || c.plan
      }))
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
