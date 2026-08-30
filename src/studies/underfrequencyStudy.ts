import type {
  DomainEvaluation,
  DomainIssue,
  UnderfrequencyStudyDefinition,
} from '../types/underfrequency';
import {
  validateUnderfrequencyGenerators,
  validateUnderfrequencySystem,
  validateUnderfrequencyUflsStages,
} from '../engines/underfrequency';

// ────────────────────────────────── Helpers ────────────────────────────────
// U01 study-level validation. Aggregates the per-layer engine validators plus
// the study-level cross-references (id/label/description, disturbance steps)
// that only make sense on a fully-realised study definition. Mirrors the
// overcurrentStudy contract (O05 § 11): it returns a DomainEvaluation and is
// non-throwing so callers can surface issues instead of crashing.

function issue(code: DomainIssue['code'], path: string, detail: string): DomainIssue {
  return { code, path, detail };
}

function finiteNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

// ──────────────────────────── Study validation ─────────────────────────────

export function validateUnderfrequencyStudyDefinition(
  study: UnderfrequencyStudyDefinition,
): DomainEvaluation<UnderfrequencyStudyDefinition> {
  const issues: DomainIssue[] = [];

  if (!study.id.trim()) issues.push(issue('INVALID_TOPOLOGY', 'id', 'ID preset studi wajib diisi.'));
  if (!study.label.trim()) issues.push(issue('INVALID_TOPOLOGY', 'label', 'Label studi wajib diisi.'));
  if (!study.description.trim()) issues.push(issue('INVALID_TOPOLOGY', 'description', 'Deskripsi studi wajib diisi.'));
  if (!study.relay?.modelLabel.trim()) issues.push(issue('INVALID_TOPOLOGY', 'relay.modelLabel', 'Label model relay wajib diisi.'));

  issues.push(...validateUnderfrequencySystem(study.system));
  issues.push(...validateUnderfrequencyGenerators(study.generators));
  issues.push(...validateUnderfrequencyUflsStages(study.uflsStages));

  // Disturbance steps must reference a real generator and carry a valid time.
  const generatorIds = new Set(study.generators.map((g) => g.id));
  for (const step of study.disturbanceSteps) {
    const path = `disturbanceSteps.${step.id}`;
    if (!finiteNonNegative(step.timeSec)) {
      issues.push(issue('NUMERICAL_RANGE', `${path}.timeSec`, 'Waktu disturbance harus finite dan >= 0 s.'));
    }
    if (step.kind !== 'LOAD_STEP') {
      if (!step.generatorId) {
        issues.push(issue('INVALID_TOPOLOGY', `${path}.generatorId`, `${step.kind} memerlukan generatorId.`));
      } else if (!generatorIds.has(step.generatorId)) {
        issues.push(issue('INVALID_TOPOLOGY', `${path}.generatorId`, `Generator ${step.generatorId} tidak dikenal.`));
      }
    } else if (!Number.isFinite(step.mw)) {
      issues.push(issue('NUMERICAL_RANGE', `${path}.mw`, 'LOAD_STEP memerlukan besaran mw yang finite.'));
    }
  }

  return issues.length > 0 ? { status: 'INVALID', issues } : { status: 'VALID', value: study };
}
