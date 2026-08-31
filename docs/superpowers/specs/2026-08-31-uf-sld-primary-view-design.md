# Underfrequency SLD Primary View — Design Specification

**Module:** Underfrequency Relay Simulator (U01)
**Date:** 2026-08-31
**Status:** APPROVED (brainstorming session, Pendekatan A + keputusan pengguna)
**Baseline spec:** `docs/engineering-specs/underfrequency-relay.md` (U01 v1.0)
**Scope guard:** This document amends U01 § 14 (UI hierarchy) only. It does NOT amend the engine equations, UFLS logic, or the parity/hardening guarantees of U01 § 8–13.

---

## 1. Problem statement

U01 § 14 menjadikan kurva frekuensi-vs-waktu sebagai visual dominan. Pengguna harus membaca skenario secara numerik — bagian mana yang low-frequency, yang shed, dan pemulihan tidak terlihat sebagai *sistem*, hanya sebagai angka pada kurva.

Tujuan: SLD (Single Line Diagram) sebagai tampilan utama, dengan animasi yang menunjukkan:
- generator yang trip (keluar dari online set),
- respon governor per-generator (bar naik),
- blok beban yang di-shed UFLS (breaker membuka, blok redup),
- indikator frekuensi bus live,
- dan "relay naik lagi" = pemulihan frekuensi (bus indicator + governor bar turun kembali).

Kurva frekuensi tetap tersedia — bukan dihilangkan. Hasil skenario di SLD tampak di kurva.

## 2. Keputusan yang disetujui pengguna

| # | Keputusan | Nilai |
|---|---|---|
| D1 | Scope | SLD baru + mode switch [SLD] [Curve] [Split]; bukan Story-only, bukan hanya animasi pack |
| D2 | Reusability | Khusus Underfrequency (bukan abstraksi shared); modul lain nanti build terpisah |
| D3 | Topologi | 4 generator → bus → 3–6 blok beban (default study: **4 blok**) |
| D4 | Animasi | generator trip + governor bar + UFLS shed + bus freq indicator live |
| D5 | Mode switch | Tab di kolom Live Simulation; default tab = SLD |
| D6 | Story mode | **Dihapus** — SLD absorbs narasi; Auto-play via playback bar global |
| D7 | Playback | Kontrol playback **global** di header Live Simulation, di atas tab |
| D8 | Alokasi shed | **A→B→C berurutan (kumulatif), Blok D kritis tidak pernah dilepas**; overflow → 'unserved' |
| D9 | Scrub state | `scrubTimeSec` **masuk reducer** (SET_SCRUB_TIME action); reset otomatis via flagModified |

## 3. Arsitektur (5-layer, nol perubahan engine)

```text
utils/underfrequencyState.ts   → + SET_SCRUB_TIME action (UnderfrequencyAction lives here; no domain types change)
engines/underfrequencyTimeline   → UNCHANGED (parity & hardening tetap jadi regression guard)
presentation/underfrequencySld.ts → BARU: model murni (coords + state per elemen)
components/underfrequency/UnderfrequencySld.tsx → BARU: SVG render + CSS animasi
pages/UnderfrequencySimulator.tsx → refactor: hook playback, tab view-mode, playback bar global
components/underfrequency/FrequencyTimelineChart.tsx → refactor: playback & story DIANGKAT KELUAR
```

Prinsip 5-layer tetap: **persamaan relay tidak pindah ke presentation/component.** `buildUnderfrequencySldModel` hanya transformasi state → koordinat/status/kelas animasi. Alokasi shed ke blok adalah **kebijakan visual presentasi** (terdokumentasi, deterministik, di-test) — bukan persamaan relay.

## 4. Data flow

```text
study ─▶ computeUnderfrequencyTimeline (memo, UNCHANGED) ─▶ run
run + playbackState + simulationSpeed ─▶ useUnderfrequencyPlayback (rAF hook, page-level)
        └─▶ dispatch SET_SCRUB_TIME ─▶ state.scrubTimeSec (reducer; vestigial field jadi hidup)
state.scrubTimeSec + run ─▶ snapshotAtTime ─▶ visibleSnapshot (memo di page)
visibleSnapshot ─▶ FrequencyTimelineChart (tab Curve, read-only scrub)
visibleSnapshot + run.events + study ─▶ buildUnderfrequencySldModel ─▶ UnderfrequencySld (tab SLD)
```

- **Satu sumber kebenaran**: reducer. `FrequencyTimelineChart` berhenti memiliki clock sendiri; dia menerima `visibleSnapshot` sebagai prop (read-only) — tidak lagi menghitung rAF.
- `viewMode` = `useState` di page (preferensi UI, bukan engineering state — tidak masuk reducer).
- **IDLE (belum run):** SLD menampilkan konfigurasi pre-fault dari `study` langsung (semua online, f = f_nom, semua blok energized, headroom penuh) — bukan "NO SNAPSHOT".

### 4.1 Reducer changes (satu-satunya perubahan types/reducer)

- Action baru: `{ type: 'SET_SCRUB_TIME'; timeSec: number | null }`.
- `flagModified`, `RESET`, `APPLY_PRESET`, `CLEAR_RUN` sudah me-set `scrubTimeSec: null` — perilaku ini jadi hidup (sebelumnya vestigial), tidak ada perubahan semantik lain.
- `SET_SCRUB_TIME` tidak mengubah `playbackState` (scrub saat PAUSED/COMPLETE/IDLE tidak memulai run).

### 4.2 Hook `useUnderfrequencyPlayback` (page-level)

- rAF loop yang sebelumnya hidup di `FrequencyTimelineChart` dipindah utuh; input: `(playbackState, simulationSpeed, totalTimeSec)`; output: dispatch `SET_SCRUB_TIME`.
- COMPLETE latch: scrub ≥ finalTimeSec → dispatch `SET_PLAYBACK_STATE COMPLETE` (sama seperti sekarang).
- Karena `scrubTimeSec` sekarang di reducer, reset saat study berubah otomatis (flagModified) — chart tidak perlu effect sendiri.

## 5. SLD topology & layout

```text
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│ G1 600MW │  │ G2 400MW │  │ G3 300MW │  │ G4 250MW │   kolom generator (per study.generators)
│ bar+RPM  │  │          │  │          │  │          │
└────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘
     └─────────────┴──────┬──────┴─────────────┘
                       ╔═══╧═══╗
                       ║  BUS  ║            f NOW (besar, tabular-nums),
                       ╚═══╤═══╝            ROCOF, DEFISIT; tone semantik
      ┌──────────┬─────────┼─────────┐
   [CB]       [CB]       [CB]      [CB]        breaker per feeder
 ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
 │ Blok A │ │ Blok B │ │ Blok C │ │ Blok D │   4 blok beban: 35/30/20/15%
 └────────┘ └────────┘ └────────┘ └────────┘   D = kritis, tak pernah shed
```

- Generator diberi label dari `study.generators` (id, MW rated, status chip ONLINE / AT LIMIT / TRIPPED, RPM dari snapshot).
- Bus menampilkan `frequencyHz` (besar), `rocofHzPerSec`, `deficitMw` dari visibleSnapshot; tone **diturunkan dari snapshot**, bukan dari stage default: hijau (tidak ada stage armed), amber (≥1 stage armed), merah (≥1 stage operated ATAU `COLLAPSE`).
- Breaker per feeder (blade 2-state + animasi OPENING ~200 ms, mengikuti pola `breakerGeometry` di Overcurrent SLD — visual idiom yang sama, kode terpisah).
- Blok beban: label + persentase + MW sisa (jika ter-shed sebagian — tidak terjadi pada D8 kecuali overflow 'unserved').

### 5.1 Load block partition (D8 — kebijakan visual, presentasi-only)

- D3 menerima rentang 3–6 blok; **implementasi v1 memakai tepat 4 blok (A/B/C/D)** untuk semua studi — rentang 3–6 adalah ruang desain, bukan konfigurasi runtime.
- Default study (1300 MW base load) dipartisi: **A 35%, B 30%, C 20%, D 15% (kritis)** → A 455, B 390, C 260, D 195 MW.
- Trip stage kumulatif A→B→C: total shed ≤ A, blok A dilepas; dst. Blok D tidak pernah dilepas.
- Overflow (total shed > A+B+C = 85% base load): sisanya ditandai `unservedMw` di bus ("unserved / deficit tidak terlayani") — tidak ada blok yang setengah redup.
- Alokasi ini **tidak mengubah** `shedMw` engine; engine tetap melepas MW agregat. Ini pemetaan visual deterministik.

### 5.2 Animasi (CSS-driven dari model, nol dependency)

| Elemen | Trigger | Visual |
|---|---|---|
| Generator trip | `status === 'TRIPPED'` | Simbol memudar abu-abu + chip TRIPPED; edge ke bus putus |
| Governor response | `governorResponseMw` per snapshot | Bar output naik-turun (transition); chip AT LIMIT saat `saturated` |
| UFLS shed | stage masuk `operatedStageIds` | Breaker blade rotate (~200 ms) → blok meredup + chip SHED |
| Bus freq | `frequencyHz` per snapshot | Angka besar live + tone; ROCOF & DEFISIT di bawahnya |

- Kontinum (bar, frekuensi) → CSS transition; diskrit (trip, shed, breaker) → keyframe trigger via perubahan `data-status`.
- Reduksi re-render: model memo per snapshot; snapshot berubah ~60 fps saat RUNNING — semua angka pakai tabular-nums agar tidak jitter.

## 6. Mode switching & layout changes

- Tab di header Live Simulation: **[SLD] [Curve] [Split]**; default **SLD**.
- `Split` = SLD atas + Curve bawah (50/50).
- **Playback bar global** di atas tab (di header Live Simulation): Run/Pause/Resume · Clear · ×1/×5/×10 · scrubber — identik di semua tab, tidak pernah pindah.
- `FrequencyTimelineChart` setelah refactor: tetap hero di tab Curve/Split; kehilangan playback bar & story chips internalnya (pindah ke page). Chart menerima `visibleSnapshot` + `scrubTimeSec` sebagai props.
- Story mode: **dihapus** (D6). `buildStorySteps`, chips, `storyOpen` dibuang. Narasi fase kini lewat animasi SLD + phase events di Analysis panel (yang sudah ada).

## 7. Error handling

| Kondisi | Perilaku |
|---|---|
| `run.status === 'INVALID'` | Banner INPUT INVALID (existing) tetap; SLD hold state valid terakhir |
| Draft parameter invalid | OUTPUT HELD — SLD tidak re-render dari draft invalid (pola existing) |
| `COLLAPSE` | Bus merah + label COLLAPSE; blok menampilkan status shed final; generator AT LIMIT |
| Total shed > 85% base | `unservedMw` ditampilkan di bus (overflow D8) |
| IDLE / belum run | SLD menampilkan pre-fault dari study (bukan NO SNAPSHOT) |

## 8. Testing

- `presentation/underfrequencySld.test.ts` — determinisme D8 (A→B→C, D aman, overflow → unserved), model dari study-saja (idle), status per snapshot, arm/trip dari events.
- `components/underfrequency/UnderfrequencySld.test.tsx` — render, `data-status`, aria-label, tone bus.
- Page test: tab switch default SLD, playback bar global mem-dispatch dengan benar, SET_SCRUB_TIME di reducer (test reducer baru).
- `FrequencyTimelineChart` test di-update: story/playback internal hilang; snapshot dari props.
- Engine UNCHANGED → parity & hardening dijalankan sebagai regression guard.
- Gate: `npm run build` + `npx vitest run` + `.agents/skills/ui-adversarial-test/SKILL.md` sebelum PASS.

## 9. Explicit non-goals

- Tidak menambah dependency (chart/SVG/animation library) — semua inline SVG + CSS.
- Tidak mengubah engine, preset MW, shed fraction, atau UFLS logic.
- Tidak membuat abstraksi SLD shared untuk modul lain (D2).
- Tidak menambah load-frequency sensitivity, multi-area, atau apapun di U01 § 16 (still outside scope).
- Tidak ada SLD interaktif (klik generator untuk edit) — parameter tetap di kolom Parameter.

## 10. Files touched

| File | Aksi |
|---|---|
| `src/types/underfrequency.ts` | (tidak ada perubahan domain type — hanya komentar kalau perlu) |
| `src/utils/underfrequencyState.ts` | + SET_SCRUB_TIME; reset scrub otomatis (existing) |
| `src/presentation/underfrequencySld.ts` | BARU |
| `src/presentation/underfrequencySld.test.ts` | BARU |
| `src/components/underfrequency/UnderfrequencySld.tsx` | BARU |
| `src/components/underfrequency/underfrequencySld.css` | BARU |
| `src/components/underfrequency/UnderfrequencySld.test.tsx` | BARU |
| `src/pages/UnderfrequencySimulator.tsx` | refactor (playback hook, tabs, playback bar, snapshot memo) |
| `src/pages/UnderfrequencySimulator.test.tsx` | update (tabs, playback bar, scrub) |
| `src/components/underfrequency/FrequencyTimelineChart.tsx` | refactor (buang clock & story; props snapshot/scrub) |
| `src/components/underfrequency/FrequencyTimelineChart.test.tsx` | update |
| `src/components/underfrequency/frequencyTimelineChart.css` | update (buang story styles) |

## 11. U01 § 14 amendment (eksplisit)

1. "The dominant visual is the frequency-vs-time curve" → **"The dominant visual is the SLD in tab SLD (default); the frequency curve remains available in tab Curve and Split."**
2. "an optional Story mode (a button, not the primary view)" → **"Story mode is removed; phase narrative is carried by the SLD animation + the existing Analysis phases section."**
3. Tambahan: **"Playback controls are global to the Live Simulation column, above the view tabs."**
4. Tambahan: **"Load-block partition A/B/C/D is a presentation-only visual policy (D8), not a relay equation; documented here and tested for determinism."**
