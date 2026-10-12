// app/api/qr/resolve/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest } from '@/lib/server/auth';
import { qrService } from '@/lib/server/qrService';
import { patientService } from '@/services/patientService';
import { n8nService } from '@/lib/server/n8nService';

export async function POST(req: NextRequest) {
  try {
    const actor = getActorFromRequest(req);
    const body: any = await req.json().catch(() => ({}));
    const rawToken = body?.token || body?.rawToken;

    if (!rawToken || typeof rawToken !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Token is required', code: 'MISSING_TOKEN' },
        { status: 400 }
      );
    }

    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    // Verify and resolve token on backend
    const grant = await qrService.resolveToken({
      rawToken,
      requestingUser: actor,
      clientIp
    });

    // On successful grant, retrieve authorized patient bundle
    const patientBundle = patientService.getBundle(grant.patientId);

    // GOAL 1: Send access notification if clinician resolves and accesses patient records
    if (actor.role === 'CLINICIAN') {
      try {
        const verifiedPatientEmail =
          process.env.VERIFIED_PATIENT_EMAIL ||
          patientBundle.profile.email ||
          'patient@medviaduct.org';

        n8nService.enqueuePatientAccessEvent({
          patientId: grant.patientId,
          patientEmail: verifiedPatientEmail,
          clinicianName: actor.name || 'Dr. Alex Morgan, MD'
        }).catch(() => {});
      } catch {}
    }

    return NextResponse.json({
      success: true,
      data: {
        accessGrant: grant,
        patient: {
          id: patientBundle.profile.id,
          name: patientBundle.profile.name,
          uhid: patientBundle.profile.uhid,
          age: patientBundle.profile.age,
          sex: patientBundle.profile.sex,
          bloodGroup: patientBundle.profile.bloodGroup,
          address: patientBundle.profile.address,
          primaryDiagnosis: patientBundle.conditions[0]?.condition || 'Under Clinical Evaluation'
        },
        records: {
          consultationsCount: patientBundle.consultations.length,
          prescriptionsCount: patientBundle.prescriptions.length,
          allergiesCount: patientBundle.allergies.length,
          conditionsCount: patientBundle.conditions.length,
          labResultsCount: patientBundle.labResults.length
        },
        fullBundle: patientBundle
      }
    });
  } catch (err: any) {
    const message = err.message || 'Token verification failed';
    let statusCode = 403;
    let errorCode = 'ACCESS_DENIED';

    if (message.includes('INVALID_TOKEN')) {
      statusCode = 400;
      errorCode = 'INVALID_TOKEN';
    } else if (message.includes('REVOKED_TOKEN')) {
      statusCode = 403;
      errorCode = 'REVOKED_TOKEN';
    } else if (message.includes('CONSUMED_TOKEN')) {
      statusCode = 403;
      errorCode = 'CONSUMED_TOKEN';
    } else if (message.includes('EXPIRED_TOKEN')) {
      statusCode = 403;
      errorCode = 'EXPIRED_TOKEN';
    } else if (message.includes('UNASSIGNED_CLINICIAN_DENIED')) {
      statusCode = 403;
      errorCode = 'UNASSIGNED_CLINICIAN_DENIED';
    } else if (message.includes('FORBIDDEN_ROLE') || message.includes('Role ADMIN')) {
      statusCode = 403;
      errorCode = 'FORBIDDEN_ROLE';
    }

    return NextResponse.json(
      {
        success: false,
        error: message,
        code: errorCode
      },
      { status: statusCode }
    );
  }
}
