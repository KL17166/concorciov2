import { z } from 'zod';

// Porteiro mobile-first — eventos de telemetria de evasão.
// Allowlist fechada: nada fora do enum é registrado.
// signals é um mapa achatado (string/number/boolean) ≤3KB — sem PII.
export const GATE_EVENT_TYPES = [
    'gate.view',
    'gate.bypass',
    'gate.devtools',
    'gate.resize-spoof',
    'gate.client-enforce'
] as const;

export const GateEventSchema = z.object({
    type: z.enum(GATE_EVENT_TYPES),
    signals: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
        .refine((s) => JSON.stringify(s).length <= 3072, { message: 'signals muito grande' })
        .optional()
        .default({})
});

export type GateEventInput = z.infer<typeof GateEventSchema>;
