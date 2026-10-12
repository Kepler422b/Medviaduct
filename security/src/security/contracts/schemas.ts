import { z } from 'zod';
import { Scope, SUPPORTED_SCOPES, EMERGENCY_REASON_CODES } from './types.js';

export const CreateConsentSchema = z
  .object({
    clinicianId: z.string().uuid({ message: 'clinicianId must be a valid UUID' }),
    scopes: z
      .array(z.enum(SUPPORTED_SCOPES as [Scope, ...Scope[]]))
      .min(1, { message: 'At least one scope must be granted' }),
    durationMinutes: z
      .number()
      .int()
      .min(1, { message: 'Duration must be at least 1 minute' })
      .max(60, { message: 'Duration cannot exceed 60 minutes' })
      .default(30),
  })
  .strict({ message: 'Unauthorized client-supplied fields are rejected' })
  .refine(
    (data) => {
      if (data.scopes.includes('clinical-summary:generate')) {
        return data.scopes.includes('timeline:read');
      }
      return true;
    },
    {
      message: 'Scope "timeline:read" is required when granting "clinical-summary:generate"',
      path: ['scopes'],
    }
  );

export type CreateConsentInput = z.infer<typeof CreateConsentSchema>;

export const GenerateQrSchema = z
  .object({
    consentId: z.string().uuid({ message: 'consentId must be a valid UUID' }),
  })
  .strict({ message: 'Unauthorized client-supplied fields are rejected' });

export type GenerateQrInput = z.infer<typeof GenerateQrSchema>;

export const ResolveQrSchema = z
  .object({
    token: z
      .string()
      .min(16, { message: 'Token format invalid or too short' })
      .max(256, { message: 'Token exceeds bounded length' }),
  })
  .strict({ message: 'Unauthorized client-supplied fields are rejected' });

export type ResolveQrInput = z.infer<typeof ResolveQrSchema>;

export const RevokeConsentParamsSchema = z
  .object({
    id: z.string().uuid({ message: 'id must be a valid UUID' }),
  })
  .strict();

export const CreateEmergencyAccessSchema = z
  .object({
    patientId: z.string().uuid({ message: 'patientId must be a valid UUID' }),
    reasonCode: z
      .enum((EMERGENCY_REASON_CODES as unknown) as [string, ...string[]])
      .default('IMMINENT_THREAT_TO_LIFE'),
    reasonText: z
      .string()
      .trim()
      .min(10, { message: 'Emergency reason text must be at least 10 characters explaining the clinical emergency' })
      .max(500, { message: 'Emergency reason text cannot exceed 500 characters' })
      .optional(),
    justification: z
      .string()
      .trim()
      .min(10, { message: 'Emergency justification must be at least 10 characters explaining the clinical emergency' })
      .max(500, { message: 'Emergency justification cannot exceed 500 characters' })
      .optional(),
    durationMinutes: z
      .number()
      .int()
      .min(1, { message: 'Duration must be at least 1 minute' })
      .max(5, { message: 'Emergency access duration cannot exceed 5 minutes' })
      .default(5)
      .optional(),
    scopes: z
      .array(z.literal('timeline:read'))
      .max(1, { message: 'Emergency access only permits fixed scope timeline:read' })
      .default(['timeline:read'])
      .optional(),
  })
  .strict({ message: 'Unauthorized client-supplied fields are rejected' })
  .refine(
    (data) => Boolean(data.reasonText || data.justification),
    {
      message: 'A meaningful bounded explanation (reasonText or justification) of at least 10 characters is required',
      path: ['reasonText'],
    }
  );

export type CreateEmergencyAccessInput = z.infer<typeof CreateEmergencyAccessSchema>;

export const RevokeEmergencyAccessParamsSchema = z
  .object({
    id: z.string().uuid({ message: 'id must be a valid UUID' }),
  })
  .strict();

export const PermittedAggregateRecordSchema = z
  .object({
    region: z.string().min(1),
    timeBucket: z.string().min(1),
    conditionCategory: z.string().min(1),
    caseCount: z.number().int().nonnegative().nullable(), // Null when suppressed, NOT zero!
    suppressionStatus: z.enum(['available', 'suppressed_unavailable']),
    thresholdApplied: z.number().int().positive().default(10),
  })
  .strict({ message: 'Identifiable patient attributes are strictly forbidden in aggregate feeds' });

export type PermittedAggregateRecordInput = z.infer<typeof PermittedAggregateRecordSchema>;

export const AggregateQueryFilterSchema = z
  .object({
    region: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    conditionCategory: z.string().optional(),
  })
  .strict();

