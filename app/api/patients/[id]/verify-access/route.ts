// app/api/patients/[id]/verify-access/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest, sha256Hex } from '@/lib/server/auth';
import { qrService } from '@/lib/server/qrService';
import { recordAudit } from '@/lib/server/audit';
import { patientService } from '@/services/patientService';

// SHA-256 digests of valid demo access IDs
const AUTHORIZED_ACCESS_HASHES: Record<string, string[]> = {
  'PAT-MH-40192': [
    '1773925c626f1448e997c5986bef3bd27fe0a0b6388285270a5f8f9f14fa1173',
    'f37204a6703eb2a57bd75c7dc9305a5df6852f0154cad19bd1ca97a7603f8a9b',
    '5787e97f3fabadccf46ffae508100534d1d731d8b3124ba1fbd4f6ba02907f59',
    'b78793275a8fef987c1e3e84814c80617a3d570518636ef20f8db69980fc8329',
    '04a1ac85843847c1f424acd3f74158afc508e1c5ad5188fc6a2d1d49576d4dd5'
  ],
  'PAT-MH-51204': [
    'aab00499d62abd47952a92d5c28eca537728bb2ccdd37e6aa19baddead1fdfa5',
    '72e6eb5008b3a18571af98481131cfe0cc6f55a8440681cb007e43c543892b95',
    '5b2458168d12c76ca565414f02946d5c53079f786d0bd53345d7b784dc5eb5fc',
    'be8b51a040df1a20ea4294c2793f1269a1029dba8dad06a55100245e3178db00',
    '075986b2df8c471c4bfca3e2fa138d93a8b482e2f80283990f4cba7bc42a89da'
  ],
  'PAT-MH-62381': [
    'aa2a86a337ca2244ffbb760fd5f90dca51179d99ed777600c2ccff719f382661',
    'bce2854370973b654401c0defe71c0bd8f385f282aea8ff3d7367775c8c47cf8',
    '3e8101bcfe4a6bfa1035df7def9db25d1343d95d8c37308899eb6ab5887d84e1',
    'a45eae4144acbeb8d7be0e1069ff15dc959774d1024455f423fd56e7b5f12c20',
    '33037fc4a4c89e088b6c9b9003d22644324b0ff634f0c6792d6cc6127240340b'
  ],
  'PAT-MH-73492': [
    '4ee85c83a6c9d861cbefad31088078743514b35b97e6447e58f8b5fe730fb4dc',
    '3e12e5db6abcc9bc58a6fb668d8673a8745f7a6a1b0063f74b5752107e8dbeb2',
    'eae6d2d8613a83b23daabd27f210517fa0ff21126a725ee0199fd36cc051906b',
    'b87a0491e510c8af106d05b99713cf6b7645d09bb15496d4bd486ea737087d54',
    'f7ca231d9c7552471f9a5655c8bea105a1d0d0581ab915b9d0b09687c8906489'
  ],
  'PAT-MH-84513': [
    '68c25d67bf5fbf08ba3ec0f2c3579f41d9b5d72ddc13d7f73112934ed574d6c2',
    'cf0bfe252941b63be35405f222b4f520633386ae1c008f3fca0dfdb723554c59',
    '0b6146b7a9777fa5346ca68ec69eebdd93c8f632855af3cfefab68e1cfa5130f',
    'e9c555db6cadb792c0be188c523fb4a1d15bf182c43afa563f1063a0e019fafe',
    '6aa1e11cf2f148299159092c4470922399017581e0bc4144446425ac384979cb'
  ]
};

const serverThrottle = new Map<string, { attempts: number; lockedUntil: number | null }>();

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const actor = getActorFromRequest(req);
    const targetPatientId = params.id;
    const body: any = await req.json().catch(() => ({}));
    const accessId = typeof body?.accessId === 'string' ? body.accessId.trim() : '';

    const now = Date.now();
    const throttleRecord = serverThrottle.get(targetPatientId) || { attempts: 0, lockedUntil: null };

    if (throttleRecord.lockedUntil && throttleRecord.lockedUntil > now) {
      const remainingSec = Math.ceil((throttleRecord.lockedUntil - now) / 1000);
      return NextResponse.json(
        {
          success: false,
          error: `Too many failed attempts. Verification throttled for ${remainingSec}s.`,
          isThrottled: true,
          throttleSecondsRemaining: remainingSec
        },
        { status: 429 }
      );
    }

    if (!accessId) {
      return NextResponse.json(
        { success: false, error: 'Access ID is required.' },
        { status: 400 }
      );
    }

    const inputHash = sha256Hex(accessId.toUpperCase());
    const allowedHashes = AUTHORIZED_ACCESS_HASHES[targetPatientId] || [];

    if (!allowedHashes.includes(inputHash)) {
      const nextFailures = throttleRecord.attempts + 1;
      const willLock = nextFailures >= 5;
      serverThrottle.set(targetPatientId, {
        attempts: willLock ? 0 : nextFailures,
        lockedUntil: willLock ? now + 30000 : null
      });

      recordAudit({
        actorUserId: actor.userId,
        actorRole: actor.role,
        actorName: actor.name,
        targetPatientId,
        action: 'ACCESS_ID_VERIFICATION_FAILED',
        resourceName: 'patient_access_id',
        outcome: 'DENY',
        reasonCode: 'INVALID_ACCESS_ID',
        clientIp: req.headers.get('x-forwarded-for') || '127.0.0.1',
        requestId: `verify-fail-${Date.now()}`
      });

      return NextResponse.json(
        { success: false, error: 'Invalid Access ID. Please try again.' },
        { status: 401 }
      );
    }

    // Success
    serverThrottle.delete(targetPatientId);
    let patientBundle;
    try {
      patientBundle = patientService.getBundle(targetPatientId);
    } catch {
      return NextResponse.json({ success: false, error: 'Patient not found' }, { status: 404 });
    }

    const grant = qrService.createAccessGrant({
      patientId: targetPatientId,
      patientName: patientBundle.profile.name,
      clinicianId: actor.domainId || actor.userId,
      durationMinutes: 60
    });

    recordAudit({
      actorUserId: actor.userId,
      actorRole: actor.role,
      actorName: actor.name,
      targetPatientId,
      action: 'ACCESS_ID_VERIFIED',
      resourceName: 'patient_access_id',
      outcome: 'ALLOW',
      reasonCode: 'ACCESS_ID_HASH_VERIFIED',
      clientIp: req.headers.get('x-forwarded-for') || '127.0.0.1',
      requestId: `verify-ok-${Date.now()}`,
      metadata: { grantId: grant.grantId }
    });

    return NextResponse.json({
      success: true,
      grantId: grant.grantId,
      expiresAt: grant.expiresAt
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
