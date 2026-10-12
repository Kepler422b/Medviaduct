// app/api/analytics/public-health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAggregatePublicHealthReport } from '@/lib/server/publicHealthService';
import type { SurveilledDisease } from '@/data/maharashtraData';

export async function GET(req: NextRequest) {
  try {
    const diseaseParam = req.nextUrl.searchParams.get('disease') || 'Dengue';
    const validDiseases: SurveilledDisease[] = [
      'Dengue',
      'Malaria',
      'COVID-19',
      'Influenza H1N1',
      'Acute Diarrheal Disease',
      'Leptospirosis',
      'Chikungunya'
    ];

    const disease = validDiseases.includes(diseaseParam as SurveilledDisease)
      ? (diseaseParam as SurveilledDisease)
      : 'Dengue';

    const report = getAggregatePublicHealthReport(disease);

    return NextResponse.json({
      success: true,
      report
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || 'Failed to fetch surveillance report' },
      { status: 500 }
    );
  }
}
