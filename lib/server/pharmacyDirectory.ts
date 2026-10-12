// lib/server/pharmacyDirectory.ts
/**
 * Medviaduct Trusted Pharmacy Directory
 *
 * Server-authoritative registry of licensed pharmacy partners.
 * In accordance with healthcare data safety standards:
 * 1. Pharmacy notification emails are RESOLVED EXCLUSIVELY from this server directory.
 * 2. Client-supplied pharmacy emails are strictly ignored to prevent phishing and spoofing.
 * 3. Safe development override: Allows testing notifications via N8N_PHARMACY_NOTIFICATION_EMAIL
 *    without broadcasting to unintended recipients.
 */

import { getEnvConfig } from './n8nService';

export interface PharmacyRecord {
  id: string;
  name: string;
  licenseNumber: string;
  address: string;
  city: string;
  contactPhone: string;
  notificationEmail: string;
  isVerified: boolean;
}

const TRUSTED_PHARMACIES: PharmacyRecord[] = [
  {
    id: 'PHARM-MUM-DADAR-01',
    name: 'Apollo Pharmacy - Dadar West Branch',
    licenseNumber: 'MH-FDA-2024-91024',
    address: 'Shop 4, Shivam Enclave, Dadar West, Mumbai, Maharashtra 400028',
    city: 'Mumbai',
    contactPhone: '+91 22 2412 8831',
    notificationEmail: 'dadar.dispensary@pharmacy.medviaduct.org',
    isVerified: true
  },
  {
    id: 'PHARM-MUM-WORLI-02',
    name: 'MedPlus Chemists - Worli Sea Face',
    licenseNumber: 'MH-FDA-2024-84110',
    address: 'Premises 2, Sagar Vihar, Worli Sea Face, Mumbai, Maharashtra 400018',
    city: 'Mumbai',
    contactPhone: '+91 22 2493 1120',
    notificationEmail: 'worli.dispensary@pharmacy.medviaduct.org',
    isVerified: true
  },
  {
    id: 'PHARM-NSK-GANGAPUR-03',
    name: 'Wellness Forever 24x7 - Gangapur Road',
    licenseNumber: 'MH-FDA-2024-73091',
    address: 'Plot 18, Godavari Greens, Gangapur Road, Nashik, Maharashtra 422013',
    city: 'Nashik',
    contactPhone: '+91 253 231 9084',
    notificationEmail: 'nashik.dispensary@pharmacy.medviaduct.org',
    isVerified: true
  },
  {
    id: 'PHARM-NGP-RAMDASPETH-04',
    name: 'Noble Chemists - Ramdaspeth Central',
    licenseNumber: 'MH-FDA-2024-66219',
    address: 'Plot 44, Hilltop Complex, Ramdaspeth, Nagpur, Maharashtra 440010',
    city: 'Nagpur',
    contactPhone: '+91 712 252 4410',
    notificationEmail: 'nagpur.dispensary@pharmacy.medviaduct.org',
    isVerified: true
  },
  {
    id: 'PHARM-CSN-GULMANDI-05',
    name: 'Sanjeevani Medical Stores - Old Bazaar',
    licenseNumber: 'MH-FDA-2024-55102',
    address: 'House 22, Old Bazaar Lane, Gulmandi Circle, Chhatrapati Sambhajinagar 431001',
    city: 'Chhatrapati Sambhajinagar',
    contactPhone: '+91 240 233 1940',
    notificationEmail: 'csn.dispensary@pharmacy.medviaduct.org',
    isVerified: true
  }
];

// Mapping default preferred pharmacy per demo patient
const PATIENT_PHARMACY_PREFERENCES: Record<string, string> = {
  'PAT-MH-40192': 'PHARM-MUM-DADAR-01',
  'PAT-MH-51204': 'PHARM-MUM-WORLI-02',
  'PAT-MH-62381': 'PHARM-NSK-GANGAPUR-03',
  'PAT-MH-73492': 'PHARM-NGP-RAMDASPETH-04',
  'PAT-MH-84513': 'PHARM-CSN-GULMANDI-05'
};

export const pharmacyDirectory = {
  /**
   * Resolve a pharmacy by ID from the trusted directory.
   * If a test environment variable is set (N8N_PHARMACY_NOTIFICATION_EMAIL),
   * the email is safely routed to that test inbox.
   */
  getPharmacyById(pharmacyId: string): PharmacyRecord | null {
    const pharmacy = TRUSTED_PHARMACIES.find((p) => p.id === pharmacyId);
    if (!pharmacy) return null;

    const testOverride =
      getEnvConfig('N8N_PHARMACY_NOTIFICATION_EMAIL') || getEnvConfig('PHARMACY_OWNER_EMAIL');

    return {
      ...pharmacy,
      notificationEmail: testOverride ? testOverride.trim() : pharmacy.notificationEmail
    };
  },

  /**
   * Resolve the patient's default preferred pharmacy.
   */
  getDefaultPharmacyForPatient(patientId: string): PharmacyRecord {
    const preferredId = PATIENT_PHARMACY_PREFERENCES[patientId] || 'PHARM-MUM-DADAR-01';
    return this.getPharmacyById(preferredId) || TRUSTED_PHARMACIES[0];
  },

  /**
   * List all verified pharmacies in the directory.
   */
  listVerifiedPharmacies(): PharmacyRecord[] {
    return TRUSTED_PHARMACIES.map((p) => ({ ...p }));
  }
};
