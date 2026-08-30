# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Overcurrent Relay Simulator — 50/51 Protection & Coordination Laboratory

**Platform:** Protection System Relay Simulator Platform  
**Module route:** `/simulator/overcurrent`  
**Document status:** AUTHORITATIVE PRODUCT PLAN — O01 APPROVED / O02–O12 IMPLEMENTED  
**Version:** PRD v1.0  
**Date:** 2026-08-13  
**Reference UI:** Differential Relay R10 (FINAL / COMPLETED / FROZEN)  
**Current implementation gate:** O12 ANALYSIS / LEARNING PASSED; next planned phase O13 Coordination Guided Challenges

---

# 1. Executive Summary

Overcurrent Relay Simulator adalah modul pembelajaran dan protection-study interaktif untuk fungsi **phase overcurrent 50/51**. Modul ini tidak boleh berhenti sebagai kalkulator pickup atau time-current curve. Tujuan utamanya adalah membuat user memahami hubungan antara **arus → CT measurement → pickup → current multiple → characteristic → operating time → timer → trip → breaker clearing**, lalu mengembangkan pemahaman tersebut menjadi **relay coordination** antara relay downstream dan upstream.

Pengalaman produk dibangun dalam tiga lapisan belajar:

1. **EXPLORE** — memahami satu relay 50/51 dan dampak setting terhadap TCC.
2. **COORDINATE** — mengatur beberapa relay pada radial system agar primary/backup sequence benar.
3. **VALIDATE** — menguji setting terhadap seluruh study case, bukan hanya satu titik fault.

Signature experience modul ini adalah kombinasi:

- clickable radial SLD;
- Time-Current Characteristic (TCC) interaktif;
- primary/backup operating points;
- coordination margin / CTI visualization;
- coordination corridor dan violation envelope;
- fault-location study;
- trip race / operating sequence;
- initial-vs-current setting comparison;
- guided hints tanpa memberikan jawaban setting secara langsung;
- automatic coordination audit untuk seluruh configured study cases.

Overcurrent Simulator harus terasa berasal dari produk yang sama dengan Differential Relay R10. **Bahasa desain, typography, color semantics, interaction grammar, collapse system, tooltip, numeric control, scrollbar, navigation shell, accessibility behavior, dan visual hierarchy harus konsisten dengan Differential R10.** Layout boleh berbeda sesuai kebutuhan overcurrent, tetapi design language tidak boleh berubah.

---

# 2. Product Vision

Membangun mini **Protection Coordination Laboratory** yang membuat user bukan hanya mengetahui hasil perhitungan relay, tetapi memahami cara protection engineer berpikir:

> Relay mana yang seharusnya menjadi primary?  
> Relay mana yang menjadi backup?  
> Mengapa relay backup harus lebih lambat?  
> Apakah pickup terlalu rendah untuk load?  
> Apakah pickup terlalu tinggi untuk minimum fault?  
> Apakah instantaneous element overreach?  
> Apakah setting yang terlihat benar pada satu fault tetap benar pada seluruh study range?

Simulator harus membuat hubungan sebab-akibat terasa langsung melalui perubahan visual, bukan mengandalkan paragraf teori panjang.

---

# 3. Product Problem

Banyak pembelajaran overcurrent relay berhenti pada salah satu dari tiga bentuk berikut:

- menghitung pickup secara manual;
- memasukkan current multiple ke persamaan curve;
- melihat beberapa TCC tanpa memahami urutan operasi sistem.

Masalah pembelajaran yang ingin diselesaikan:

1. User sering menyamakan **pickup** dengan **trip**.
2. User sulit memahami mengapa inverse-time relay menjadi lebih cepat ketika current multiple meningkat.
3. User melihat TMS / Time Dial sebagai angka abstrak, bukan sebagai penggeser waktu karakteristik.
4. User memahami satu relay tetapi kesulitan memahami hubungan primary–backup.
5. User dapat membuat satu fault case PASS tetapi tidak menyadari setting tersebut gagal pada current range lain.
6. User sulit memahami trade-off antara **sensitivity**, **selectivity**, dan **speed**.
7. CT ratio/error sering dianggap terpisah dari relay setting padahal memengaruhi relay current dan operating time.
8. Instantaneous 50 sering dipahami sebagai sekadar “trip cepat”, bukan elemen yang juga harus dikoordinasikan.

Overcurrent Simulator harus menjawab seluruh masalah di atas melalui interaction dan visualization.

---

# 4. Primary Users

Target pengguna:

- mahasiswa Teknik Elektro / Sistem Tenaga;
- peserta praktikum proteksi sistem tenaga;
- dosen dan instruktur;
- teknisi proteksi;
- protection engineer junior;
- engineer yang ingin melakukan quick conceptual study tanpa membuka software protection-study yang kompleks.

Simulator bukan pengganti studi relay vendor atau short-circuit coordination software produksi.

---

# 5. Learning Outcomes

Setelah menggunakan modul, user harus mampu menjelaskan:

1. perbedaan elemen 50 dan 51;
2. perbedaan pickup, timing, trip output, dan breaker clearing;
3. hubungan `Irelay / Ipickup` terhadap operating time;
4. pengaruh pickup terhadap sensitivity dan current multiple;
5. pengaruh TMS / Time Dial terhadap waktu operasi;
6. perbedaan Definite Time dan Inverse Time;
7. perbedaan karakter umum curve families yang didukung;
8. hubungan CT ratio/error terhadap current yang dilihat relay;
9. konsep primary dan backup relay;
10. konsep coordination time interval (CTI);
11. mengapa setting harus diuji pada lebih dari satu fault current;
12. mengapa instantaneous element dapat merusak selectivity jika salah setting;
13. mengapa fault clearing memerlukan relay operation + breaker clearing sequence;
14. cara mengevaluasi sensitivity, selectivity, speed, dan grading secara bersama-sama;
15. cara memperbaiki coordination problem dengan mengubah parameter yang tepat.

---

# 6. Standards & Engineering Reference Direction

Engineering Specification harus menggunakan referensi primer yang relevan, minimal:

- **IEC 60255-151** — functional requirements, measurement, dan time-delay characteristics untuk over/under-current protection;
- **IEEE C37.112-2018** — inverse-time characteristic equations untuk overcurrent relays, termasuk pendekatan untuk current yang berubah terhadap waktu;
- application guidance resmi protection-relay manufacturer untuk coordination concepts dan CTI interpretation bila diperlukan.

PRD tidak boleh hard-code equation constants. Seluruh konstanta curve, equality boundary, reset treatment, dan timing integration harus dikunci di dokumen **Overcurrent Relay Engineering Specification** sebelum coding engine.

---

# 7. Product Principles

## 7.1 Engineering first

Visual boleh disederhanakan. Persamaan relay tidak boleh diubah demi membuat graph terlihat lebih menarik.

## 7.2 Explanation through behavior

User memahami konsep dengan melihat consequence dari setting, bukan dengan membaca tutorial panjang.

## 7.3 One source of truth

Relay calculation, coordination calculation, timeline, dan graph harus berasal dari state/engine yang sama. Jangan menghitung formula ulang di component UI.

## 7.4 Progressive complexity

Single Relay Study harus mudah dipahami. Coordination Lab boleh lebih kaya tanpa membuat beginner menghadapi seluruh parameter sekaligus.

## 7.5 No magic optimization

Simulator tidak boleh langsung memberikan setting “optimal” atau angka jawaban. Hints menjelaskan lokasi, jenis masalah, dan arah perubahan; user tetap melakukan tuning.

## 7.6 No fake network solver

Jika fault current berasal dari preset, UI harus menyatakan itu sebagai study data. Jangan berpura-pura menghitung short-circuit network apabila engine tidak memiliki network model.

## 7.7 Same product language

Overcurrent harus menggunakan exact visual grammar Differential R10, bukan membuat design system kedua.

---

# 8. Core Experience Model

Overcurrent Simulator memiliki tiga tahap pengalaman:

```text
EXPLORE
  ↓
COORDINATE
  ↓
VALIDATE
```

### EXPLORE
User mengubah parameter dan melihat calculation/TCC berubah secara realtime tanpa menjalankan timer dunia nyata.

### COORDINATE
User memilih system topology/fault location lalu melakukan tuning beberapa relay berdasarkan primary–backup relationship.

### VALIDATE
User menjalankan satu fault secara time-domain atau menjalankan seluruh coordination study cases untuk mencari violation/worst case.

Ketiga tahap adalah bagian dari simulator yang sama, bukan route terpisah.

---

# 9. Product Modes

## 9.1 Single Relay Study

Tujuan:

- memahami 50/51;
- memahami CT measurement;
- memahami pickup/current multiple;
- memahami definite/inverse characteristic;
- memahami time-domain pickup → trip sequence.

Visual utama:

- simple feeder SLD;
- one-relay TCC;
- operating sequence.

## 9.2 Coordination Lab

Tujuan:

- mengatur 2–3 relay;
- memahami primary/backup;
- melihat multi-relay TCC;
- memeriksa CTI;
- memperbaiki miscoordination;
- menguji min/max fault study cases.

## 9.3 Guided Study

Memiliki objective, initial miscoordination, progressive hints, dan validation criteria.

## 9.4 Free Study

Tidak ada challenge objective. User bebas mengubah parameter dan menggunakan seluruh analysis tools.

Mode belajar (`guided | free`) adalah metadata study, bukan engine terpisah.

---

# 10. Core Scope — Locked for Architecture

Fitur berikut dianggap core dan architecture harus mendukungnya sejak awal.

## Relay fundamentals

- Phase Overcurrent 51;
- Instantaneous Overcurrent 50;
- inverse-time curve;
- definite-time curve;
- IEC curve family;
- IEEE curve family;
- pickup current;
- TMS / Time Dial;
- high-set `I>>`;
- CT ratio/error measurement chain.

## Coordination

- 2-relay radial coordination;
- 3-relay radial coordination;
- primary/backup identification;
- CTI / grading margin;
- coordination target/budget;
- coordination corridor;
- coordination violation detection;
- worst-case coordination search;
- multi-case coordination test.

## Protection study

- max-load reference;
- minimum-fault reference;
- maximum-fault reference;
- fault location/study point;
- fault-current range;
- sensitivity check;
- selectivity check;
- instantaneous reach check;
- load security check.

## Time-domain behavior

- fault apply;
- pickup;
- timer running;
- relay trip output;
- breaker clearing delay;
- breaker open;
- fault isolated;
- backup timer reset/stop;
- clear fault;
- simulation speed.

## Learning system

- intentionally miscoordinated presets;
- progressive hints;
- initial/current comparison;
- ghost curves;
- parameter impact inspector;
- coordination audit;
- final “why this works” explanation.

## Visualization architecture

- clickable SLD;
- TCC layer system;
- operating points;
- fault current line;
- coordination bracket;
- coordination envelope/corridor;
- load/fault reference regions;
- trip sequence.

---

# 11. Scope Classification

## 11.1 Visible in first Overcurrent release

- Single Relay Study;
- Coordination Lab 2-relay and 3-relay radial;
- 50/51;
- IEC/IEEE supported core curves;
- Definite Time;
- CT model;
- TCC;
- SLD;
- fault study points;
- CTI margin;
- coordination corridor/envelope;
- trip sequence;
- run-all-cases validation;
- hints;
- initial/current compare.

## 11.2 Architecture-ready, UI may be deferred

Architecture harus mampu menerima tanpa rewrite:

- time-varying current profile;
- fuse/recloser/equipment TCC layers;
- motor-starting curve;
- cable/transformer damage curve;
- additional overcurrent channels;
- more than 3 relay devices;
- ground overcurrent element in future;
- additional topology presets.

## 11.3 Explicitly not part of current core release

- Directional Overcurrent 67;
- zero/negative-sequence directional polarization;
- full short-circuit network solver;
- ring/meshed network coordination;
- CT saturation model;
- communication-assisted protection;
- adaptive protection;
- breaker mechanical/transient model;
- auto-optimization that directly computes “best setting”;
- vendor-specific relay emulation;
- waveform/phasor transient protection.

---

# 12. Supported 51 Timing Families

Initial user-visible set:

### Definite Time

- fixed delay after pickup.

### IEC family

- Standard Inverse;
- Very Inverse;
- Extremely Inverse.

### IEEE / US family

- Moderately Inverse;
- Very Inverse;
- Extremely Inverse.

The exact equations/constants are Engineering-Spec controlled.

Long-time/short-time variants may be added later through the curve registry without changing TCC architecture.

---

# 13. Core Relay Calculation Concepts

For every relay device:

```text
Primary Current
    ↓
CT Measurement
    ↓
Relay Current
    ↓
Pickup Check
    ↓
Current Multiple M = Irelay / Ipickup
    ↓
51 Characteristic
    ↓
Calculated Operating Time
    ↓
50/51 Element Arbitration
    ↓
Relay Operating Result
```

The actual formula and equality conditions must be specified separately.

---

# 14. Measurement Chain

Every relay may have its own CT configuration.

Required parameters:

- CT primary rated current;
- CT secondary rated current;
- ratio error percentage.

Potential derived values:

- CT ratio;
- ideal secondary current;
- measured relay current;
- measurement error contribution.

UI pattern must reuse Differential CT language:

```text
CT1 / R1
PRIM. RATED
SEC. RATED
RATIO ERROR
```

No CT saturation in V1.

---

# 15. Study Topology Model

Topology must be data-driven, not hard-coded as `R1`, `R2`, `R3` component logic.

Initial topology presets:

## A. Single Relay Feeder

```text
SOURCE ── CB1 ── CT1 ───────── LOAD
                │
               R1 50/51
```

## B. Two-Relay Radial

```text
SOURCE ── R1/CB1 ───────── R2/CB2 ───── LOAD
              │                 │
             F1                F2
```

## C. Three-Relay Radial

```text
SOURCE ── R1/CB1 ─── R2/CB2 ─── R3/CB3 ─── LOAD
              │          │          │
             F1         F2         F3
```

Future topology may contain branches, but initial engine assumptions remain radial and non-directional.

---

# 16. Primary / Backup Relationship

Coordination engine derives ordering from topology/study metadata.

Example for F3:

```text
R3 = PRIMARY
R2 = BACKUP 1
R1 = BACKUP 2
```

For F2:

```text
R2 = PRIMARY
R1 = BACKUP
```

For F1:

```text
R1 = PRIMARY
```

Primary/backup must not be inferred from relay names alone.

---

# 17. Fault Study Model

Fault study is not a network short-circuit solver.

Each topology/scenario provides configured study data such as:

- fault location;
- minimum fault current;
- maximum fault current;
- default active current;
- current seen by each relay if necessary;
- primary/backup chain.

Study data may be represented as discrete points or an interpolatable profile.

The UI must never imply that fault current was calculated from network impedance unless such an engine exists in a future release.

---

# 18. Fault Location Interaction

User can:

- click F1/F2/F3;
- select active study current (MIN / NOMINAL / MAX where applicable);
- in supported preset, drag a **fault-location scrubber** along feeder.

When fault location changes:

- fault study data updates;
- relay current(s) update;
- operating points move;
- primary/backup chain updates if needed;
- CTI updates;
- coordination status updates;
- worst-case indicator may change.

Fault-location scrubber uses preset profile/interpolation, not hidden short-circuit calculation.

---

# 19. Sensitivity / Selectivity / Speed Framework

Coordination Lab analysis is organized around three learning dimensions:

## Sensitivity

Can the intended primary relay reliably pick up minimum fault?

## Selectivity

Does the correct downstream relay operate before upstream backup?

## Speed

Does protection operate fast enough within the configured study constraints?

Additional audit categories:

- Load Security;
- Time Grading;
- Instantaneous Reach.

These concepts become structured checks, not a gamified numeric score.

---

# 20. Pickup / Load / Minimum Fault Window

TCC should visualize reference regions where relevant:

```text
CURRENT →

LOAD REGION               FAULT REGION
████████████               █████████████████

       Max Load
          │
          └──── SAFE PICKUP WINDOW ────┐
                                       │
                                  Min Fault
```

Coordination engine can flag:

- `LOAD ENCROACHMENT` — pickup too close/inside configured load criterion;
- `SENSITIVITY RISK` — pickup above configured minimum-fault requirement;
- `PICKUP WINDOW SATISFIED` — configured criteria pass.

Exact margins are study inputs/spec parameters, not universal constants.

---

# 21. CTI / Coordination Time Interval

For every primary-backup pair at a study current, coordination engine calculates:

```text
CTI = t_backup - t_primary
```

Pass/fail comparison is against configured target.

The target shall be configurable by study/preset.

The PRD must not assume one universal CTI value.

---

# 22. CTI Budget

Study configuration may represent target CTI as a budget:

```text
Breaker clearing allowance
Relay/timing allowance
Study safety allowance
─────────────────────────
Required coordination margin
```

Example UI concept:

```text
COORDINATION TARGET

Breaker allowance      0.xx s
Timing allowance       0.xx s
Study margin           0.xx s
────────────────────────────
Required CTI           0.xx s
```

Values are configured study data.

The benefit is educational: target CTI is no longer perceived as a magic number.

---

# 23. Coordination Bracket

At active fault current, TCC shows operating points for relevant relays.

Example:

```text
R1 ● 1.10 s
    │
    │ Δt = +0.38 s  PASS
    │
R2 ● 0.72 s
    │
    │ Δt = +0.38 s  PASS
    │
R3 ● 0.34 s
```

If miscoordinated:

```text
R2 ● 0.48 s
    │
    │ Δt = -0.14 s  FAIL
    │
R3 ● 0.62 s
```

Bracket must use semantic color only for result status; relay identity should not rely exclusively on green/red.

---

# 24. Coordination Corridor

For primary curve + target CTI, simulator can derive a minimum acceptable backup timing boundary.

Concept:

```text
time ↑

       Backup curve
          /
════════════════════════  minimum acceptable backup boundary
  ACCEPTABLE BACKUP
  REGION

      /
     / Primary curve
────────────────────── current →
```

Purpose:

- make grading visually intuitive;
- show that backup curve must remain sufficiently above primary across relevant current range;
- support proactive tuning before individual violation labels are read.

---

# 25. Coordination Envelope / Worst-Case Search

Coordination must not be evaluated only at one fault current.

Coordination engine scans configured fault-current range or discrete study points and determines:

- CTI at each point;
- PASS/FAIL region;
- minimum CTI;
- current where minimum CTI occurs;
- instantaneous overreach region;
- pickup/sensitivity violation region where relevant.

Analysis example:

```text
WORST COORDINATION POINT

Fault current      4.73 kA
Primary            R3
Backup             R2
Observed CTI       0.17 s
Required CTI       0.30 s
Deficit           -0.13 s
```

TCC may show a subtle violation band, not a loud full-background fill.

---

# 26. Instantaneous 50 Coordination

Every relay can expose:

- 50 Enable / Disable;
- high-set pickup `I>>`.

TCC represents 50 as high-set vertical boundary / instantaneous region.

Coordination engine checks whether an upstream backup instantaneous element operates for downstream study faults.

Example result:

```text
INSTANTANEOUS OVERREACH

R2 50 operates for downstream F3.
Selective sequence failed.
```

51 timing may still be calculated as reference, but active element becomes 50 when its operating condition is met.

---

# 27. Time-Domain Simulation

Overcurrent is inherently temporal. The simulator must have a real time-domain experiment layer separate from static calculation.

Core sequence:

```text
NORMAL
  ↓
FAULT APPLIED
  ↓
PICKUP
  ↓
TIMING
  ↓
TRIP OUTPUT
  ↓
BREAKER CLEARING
  ↓
BREAKER OPEN
  ↓
FAULT ISOLATED
  ↓
BACKUP TIMER RESET / STOP
```

50 may bypass the 51 timed operation according to Engineering Specification.

---

# 28. Trip Race / Operating Sequence

For a downstream fault, all relays that pick up can be visualized timing concurrently.

Example:

```text
R3 PRIMARY
██████████████░░  0.27 / 0.34 s

R2 BACKUP
███████░░░░░░░░░  0.27 / 0.71 s

R1 BACKUP
████░░░░░░░░░░░░  0.27 / 1.10 s
```

When R3 trips:

```text
R3 TRIP OUTPUT
      ↓
CB3 CLEARING
      ↓
CB3 OPEN
      ↓
FAULT ISOLATED
      ↓
R2 / R1 STOP OR RESET
```

This visual is named **OPERATING SEQUENCE**, not a game/race in production UI terminology.

---

# 29. Breaker Clearing Model

V1 does not model breaker mechanics.

Study provides a simplified fixed breaker clearing time.

Timeline distinguishes:

- relay trip output time;
- breaker clearing interval;
- final fault-cleared time.

This is necessary to teach that relay operation and current interruption are different events.

---

# 30. Current Profile Architecture

Although first-release experiments may use a constant pre-fault current followed by constant fault current, timeline architecture must support a generic `I(t)` source.

This prevents future rewrite for:

- temporary overload;
- motor starting;
- stepped fault magnitude;
- intermittent fault;
- varying-current inverse-time accumulation.

Initial release does not need to expose arbitrary waveform editing.

The time-domain interface should be capable of accepting piecewise current segments or samples in future.

---

# 31. Explore Mode vs Run Experiment

## Explore

User changes parameters freely.

- calculations update immediately;
- graph updates immediately;
- operating time displayed;
- no real timer runs;
- settings remain editable.

## Run Experiment

User clicks Apply Fault / Run.

- critical settings lock for deterministic experiment;
- relay timers advance;
- breaker state changes;
- sequence events are recorded;
- user can Clear Fault / Reset.

This separation avoids ambiguous mid-run setting changes.

---

# 32. Simulation Speed

Control:

```text
1× | 5× | 10×
```

Simulation speed changes only visual/runtime playback speed.

Engineering elapsed time and calculated operating time remain real protection-study time.

Example:

- engineering operate time = 8.00 s;
- playback = 10×;
- wall-clock wait ≈ 0.8 s;
- UI still reports 8.00 s engineering time.

---

# 33. TCC as Primary Visual

The largest visualization in Live Simulation must be **Time-Current Characteristic**.

Recommended axes:

- X: current multiple or current, according to selected graph domain;
- Y: operating time in seconds.

Default coordination view should strongly favor an engineering log/log or appropriate TCC representation.

Axis labels must explicitly show unit/domain.

The TCC is not decorative. It is the primary mechanism for understanding relay behavior.

---

# 34. TCC Layer Architecture

TCC must render generic layers, not hard-code R1/R2/R3.

Initial layer types:

```text
relay-curve
instantaneous-boundary
fault-current-line
operating-point
pickup-boundary
load-region
minimum-fault-reference
maximum-fault-reference
coordination-corridor
coordination-violation-envelope
initial-setting-ghost
study-marker
```

Future layer types may include:

```text
fuse-curve
recloser-curve
motor-start-curve
equipment-damage-curve
cable-withstand-curve
```

Layer architecture is a core implementation requirement even if future layers are not visible in V1.

---

# 35. TCC Scaling Behavior

Lessons from Differential R10 are mandatory:

- characteristic readability has priority;
- graph must not jump aggressively near pickup;
- extreme operating points can be marked OFF-SCALE;
- user can switch to `FIT POINT` view;
- `FIT POINT / CHARACTERISTIC` must be overlay utility control and never consume graph layout height;
- tooltip must remain viewport-safe;
- axis scaling must be deterministic and numerically stable.

Near `M → 1+`, inverse time can become very large. Graph should not destroy the useful curve view just to include an extreme point.

---

# 36. TCC Curve Interaction

Hover/focus a relay curve:

```text
R2 · IEC VERY INVERSE

PICKUP
1.20 A sec

TMS
0.22

AT CURRENT
4.20 × Pickup

OPERATE TIME
0.71 s
```

Operating-point tooltip:

```text
R2 OPERATING POINT        BACKUP

RELAY CURRENT
5.04 A sec

CURRENT MULTIPLE
4.20×

OPERATING TIME
0.71 s

CTI TO PRIMARY
+0.09 s
```

Tooltip architecture must reuse Differential compact industrial inspector pattern.

Desktop:

- pointer-follow.

Touch:

- tap to pin;
- tap outside to dismiss.

---

# 37. Ghost Curve / Before-After Comparison

When user changes a relay setting during a guided study, initial curve can remain as subtle dashed reference.

```text
------ INITIAL
────── CURRENT
```

Comparison metrics:

```text
INITIAL vs CURRENT

Violations       4 → 0
Worst CTI       -0.14 → +0.32 s
Cases passed     2/6 → 6/6
```

The user can toggle `COMPARE INITIAL`.

No visual confetti or game score.

---

# 38. Parameter Impact Inspector

After a setting change, Analysis may briefly show consequence chain.

Example — TMS:

```text
SETTING IMPACT

R2 TMS
0.18 → 0.22

AFFECTS
R2 operating time ↑
F3 backup margin ↑
F2 primary operating time ↑

UNCHANGED
Pickup threshold
Measured current
R1/R3 settings
```

Example — Pickup:

```text
PICKUP R3
0.80 → 1.10 A

AFFECTS
Pickup boundary →
Current multiple ↓
Operating time changes
Sensitivity margin changes
```

This feature teaches cause/effect without a tutorial overlay.

---

# 39. SLD Requirements

SLD is supporting visual above TCC.

It must show:

- source;
- feeder/bus segments;
- circuit breaker state;
- CT location;
- relay identity;
- load;
- fault location;
- current-flow path;
- primary/backup relation when a fault is active.

Visual style:

- line-based engineering diagram;
- no photorealism;
- no decorative electrical glow;
- semantic color only for state.

Click targets:

- relay/device;
- breaker if informative;
- fault location/study point.

---

# 40. SLD Interaction

User can:

- click relay → focus/select relay settings;
- click fault location → activate study point;
- click/drag fault scrubber where supported;
- inspect fault data;
- inspect primary/backup chain;
- visually observe breaker opening after trip.

SLD selection should highlight corresponding TCC curve and Analysis entries.

TCC curve selection should likewise identify corresponding relay on SLD.

Bidirectional cross-highlighting is required.

---

# 41. Main Layout

Overcurrent uses the same application grammar as Differential:

```text
┌───────────────────────────────────────────────────────────────┐
│ PROTECTION SYSTEM SIMULATOR     OVERCURRENT RELAY / 50–51    │
├────────────────┬────────────────────────────┬─────────────────┤
│ PARAMETERS     │ LIVE SIMULATION            │ ANALYSIS        │
│                │                            │                 │
│ Study          │ SLD                        │ Status          │
│ System/Fault   │                            │ Active Fault    │
│ CT             ├────────────────────────────┤ Operating Order │
│ Relay Settings │ TCC — PRIMARY VISUAL       │ CTI / Margin    │
│ Coordination   │                            │ Violations      │
│ Run Controls   ├────────────────────────────┤ Hints           │
│                │ Operating Sequence         │ Details/Events  │
└────────────────┴────────────────────────────┴─────────────────┘
```

Exact widths may be tuned for Overcurrent content, but the visual language and three-zone mental model remain consistent with Differential R10.

---

# 42. Header & Navigation

Header must reuse platform navigation shell.

Left home control:

`PROTECTION SYSTEM SIMULATOR`

Click returns to Homepage.

Simulator identity:

`OVERCURRENT RELAY / 50–51`

Right utilities:

- Reset;
- Help.

No separate marketing header.

---

# 43. UI Design Language — Hard Constraint

The following must reuse Differential R10 directly or through shared components:

- graphite/navy surfaces;
- steel-cyan interaction accent;
- green healthy/pass semantics;
- amber pickup/timing/warning semantics;
- red trip/fault/fail semantics;
- Inter/system sans UI typography;
- IBM Plex Mono / engineering mono for values;
- section header geometry;
- collapsed summary grammar;
- right-aligned badges;
- fixed header utility slot behavior;
- custom number stepper;
- press-and-hold number stepping;
- 2 px square overlay scroll indicator;
- InfoDot tooltip language;
- curve tooltip language;
- collapse/expand behavior;
- focus style;
- accessibility semantics;
- reduced-motion handling.

New UI style is prohibited unless an Overcurrent-specific engineering visualization requires it.

---

# 44. Parameter Panel — Single Relay Study

Suggested sections:

## SCENARIO / STUDY

- mode;
- scenario preset;
- Guided / Free Study.

## SYSTEM / CURRENT

- Pre-Fault Current;
- Fault Current;
- optional min/max study current.

## CT / INSTRUMENT

- Prim. Rated;
- Sec. Rated;
- Ratio Error.

## 51 TIME OVERCURRENT

- Pickup `I>`;
- Timing Mode: Inverse / Definite;
- Standard: IEC / IEEE;
- Curve family;
- TMS / Time Dial;
- Definite Time Delay when applicable.

## 50 INSTANTANEOUS

- Enable/Disable;
- Pickup `I>>`.

## SIMULATION

- Simulation Speed;
- Apply Fault;
- Clear Fault.

---

# 45. Parameter Panel — Coordination Lab

Suggested sections:

## SCENARIO / STUDY

- topology preset;
- Guided / Free;
- active fault case.

## SYSTEM / FAULT LEVELS

- Max Load;
- Min Fault;
- Max Fault;
- active study current/profile.

## R1 · UPSTREAM

- CT settings;
- Pickup `I>`;
- timing mode;
- standard;
- curve;
- TMS/Time Dial;
- 50 enable;
- I>>.

## R2 · MIDDLE

same data structure.

## R3 · DOWNSTREAM

same data structure.

## COORDINATION TARGET

- CTI target or budget;
- breaker clearing allowance;
- study margin if exposed;
- sensitivity/load criteria.

## SIMULATION / VALIDATION

- Speed;
- Apply Fault;
- Clear Fault;
- Run Coordination Test.

Relay settings must be generated from device registry; do not build three different form implementations.

---

# 46. Parameter-to-Effect Mapping

| User parameter | Primary engine effect | Visible consequence |
|---|---|---|
| Fault Current | Relay current | operating point moves, trip time changes |
| CT Prim/Sec | Measurement scaling | relay current/current multiple changes |
| CT Error | Measurement scaling error | TCC operating point/time changes |
| Pickup I> | Pickup threshold + current multiple | pickup boundary moves, M changes, sensitivity changes |
| TMS / Time Dial | 51 operating time | whole relevant time curve shifts vertically |
| Curve Family | 51 shape | characteristic geometry/time changes |
| Definite Delay | fixed timing | horizontal time behavior after pickup |
| 50 Enable | active-element arbitration | high-set region appears/disappears |
| I>> | instantaneous boundary | vertical high-set boundary moves |
| CTI Target | pass/fail requirement | corridor/margin status changes |
| Breaker Clearing | study time budget/timeline | clearing sequence and coordination requirement update |
| Fault Location | study dataset selection | currents/primary-backup/order update |
| Simulation Speed | playback only | wall-clock playback changes, engineering time unchanged |

---

# 47. Collapsed Section Summary

Collapsed state is a monitoring snapshot, not debug text.

Example relay summary:

```text
R2 · MIDDLE                          IEC VI ›
────────────────────────────────────────────
PICKUP          TMS          50
1.20 A          0.22         OFF
```

Example system summary:

```text
SYSTEM / FAULT                        STUDY ›
────────────────────────────────────────────
LOAD          MIN FAULT      MAX FAULT
420 A         2.8 kA         5.1 kA
```

Badges remain in stable right slot. Collapse must not unmount invalid field drafts.

---

# 48. Analysis Hierarchy

Default Analysis reading order:

1. **RELAY / COORDINATION STATUS**
2. **ACTIVE STUDY / FAULT**
3. **OPERATING ORDER**
4. **RELAY CURRENT / CURRENT MULTIPLE**
5. **COORDINATION MARGINS**
6. **SENSITIVITY / SELECTIVITY CHECKS**
7. **VIOLATIONS / WORST CASE**
8. **SETTING IMPACT**
9. **HINTS**
10. **CALCULATION DETAILS** — collapsed by default
11. **EVENTS** — collapsed by default

Single Relay Study can simplify this hierarchy.

---

# 49. Relay Status Vocabulary

Use precise states:

- NORMAL;
- PICKUP;
- 51 TIMING;
- 50 INSTANTANEOUS TRIP;
- 51 TRIP;
- BREAKER CLEARING;
- FAULT ISOLATED;
- INPUT INVALID / OUTPUT HELD.

Avoid generic labels when a more precise protection state is available.

---

# 50. Coordination Status Vocabulary

- COORDINATED;
- COORDINATION INCOMPLETE;
- TIME GRADING FAIL;
- SENSITIVITY RISK;
- LOAD SECURITY FAIL;
- INSTANTANEOUS OVERREACH;
- STUDY INVALID;
- NOT APPLICABLE.

Do not use arbitrary score percentages.

---

# 51. Guided Hint System

Hints are progressive:

## Hint 1 — Location

`Check coordination between R3 and R2 at F3.`

## Hint 2 — Parameter Family

`The issue is primarily related to time grading.`

## Hint 3 — Direction

`R2 should operate later relative to R3.`

No default hint provides an exact setting value.

Hints are generated from violation type, not hard-coded paragraph per screen where possible.

---

# 52. Study Objective

Guided study may display:

```text
STUDY OBJECTIVE

Coordinate R1, R2, and R3
for all configured study cases.

Sensitivity       —
Selectivity       —
Time grading      —
50 reach          —
```

After completion:

```text
COORDINATION VERIFIED

6 / 6 STUDY CASES PASSED

Sensitivity       PASS
Selectivity       PASS
Time grading      PASS
50 reach          PASS
```

No confetti, badge collection, stars, or game score.

---

# 53. Scenario / Challenge Presets

Recommended educational progression:

## OVC-01 — Normal Load

Current below pickup. Learn no pickup.

## OVC-02 — Near Pickup

Current slightly above pickup. Demonstrates long inverse operating time.

## OVC-03 — Moderate Overcurrent

Clear 51 timing behavior.

## OVC-04 — High Fault Current

Inverse operating time becomes shorter.

## OVC-05 — Instantaneous Fault

50 high-set operates.

## OVC-06 — Definite Time

Shows fixed delay independent of current magnitude above pickup.

## OVC-07 — Fault Clears Before Trip

Relay picks up/times but never trips because fault clears first.

## OVC-08 — CT Measurement Error

Shows measurement-chain consequence.

## COORD-01 — Two Relay Time Grading

Initial setting intentionally miscoordinated; user solves time grading.

## COORD-02 — Three Relay Radial

R3 → R2 → R1 coordination.

## COORD-03 — Pickup + Time

Adds max-load/min-fault sensitivity constraint.

## COORD-04 — Curve Selection

Requires selecting appropriate characteristic family as part of study.

## COORD-05 — Instantaneous Coordination

Introduces 50 overreach problem.

## COORD-06 — Full Coordination Study

Three relays + min/max cases + 50/51 + all-cases validation.

---

# 54. Run Coordination Test

`RUN COORDINATION TEST` performs deterministic non-realtime audit across configured study cases.

Example cases:

```text
F1 MIN
F1 MAX
F2 MIN
F2 MAX
F3 MIN
F3 MAX
```

Output:

```text
F1 MIN    PASS
F1 MAX    PASS
F2 MIN    PASS
F2 MAX    PASS
F3 MIN    PASS
F3 MAX    FAIL

5 / 6 STUDY CASES COORDINATED
```

Then identify worst violation.

This action is different from `APPLY FAULT`, which performs one time-domain experiment.

---

# 55. Coordination Audit Dimensions

Run-all-cases validation reports dimensions, not score:

```text
SENSITIVITY            PASS
SELECTIVITY            PASS
TIME GRADING           FAIL
INSTANTANEOUS REACH    PASS
LOAD SECURITY          PASS
```

Overall:

`COORDINATION INCOMPLETE — 1 VIOLATION`

---

# 56. “Why This Works” Completion Layer

After successful guided study, user can open:

**WHY THIS WORKS**

Short explanations, for example:

- R3 is fastest for downstream F3.
- R2 remains delayed backup for F3 while acting primary for F2.
- R1 is the slowest upstream backup.
- Pickup settings remain outside the configured maximum-load region.
- Minimum configured fault remains detectable.

No long educational article.

---

# 57. State Architecture

Recommended top-level simulator state:

```text
studyMode
studyPreset
studyTopology
selectedDeviceId
activeFaultCase
faultPlaybackState
simulationSpeed
relaySettingsByDevice
ctSettingsByDevice
coordinationRequirements
initialSnapshot
comparisonSnapshot
validationState
uiSectionState
```

Calculation results are derived through engines, not stored redundantly unless required for playback history.

---

# 58. Domain Data Model

Architecture should know generic concepts:

```text
ProtectionDevice
OvercurrentElement
CTConfiguration
StudyTopology
StudyLocation
FaultCase
CurrentProfile
CoordinationPair
CoordinationRequirement
OperatingResult
CoordinationViolation
TCCLayer
StudySnapshot
TimelineEvent
```

Do not define only `R1Settings`, `R2Settings`, `R3Settings` as separate data types.

---

# 59. Engine Architecture

Recommended domain stack:

```text
OVERCURRENT ELEMENT ENGINE
        │
        │ 50 / 51 calculations
        ▼
MEASUREMENT ENGINE
        │
        │ CT scaling/error
        ▼
STUDY ENGINE
        │
        │ topology, fault case, load/fault ranges
        ▼
COORDINATION ENGINE
        │
        │ primary/backup, CTI, envelope, violations
        ▼
TIMELINE ENGINE
        │
        │ pickup, timing, trip, breaker, reset
        ▼
PRESENTATION MODEL
        │
        │ SLD, TCC layers, Analysis
```

Calculation components must remain UI-independent and unit-testable.

---

# 60. Recommended Source Structure

```text
src/
  engines/
    overcurrent.ts
    overcurrent.test.ts
    overcurrentMeasurement.ts
    overcurrentMeasurement.test.ts
    overcurrentCoordination.ts
    overcurrentCoordination.test.ts
    overcurrentTimeline.ts
    overcurrentTimeline.test.ts

  utils/
    evaluateOvercurrentSimulation.ts
    overcurrentPresets.ts
    overcurrentStudy.ts
    overcurrentState.ts

  types/
    overcurrent.ts

  components/
    overcurrent/
      TimeCurrentCurve.tsx
      RadialProtectionDiagram.tsx
      OperatingSequence.tsx
      CoordinationInspector.tsx
      CoordinationStudySummary.tsx

  pages/
    OvercurrentSimulator.tsx
```

Shared R10 components remain under `components/shared` / platform layouts.

Exact file split can evolve after codebase review, but separation of concerns is mandatory.

---

# 61. Overcurrent Element Engine Responsibilities

Pure functions only.

Responsibilities:

- validate relay setting;
- calculate pickup state;
- calculate current multiple;
- calculate definite-time operation;
- calculate supported inverse-time operation;
- evaluate 50 element;
- arbitrate active 50/51 element;
- expose finite/non-throwing result.

No React, DOM, timers, animations, or graph code.

---

# 62. Measurement Engine Responsibilities

- validate CT ratings;
- calculate CT ratio;
- convert primary current → relay secondary current;
- apply configured measurement error;
- provide traceable measurement result;
- reject non-finite/unrepresentable arithmetic safely.

No CT saturation in current scope.

---

# 63. Study Engine Responsibilities

- topology registry;
- relay/device registry;
- fault study locations;
- load/min/max current dataset;
- current profile selection;
- primary/backup chain lookup;
- interpolation if a scrubber profile is configured;
- study metadata for guided objective.

Study Engine does not calculate relay time.

---

# 64. Coordination Engine Responsibilities

Input:

- devices/settings;
- operating results;
- fault case/current range;
- coordination requirements.

Output:

- operating order;
- primary/backup relation;
- CTI;
- pass/fail;
- sensitivity/selectivity checks;
- 50 reach violations;
- corridor boundaries;
- scan/envelope results;
- worst-case result;
- hint category metadata.

---

# 65. Timeline Engine Responsibilities

- deterministic engineering-time clock;
- playback-speed mapping;
- pickup timestamp;
- timer progress;
- trip-output timestamp;
- breaker-clearing completion;
- fault-cleared state;
- timer stop/reset behavior;
- event list generation;
- support for future variable current profile.

Do not use graph animation state as engineering timer source-of-truth.

---

# 66. Presentation Model Responsibilities

Presentation consumes engine results and builds:

- TCC layers;
- SLD state;
- status cards;
- collapsed summaries;
- coordination bracket;
- operating sequence rows;
- tooltip content;
- semantic tones.

No formula duplication in render components.

---

# 67. Validation / Invalid State

R07 Differential hardening pattern is mandatory:

- no numeric overflow should crash React;
- non-finite derived result becomes safe invalid state;
- retain last-valid engineering output when appropriate;
- output marked `HELD` while input invalid;
- invalid section remains discoverable even collapsed;
- Apply Fault / Run Study must be blocked when input/study is invalid;
- graph should not render NaN/Infinity coordinates.

---

# 68. User Interaction Inventory

User can:

- choose Single Relay / Coordination Lab;
- choose Guided / Free Study;
- select preset;
- expand/collapse sections;
- select relay on SLD;
- select relay curve on TCC;
- select fault location;
- drag fault scrubber in supported study;
- type parameter values;
- use stepper click;
- press-and-hold stepper;
- inspect InfoDot help;
- hover/tap TCC curve;
- hover/tap operating point;
- toggle initial comparison;
- apply fault;
- clear fault;
- change playback speed;
- run coordination test;
- request progressive hint;
- reset simulator;
- return Home.

No hidden gesture should be required for core workflow.

---

# 69. Interaction Locking During Run

While a time-domain fault run is active, settings that would invalidate deterministic playback are locked, including as appropriate:

- CT settings;
- pickup;
- curve;
- TMS/time dial;
- instantaneous settings;
- fault current/location.

Available actions remain:

- Clear Fault;
- Reset;
- inspect graph/analysis;
- possibly change playback speed if this does not change engineering time.

After clear/reset, controls reopen.

---

# 70. Motion Grammar

Reuse Differential R10:

- fast UI interaction ≈ 120–180 ms;
- panel transition ≈ 180–250 ms;
- graph transition ≈ 250–400 ms;
- no bounce;
- no heavy blur;
- no game-like effects;
- reduced-motion support.

Time-domain relay sequence animation is driven by engineering timeline, not decorative duration.

---

# 71. Color Semantics

Hard semantic grammar:

- steel-cyan = selection / interaction / structural accent;
- green = healthy / coordinated / normal / pass;
- amber = pickup / timing / warning / incomplete;
- red = trip / fault / fail / critical;
- graphite/gray = inactive / reference / initial ghost.

Relay identities must also use line labels/patterns so coordination does not depend only on color.

---

# 72. Accessibility

Minimum requirements:

- keyboard navigation;
- visible focus state;
- section controls with `aria-expanded`;
- graph points/curves with accessible summary where possible;
- InfoDot accessible names/descriptions;
- Help focus trap and Escape behavior;
- touch-compatible graph inspection;
- semantic status text in addition to color;
- reduced-motion support;
- minimum practical click/touch hit areas while preserving compact visual size.

---

# 73. Responsive Behavior

Desktop remains primary engineering workspace.

Reuse platform behavior philosophy:

- desktop: three primary zones;
- intermediate width: avoid compressed three-column layout if usability degrades;
- narrow/mobile: stacked experience + section navigation;
- TCC remains readable and receives priority;
- no horizontal overflow;
- custom overlay scroll indicator does not reduce content width.

Exact breakpoints shall be tuned from actual Overcurrent layout measurements, but design language remains R10-compatible.

---

# 74. Performance Requirements

Explore-mode parameter changes should feel immediate.

Targets:

- pure calculations synchronous and lightweight;
- graph interaction remains smooth;
- coordination scan may be memoized / batched;
- large scan should not block UI for perceptible periods;
- timeline uses deterministic engineering time, not frame count;
- no page reload for parameter changes.

If coordination scan becomes computationally heavy in future, isolate it behind a worker-compatible pure API.

---

# 75. Determinism

Given identical:

- settings;
- study topology;
- fault case/profile;
- engineering-spec version;

engine outputs must be deterministic.

Guided challenges must be reproducible.

Playback speed must never affect engineering result.

---

# 76. Testing Strategy

## Unit — 50/51 engine

- below pickup;
- exact pickup boundary;
- slightly above pickup;
- high multiple;
- each supported IEC curve;
- each supported IEEE curve;
- Definite Time;
- 50 disabled;
- below/exact/above I>>;
- invalid parameters;
- extreme finite values;
- NaN/Infinity rejection.

## Unit — CT measurement

- ratio scaling;
- positive/negative ratio error;
- invalid ratio;
- extreme values;
- finite guard.

## Unit — Coordination

- correct primary/backup order;
- CTI pass/fail;
- exact CTI boundary;
- worst-case search;
- violation envelope;
- sensitivity/load checks;
- instantaneous overreach.

## Unit — Timeline

- no pickup;
- pickup;
- timing;
- 50 immediate branch;
- 51 trip;
- breaker clearing;
- fault clears before trip;
- timer reset/stop;
- speed independence;
- deterministic event ordering.

## Integration

- preset → engine → TCC layer parity;
- parameter change → Analysis parity;
- SLD selection → active TCC relay;
- fault selection → operating points;
- Apply Fault → timeline → breaker state;
- Run Coordination Test → audit results;
- Reset canonical state.

## Browser / UX

- tooltip viewport containment;
- touch pin behavior;
- collapse/expand persistence;
- invalid badge visibility;
- overlay scrollbar;
- responsive widths;
- no Analysis clipping;
- no graph layout jump;
- stable header geometry.

---

# 77. Equation-to-Graph Parity Gate

For sampled study points:

```text
TCC plotted time == engine calculated time
```

within defined numerical tolerance.

Graph must never use an independently approximated curve that differs from engine equations.

This is a release blocker.

---

# 78. Coordination-to-Timeline Parity Gate

For a constant-current study:

- coordination engine operating time;
- TCC operating point;
- timeline timer expiry;

must agree.

The active element identified on graph/Analysis must be the same element that trips during timeline playback.

---

# 79. Scenario Acceptance Examples

Each production preset must define expected qualitative result.

Examples:

- Normal Load → no pickup;
- Near Pickup → 51 pickup, long time;
- High Fault → faster 51;
- Instantaneous Fault → 50 active;
- Clears Before Trip → pickup/timing but no trip;
- Two Relay Initial → coordination fail;
- Two Relay Solved → coordination pass;
- Full Coordination initial → at least one intentional violation;
- Full Coordination solved → all study cases pass.

Exact numeric expectations belong to preset/spec tests.

---

# 80. Help / Educational Content

Help dialog should explain:

- 50 vs 51;
- pickup vs trip;
- TMS/Time Dial;
- current multiple;
- supported curves;
- primary vs backup;
- CTI;
- load/min-fault window;
- Run Fault vs Run Coordination Test;
- study-data limitations.

Help is concise reference, not a textbook.

---

# 81. Event Log

Events are engineering trace, collapsed by default.

Examples:

```text
F3 fault applied @ 0.000 s
R3 51 pickup @ 0.000 s
R2 51 pickup @ 0.000 s
R1 51 pickup @ 0.000 s
R3 51 trip output @ 0.340 s
CB3 open @ 0.420 s
Fault isolated @ 0.420 s
R2 timer stopped/reset @ 0.420 s
R1 timer stopped/reset @ 0.420 s
```

Timestamps are engineering simulation time.

---

# 82. Calculation Details

Calculation Details is collapsed by default and traceable.

Example steps:

```text
1. CT conversion
2. Relay current
3. Pickup threshold
4. Current multiple
5. Selected characteristic
6. 51 operating time
7. 50 comparison
8. Active element
9. Coordination pair evaluation
10. CTI / pass-fail
```

Never expose raw internal debug structures as user-facing explanation.

---

# 83. Homepage Integration

Homepage has four relay menu items.

When Overcurrent reaches implementation-ready route:

`OVERCURRENT RELAY` becomes active and navigates to:

`/simulator/overcurrent`

Use the same homepage transition grammar as Differential.

Differential R10 remains frozen.

---

# 84. Reset Behavior

Reset must return to canonical preset state for the selected study/scenario.

Reset clears:

- active fault playback;
- breaker state;
- timers;
- comparison candidate state unless spec says initial baseline should remain;
- temporary hints/impact messages;
- invalid drafts;
- event log except reset event if desired.

Reset must not navigate away from module.

---

# 85. Save / Export Scope

Persistent study save, file export, coordination report PDF, and project workspace are **not required for initial release**.

Architecture should avoid making them impossible, but they are not core implementation blockers.

---

# 86. Security / Privacy

No server-side user data is required for initial simulator.

No account/login requirement.

No sensitive user data is needed.

---

# 87. Implementation Phases

## O01 — Engineering Specification

Deliver:

- exact equations;
- curve constants;
- boundary behavior;
- unit convention;
- CT convention;
- 50/51 arbitration;
- timeline/reset mathematics;
- CTI definitions;
- reference sources;
- test vectors.

**No production engine coding before O01 approval.**

## O02 — Domain Types & Data Model

Build generic device/study/fault/profile/coordination types.

## O03 — Measurement + 50/51 Pure Engine

No UI.

## O04 — Engine Unit Tests / Numerical Hardening

Include random/extreme-value tests.

## O05 — Study Engine & Preset Registry

Single relay + 2/3 relay radial topology.

## O06 — Coordination Engine

CTI, primary/backup, corridor, envelope, worst case, audit.

## O07 — Timeline Engine

Pickup/timing/trip/breaker/reset + speed separation.

## O08 — Parameter UI

Reuse Differential R10 components/style.

## O09 — SLD

Clickable relay/fault + current path + breaker state.

## O10 — TCC

Layer architecture, curve, points, tooltip, off-scale, fit, comparison.

## O11 — Operating Sequence

Time-domain timeline and progress visualization.

## O12 — Analysis / Learning Layer

Status, margins, hints, impact inspector, run-all-cases.

## O13 — Coordination Guided Challenges

Intentional miscoordination + objective + validation.

## O14 — Responsive / Accessibility / UX Refinement

R10 parity, collapse summaries, mobile/touch.

## O15 — Homepage Route Integration

Activate Overcurrent navigation.

## O16 — Final Engineering + UX Audit

Full regression and release freeze.

---

# 88. Phase Gates

Every phase requires explicit completion evidence.

### Engineering gate

- formulas traced to spec;
- tests pass;
- no UI formula duplication.

### Workflow gate

- canonical state;
- Reset;
- fault apply/clear;
- deterministic playback.

### UI gate

- same design language as Differential R10;
- responsive;
- no overflow/clipping;
- tooltips accessible;
- collapsed state informative.

### Release gate

- production build/typecheck/test;
- equation/graph parity;
- coordination/timeline parity;
- scenario regression;
- browser smoke;
- engineering limitations documented.

---

# 89. Definition of Done — Overcurrent Module

Module may be declared FINAL only when all are true:

1. Engineering Specification approved.
2. 50/51 formulas implemented and tested.
3. CT measurement tested.
4. Single Relay Study complete.
5. 2/3 Relay Coordination Lab complete.
6. CTI/corridor/envelope/worst-case functionality complete.
7. TCC graph matches engine.
8. SLD interaction complete.
9. time-domain sequence complete.
10. Run Coordination Test complete.
11. Guided study/hints complete.
12. initial/current comparison complete.
13. invalid/extreme inputs cannot crash UI.
14. responsive/browser regression clean.
15. homepage route active.
16. documentation/sourcebook updated.
17. no unresolved P0/P1 issue.
18. user explicitly approves freeze.

---

# 90. Risks & Mitigation

## Risk — too many features create a complex first screen

Mitigation:

- progressive modes;
- collapsible sections;
- Guided Study presets;
- TCC remains primary;
- Analysis hierarchy only exposes relevant checks.

## Risk — coordination engine and timeline diverge

Mitigation:

- shared pure operating-result calculation;
- parity tests.

## Risk — TCC becomes overloaded

Mitigation:

- layer visibility rules;
- hide/show optional study layers;
- semantic hierarchy;
- primary active fault line/points always clear.

## Risk — arbitrary CTI / fault assumptions become misleading

Mitigation:

- values belong to named study preset;
- UI labels them as configured study data;
- no universal-value claim.

## Risk — graph calculation duplicates relay equation

Mitigation:

- graph samples engine characteristic function directly.

## Risk — variable-current future feature forces rewrite

Mitigation:

- timeline/current-profile interface designed now even if V1 uses constant segments.

## Risk — user depends on color only

Mitigation:

- labels, line styles, badges, and status text.

---

# 91. Mature-Scope Audit

The planned scope was reviewed against five questions.

## 91.1 Does the architecture support basic 50/51 without coordination?

**YES.** Single Relay Study uses the same measurement/element/timeline engine.

## 91.2 Can coordination be added without duplicating relay formulas?

**YES.** Coordination consumes operating results from generic relay devices.

## 91.3 Can more than three relays be supported later?

**YES, if device registry remains array/data-driven.** R1/R2/R3 are preset identities, not architecture limits.

## 91.4 Can future equipment curves be added without rewriting TCC?

**YES, through generic TCC layers.**

## 91.5 Can varying current be supported later without replacing timeline architecture?

**YES, if timeline accepts a generic current-profile interface and engineering spec defines accumulation behavior.**

---

# 92. Product-Scope Audit — What Was Added to Make the Plan Mature

The original platform PRD only defined basic overcurrent capabilities: pickup, current multiple, TMS, definite/inverse curves, operating time, trip indication, and TCC.

This mature module PRD formally adds:

- Single Relay + Coordination mode split;
- Guided + Free study;
- generic topology/study model;
- CTI budget;
- primary/backup engine;
- coordination corridor;
- coordination envelope;
- worst-case scanner;
- min/max fault studies;
- sensitivity/selectivity/load-security checks;
- instantaneous overreach analysis;
- time-domain timeline;
- breaker clearing separation;
- current-profile-ready architecture;
- TCC layer system;
- initial/current snapshots;
- parameter impact inspector;
- progressive hints;
- all-cases validation;
- source architecture and release gates.

These additions are intentional architecture decisions, not late-stage feature creep.

---

# 93. Locked Decisions for Future Execution

Unless user explicitly reopens the PRD, future implementation should assume:

1. Differential R10 remains the UI reference and stays frozen.
2. Overcurrent design language must match Differential R10.
3. Overcurrent V1 is non-directional **phase 50/51**.
4. Coordination Lab is core scope, not an optional addon.
5. Single Relay and Coordination share the same relay engine.
6. TCC is the primary visualization.
7. SLD and Operating Sequence are supporting visuals.
8. Three educational stages are Explore → Coordinate → Validate.
9. Initial release supports radial 1/2/3-relay studies.
10. Fault currents come from configured study data, not a hidden network solver.
11. Run Fault and Run Coordination Test are separate workflows.
12. CTI is configurable study data; no universal fixed value is assumed.
13. Sensitivity, Selectivity, Speed, Time Grading, Load Security, and Instantaneous Reach are explicit audit concepts.
14. Time-domain engine separates relay trip output from breaker clearing.
15. Simulation speed changes playback only.
16. TCC graph uses generic layers.
17. Architecture is current-profile-ready.
18. Hints never directly provide final setting values by default.
19. Guided presets intentionally begin with solvable miscoordination.
20. No auto-optimizer in core release.
21. No directional/ground/phasor/network-solver expansion without new scope approval.

---

# 94. Immediate Next Step

The next execution task after approval of this PRD is **O01 — Overcurrent Relay Engineering Specification**.

O01 must lock:

- engineering current domain and units;
- CT convention;
- exact IEC/IEEE equations/constants;
- definite-time behavior;
- pickup equality behavior;
- 50 equality/priority behavior;
- inverse-time reset/accumulation treatment;
- current-profile handling;
- breaker-clearing semantics;
- CTI formula/boundaries;
- initial default relay/study parameters;
- numerical tolerances;
- canonical test vectors.

Only after O01 is approved should source engine implementation start.

---

# 95. Final Product Statement

Overcurrent Relay Simulator is not intended to be a static time-current calculator.

It is a **visual protection coordination laboratory** where the user can:

1. understand one relay;
2. see how settings change its characteristic;
3. place faults in a system study;
4. observe several relays responding to the same fault;
5. identify coordination failure;
6. tune pickup/time/curve/instantaneous settings;
7. watch the operating sequence in engineering time;
8. validate the full study range;
9. compare initial and final protection behavior;
10. understand *why* the final settings coordinate.

The intended mental model is:

```text
PARAMETERS
    ↓
MEASUREMENT
    ↓
RELAY CHARACTERISTIC
    ↓
OPERATING TIME
    ↓
PRIMARY / BACKUP RELATION
    ↓
TIME-DOMAIN SEQUENCE
    ↓
COORDINATION VALIDATION
```

This PRD is the authoritative product-plan baseline for implementation of the Overcurrent Relay module.
