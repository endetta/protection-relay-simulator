/**
 * Underfrequency governor physics (U01 § 7, per underfrequency-relay.md).
 *
 * The per-generator algebraic governor / droop response model. This is the one
 * place the physics lives: the static solver (`underfrequency.ts`) and the
 * time-domain run (`underfrequencyTimeline.ts`) both consume these primitives,
 * so a saturation or clamp defect cannot hide in a re-derived copy.
 *
 * The model (single-area coherent, per-generator droop):
 *
 *   headroom_i     = governorMaxMw_i − initialMw_i
 *   resp_i         = clamp(−Δf/f_nom · MVA_i/R_i, 0, headroom_i)
 *   Δf_i,sat       = −f_nom · headroom_i · R_i / MVA_i   [df at which unit saturates]
 *
 * All functions are non-throwing: bad numeric inputs yield 0 or NaN, never a
 * thrown exception. Everything here is pure and deterministic — no React,
 * no DOM, no SVG.
 */

import type { UnderfrequencyGeneratorData } from '../types/underfrequency';

/** Governance headroom for a unit: `governorMaxMw - initialMw`. */
export function governorHeadroomMw(generator: UnderfrequencyGeneratorData): number {
  return generator.governorMaxMw - generator.initialMw;
}

/**
 * Droop response at frequency deviation `dfHz` (MW), unsaturated then clamped
 * to [0, headroom]. Because dfHz < 0 for underfrequency, the response is ≥ 0.
 * @param fNominalHz — required to scale the per-unit droop (U01 § 7.1).
 */
export function clampGovernorMw(
  generator: UnderfrequencyGeneratorData,
  dfHz: number,
  fNominalHz: number,
): number {
  const headroom = governorHeadroomMw(generator);
  const response = (-dfHz / fNominalHz) * (generator.mva / generator.droopPu);
  return Math.min(headroom, Math.max(0, response));
}

/** Per-unit droop response basis (MW) before clamping, with f_nom applied. */
export function perUnitDroopMw(
  generator: UnderfrequencyGeneratorData,
  dfHz: number,
  fNominalHz: number,
): number {
  if (!Number.isFinite(fNominalHz) || fNominalHz <= 0) return 0;
  return (-dfHz / fNominalHz) * (generator.mva / generator.droopPu);
}

/**
 * Saturation deviation for a unit — the df (Hz) at which it just hits
 * headroom. `Δf_i,sat = -f_nom·headroom_i·R_i / MVA_i`.
 */
export function perUnitSaturationDeviationHz(
  generator: UnderfrequencyGeneratorData,
  fNominalHz: number,
): number {
  const headroom = governorHeadroomMw(generator);
  if (!Number.isFinite(fNominalHz) || fNominalHz <= 0 || generator.mva <= 0 || generator.droopPu <= 0) {
    return Number.NaN;
  }
  return (-fNominalHz * headroom * generator.droopPu) / generator.mva;
}

/**
 * A unit is saturated once the frequency deviation has reached its saturation
 * point. For underfrequency, dfHz < 0 and satDelta < 0, so "beyond" means
 * `dfHz <= satDelta` (more negative than the limit).
 */
export function isGovernorSaturated(
  generator: UnderfrequencyGeneratorData,
  fNominalHz: number,
  dfHz: number,
): boolean {
  return dfHz <= perUnitSaturationDeviationHz(generator, fNominalHz);
}

/**
 * System stiffness of the unsaturated set.
 * `β_pu = Σ_unsaturated (MVA_i/R_i)`.
 */
export function systemStiffnessBetaPu(
  generators: readonly UnderfrequencyGeneratorData[],
  dfHz: number,
  fNominalHz: number,
): number {
  let beta = 0;
  for (const g of generators) {
    const satDelta = perUnitSaturationDeviationHz(g, fNominalHz);
    if (!Number.isFinite(satDelta)) continue;
    // A unit is saturated once df is beyond (more negative than) its sat delta.
    if (dfHz <= satDelta) continue;
    beta += g.mva / g.droopPu;
  }
  return beta;
}
