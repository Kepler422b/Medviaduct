import Workspace from '@/components/workspace';
import { PatientPortal } from '@/components/portals/patient-portal';
import { ClinicianPortal } from '@/components/portals/clinician-portal';
import { AdminPortal } from '@/components/portals/admin-portal';

const routes = [
  'dashboard',
  'case',
  'cases',
  'similar',
  'trends',
  'research',
  'saved',
  'profile',
  'login',
  'signup',
  'patient',
  'clinic',
  'admin'
];

export function generateStaticParams() {
  return routes.map((section) => ({ section }));
}

export default async function Page({
  params
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (section === 'patient') return <PatientPortal />;
  if (section === 'clinic') return <ClinicianPortal />;
  if (section === 'admin') return <AdminPortal />;
  return <Workspace section={section} />;
}
