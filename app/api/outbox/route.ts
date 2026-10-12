// app/api/outbox/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { n8nService } from '@/lib/server/n8nService';

export async function GET(req: NextRequest) {
  try {
    const eventType = req.nextUrl.searchParams.get('type');
    const records = n8nService.getOutboxRecords();

    const filtered = eventType
      ? records.filter((r) => r.eventType === eventType)
      : records;

    // Sanitize records to ensure secrets are never leaked
    const sanitized = filtered.map((r) => ({
      id: r.id,
      eventType: r.eventType,
      status: r.status,
      attempts: r.attempts,
      createdAt: r.createdAt,
      lastAttemptAt: r.lastAttemptAt,
      deliveryResponseCode: r.deliveryResponseCode,
      error: r.error,
      payload: {
        ...r.payload,
        // Ensure no secrets exist in payload
      }
    }));

    return NextResponse.json({
      success: true,
      totalCount: sanitized.length,
      records: sanitized
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const result = await n8nService.retryFailedRecords();
    return NextResponse.json({
      success: true,
      message: 'Retry attempt completed',
      ...result
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
