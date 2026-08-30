/**
 * Underfrequency/UFLS study preset registry (UFR, per underfrequency-relay.md).
 *
 * Authoritative source of underfrequency study presets. Mirrors the O05
 * Overcurrent registry contract: presets are immutable `UnderfrequencyStudyPreset`
 * data; the study-state reducer edits a copy and never mutates the registry.
 * Validation (U01 § 12.7) is enforced at construction time so the UI cannot
 * select a preset the engine will reject.
 *
 * Canonical preset IDs and scenarios are defined in
 * `docs/engineering-specs/underfrequency-relay.md` § 10.
 */

import type {
  UnderfrequencyGeneratorData,
  UnderfrequencyStudyDefinition,
  UnderfrequencyStudyPreset,
  UnderfrequencyPresetId,
  UnderfrequencySystemData,
  UflsStageSettings,
} from '../types/underfrequency';
import { validateUnderfrequencyStudyDefinition } from './underfrequencyStudy';

// ──────────────── Default system & generator set (U01 § 10.1) ──────────────
// Four-unit PLN-style island. Sum of initial outputs = 1300 MW = baseLoad, so
// the nominal (UFR-01) preset is perfectly balanced (deficit 0, no pickup).

const SYSTEM: UnderfrequencySystemData = {
  fNominalHz: 50,
  voltageKv: 150,
  baseLoadMw: 1300,
};

const GENS: readonly UnderfrequencyGeneratorData[] = [
  { id: 'G1', label: 'G1 — Thermal 600 MW', mwRated: 600, mva: 700, inertiaSec: 5.0, droopPu: 0.05, poles: 2, governorMaxMw: 640, initialMw: 500, status: 'ONLINE' },
  { id: 'G2', label: 'G2 — Hydro 400 MW', mwRated: 400, mva: 450, inertiaSec: 4.0, droopPu: 0.04, poles: 4, governorMaxMw: 430, initialMw: 350, status: 'ONLINE' },
  { id: 'G3', label: 'G3 — Gas 300 MW', mwRated: 300, mva: 330, inertiaSec: 4.5, droopPu: 0.05, poles: 2, governorMaxMw: 320, initialMw: 250, status: 'ONLINE' },
  { id: 'G4', label: 'G4 — CCGT 250 MW', mwRated: 250, mva: 280, inertiaSec: 3.0, droopPu: 0.06, poles: 2, governorMaxMw: 265, initialMw: 200, status: 'ONLINE' },
];

// ──────────────── Default UFLS ladder (U01 § 10.2) ─────────────────────────
// PLN-style underfrequency load shedding. Marked plnVerificationRequired until
// the values are confirmed against an official grid code.

const UFLS: readonly UflsStageSettings[] = [
  { id: 'S1', label: 'Stage 1 — 49.50', enabled: true, thresholdHz: 49.50, timeDelaySec: 0.20, shedFractionPct: 5 },
  { id: 'S2', label: 'Stage 2 — 49.00', enabled: true, thresholdHz: 49.00, timeDelaySec: 0.30, shedFractionPct: 10 },
  { id: 'S3', label: 'Stage 3 — 48.50', enabled: true, thresholdHz: 48.50, timeDelaySec: 0.40, shedFractionPct: 15 },
  { id: 'S4', label: 'Stage 4 — 48.00', enabled: true, thresholdHz: 48.00, timeDelaySec: 0.50, shedFractionPct: 20 },
];

const PLN_NOTES = {
  plnVerificationRequired: true,
  sourceNote:
    'UFLS thresholds / shed fractions reflect typical PLN island practice; ' +
    'not yet verified against an official grid code.',
} as const;

// ──────────────── Throwing preset builder (O05-style) ──────────────────────

/**
 * Build and validate a preset. Construction throws on invalid data so the
 * registry never exposes a preset the engine will reject; this keeps the
 * UI ↔ engine contract symmetric with the O05 / O08 pattern.
 */
function preset(
  id: UnderfrequencyPresetId,
  label: string,
  description: string,
  overrides: Partial<UnderfrequencyStudyDefinition> = {},
): UnderfrequencyStudyPreset {
  const study: UnderfrequencyStudyDefinition = {
    id,
    label,
    description,
    system: SYSTEM,
    generators: GENS,
    relay: { enabled: true, modelLabel: 'UFR/UFLS — ANSI 81' },
    uflsStages: UFLS,
    disturbanceSteps: [],
    notes: PLN_NOTES,
    ...overrides,
  };
  const validation = validateUnderfrequencyStudyDefinition(study);
  if (validation.status === 'INVALID') {
    throw new Error(`Invalid Underfrequency preset ${id}: ${validation.issues.map((item) => `${item.path ?? item.code}: ${item.detail ?? item.code}`).join(' ')}`);
  }
  return { id, label, description, study };
}

// ──────────────── Canonical presets (U01 § 10) ─────────────────────────────

/**
 * UFR-01 — Nominal (no disturbance).
 * Expected outcome: balanced island, deficit 0, RESTRAIN, frequency at 50.00 Hz.
 */
export const UFR_01_NOMINAL: UnderfrequencyStudyPreset = preset(
  'UFR-01',
  'Nominal Operation',
  'Balanced island at nominal frequency; no disturbance, no UFLS operation, RESTRAIN.',
);

/**
 * UFR-02 — Lose large unit (G1, 500 MW).
 * Expected outcome: 500 MW deficit, ROCOF ≈ −3.03 Hz/s, UFLS Stage 1 sheds,
 * frequency arrests and recovers to a new steady state.
 */
export const UFR_02_LOSE_LARGE_UNIT: UnderfrequencyStudyPreset = preset(
  'UFR-02',
  'Loss of 500 MW Unit',
  'G1 (500 MW) trips; large deficit drives ROCOF ≈ −3 Hz/s and Stage 1 UFLS shedding.',
  {
    disturbanceSteps: [{ id: 'D1', kind: 'GENERATOR_LOSS', timeSec: 0, generatorId: 'G1' }],
  },
);

/**
 * UFR-03 — Lose two units (G1 + G2, 850 MW).
 * Expected outcome: deep deficit, multiple UFLS stages latch, frequency
 * arrests lower but recovers; demonstrates coordinated load shedding.
 */
export const UFR_03_LOSE_TWO_UNITS: UnderfrequencyStudyPreset = preset(
  'UFR-03',
  'Loss of Two Units',
  'G1 + G2 (850 MW) trip; staged UFLS sheds en route to arrest a deep decay.',
  {
    disturbanceSteps: [
      { id: 'D1', kind: 'GENERATOR_LOSS', timeSec: 0, generatorId: 'G1' },
      { id: 'D2', kind: 'GENERATOR_LOSS', timeSec: 0.5, generatorId: 'G2' },
    ],
  },
);

/**
 * UFR-04 — High inertia.
 * Expected outcome: same 500 MW deficit but larger H_sys → shallower ROCOF and
 * a slower, gentler decay; demonstrates inertia's damping effect.
 */
export const UFR_04_HIGH_INERTIA: UnderfrequencyStudyPreset = preset(
  'UFR-04',
  'High Inertia Island',
  'Same 500 MW loss but boosted inertia constants; slower, shallower decay.',
  {
    description: 'High-inertia variant of UFR-02; same 500 MW loss but a gentler, slower decay.',
    generators: GENS.map((g) => (g.id === 'G4' ? { ...g, inertiaSec: 6.0 } : g)),
    disturbanceSteps: [{ id: 'D1', kind: 'GENERATOR_LOSS', timeSec: 0, generatorId: 'G1' }],
  },
);

/**
 * UFR-05 — Low inertia.
 * Expected outcome: same 500 MW deficit but smaller H_sys → steeper ROCOF and a
 * faster, deeper decay; UFLS responds sooner.
 */
export const UFR_05_LOW_INERTIA: UnderfrequencyStudyPreset = preset(
  'UFR-05',
  'Low Inertia Island',
  'Same 500 MW loss but reduced inertia constants; faster, deeper decay.',
  {
    description: 'Low-inertia variant of UFR-02; same 500 MW loss but a steeper, faster decay.',
    generators: GENS.map((g) => (g.id === 'G4' ? { ...g, inertiaSec: 2.0 } : g)),
    disturbanceSteps: [{ id: 'D1', kind: 'GENERATOR_LOSS', timeSec: 0, generatorId: 'G1' }],
  },
);

/**
 * UFR-06 — Small deficit load step.
 * Expected outcome: small 100 MW load step, mild ROCOF, frequency settles
 * slightly below nominal via droop without necessarily triggering UFLS.
 */
export const UFR_06_SMALL_DEFICIT: UnderfrequencyStudyPreset = preset(
  'UFR-06',
  'Small Deficit (100 MW)',
  'A 100 MW load step; droop alone arrests the decay, likely no UFLS operation.',
  {
    disturbanceSteps: [{ id: 'D1', kind: 'LOAD_STEP', timeSec: 0, mw: 100 }],
  },
);

// ──────────────── Public registry API ───────────────────────────────────────

/**
 * The canonical, immutable registry of underfrequency presets. Order is stable
 * so the UI menu is deterministic; new presets must be appended, not reordered,
 * to preserve preset IDs across versions.
 */
export const UNDERFREQUENCY_STUDY_PRESETS: readonly UnderfrequencyStudyPreset[] = Object.freeze([
  UFR_01_NOMINAL,
  UFR_02_LOSE_LARGE_UNIT,
  UFR_03_LOSE_TWO_UNITS,
  UFR_04_HIGH_INERTIA,
  UFR_05_LOW_INERTIA,
  UFR_06_SMALL_DEFICIT,
]);

export const DEFAULT_UNDERFREQUENCY_PRESET_ID: UnderfrequencyPresetId = 'UFR-01';

export function getUnderfrequencyStudyPreset(id: UnderfrequencyPresetId): UnderfrequencyStudyPreset {
  const found = UNDERFREQUENCY_STUDY_PRESETS.find((entry) => entry.id === id);
  if (!found) throw new Error(`Unknown Underfrequency preset: ${id}`);
  return found;
}

export function listUnderfrequencyStudyPresets(): readonly UnderfrequencyStudyPreset[] {
  return UNDERFREQUENCY_STUDY_PRESETS;
}
