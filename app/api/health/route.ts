import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    service: 'medviaduct-api',
    timestamp: new Date().toISOString()
  });
}
