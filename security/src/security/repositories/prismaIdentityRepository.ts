import { PrismaClient } from '@prisma/client';
import { IdentityRepository } from '../contracts/interfaces.js';
import {
  UserAccountRecord,
  PatientProfileRecord,
  ClinicianProfileRecord,
  UserRole,
} from '../contracts/types.js';

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getUserAccount(userId: string): Promise<UserAccountRecord | null> {
    const user = await this.prisma.userAccount.findUnique({
      where: { id: userId },
    });
    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      role: user.role as UserRole,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }

  async getPatientByUserId(userId: string): Promise<PatientProfileRecord | null> {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { userId },
    });
    if (!profile) return null;

    return {
      id: profile.id,
      userId: profile.userId,
      mrn: profile.mrn,
      createdAt: profile.createdAt,
    };
  }

  async getClinicianByUserId(userId: string): Promise<ClinicianProfileRecord | null> {
    const profile = await this.prisma.clinicianProfile.findUnique({
      where: { userId },
    });
    if (!profile) return null;

    return {
      id: profile.id,
      userId: profile.userId,
      licenseNumber: profile.licenseNumber,
      isVerified: profile.isVerified,
      verificationStatus: profile.verificationStatus,
      hasEmergencyAccessPermission: profile.hasEmergencyAccessPermission ?? false,
      createdAt: profile.createdAt,
    };
  }

  async getClinicianById(clinicianId: string): Promise<ClinicianProfileRecord | null> {
    const profile = await this.prisma.clinicianProfile.findUnique({
      where: { id: clinicianId },
    });
    if (!profile) return null;

    return {
      id: profile.id,
      userId: profile.userId,
      licenseNumber: profile.licenseNumber,
      isVerified: profile.isVerified,
      verificationStatus: profile.verificationStatus,
      hasEmergencyAccessPermission: profile.hasEmergencyAccessPermission ?? false,
      createdAt: profile.createdAt,
    };
  }

  async getPatientById(patientId: string): Promise<PatientProfileRecord | null> {
    const profile = await this.prisma.patientProfile.findUnique({
      where: { id: patientId },
    });
    if (!profile) return null;

    return {
      id: profile.id,
      userId: profile.userId,
      mrn: profile.mrn,
      createdAt: profile.createdAt,
    };
  }

  async listAvailableClinicians(): Promise<ClinicianProfileRecord[]> {
    const clinicians = await this.prisma.clinicianProfile.findMany({
      where: { isVerified: true },
    });

    return clinicians.map((profile) => ({
      id: profile.id,
      userId: profile.userId,
      licenseNumber: profile.licenseNumber,
      isVerified: profile.isVerified,
      verificationStatus: profile.verificationStatus,
      hasEmergencyAccessPermission: profile.hasEmergencyAccessPermission ?? false,
      createdAt: profile.createdAt,
    }));
  }
}
