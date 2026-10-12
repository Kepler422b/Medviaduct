// app/api/medimate/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getActorFromRequest } from '@/lib/server/auth';
import { aiService } from '@/lib/server/aiService';

export async function POST(req: NextRequest) {
  try {
    const actor = getActorFromRequest(req);
    const body: any = await req.json().catch(() => ({}));
    const message = body?.message || body?.prompt || '';
    const patientId = body?.patientId || (actor.role === 'PATIENT' ? actor.domainId : 'PAT-MH-40192');
    const accessGrantId =
      req.headers.get('x-access-grant-id') ||
      body?.accessGrantId ||
      undefined;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message text is required' },
        { status: 400 }
      );
    }

    const requestId = `req-chat-${Date.now()}`;
    const clientIp = req.headers.get('x-forwarded-for') || '127.0.0.1';

    const chatResponse = await aiService.processChatQuery({
      actor,
      patientId,
      userPrompt: message,
      accessGrantId,
      requestId,
      clientIp
    });

    return NextResponse.json({
      success: true,
      data: chatResponse
    });
  } catch (err: any) {
    const statusCode = err.statusCode || 403;
    return NextResponse.json(
      {
        success: false,
        error: err.message || 'Chat query failed',
        reasonCode: 'UNAUTHORIZED_CHAT_REQUEST'
      },
      { status: statusCode }
    );
  }
}
