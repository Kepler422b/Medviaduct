// app/api/audit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest } from '@/lib/server/auth';
import { listAuditLogs, getAuditLedgerCount } from '@/lib/server/audit';

export async function GET(req: NextRequest) {
  try {
    const actor = getActorFromRequest(req);
    const limit = Number(req.nextUrl.searchParams.get('limit') || '50');

    const logs = listAuditLogs(actor.role, limit);
    const totalCount = getAuditLedgerCount();

    return NextResponse.json({
      success: true,
      totalCount,
      returnedCount: logs.length,
      logs
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Audit query forbidden' },
      { status: 403 }
    );
  }
}
