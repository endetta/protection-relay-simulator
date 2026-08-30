# Product Requirements Document (PRD)
## Protection System Relay Simulator Platform

**Document Version:** 1.0  
**Product Type:** Web-based Engineering Simulator  
**Initial Delivery:** HTML / Hybrid Web Prototype  
**Primary Domain:** Electrical Power System Protection  
**Primary Users:** Electrical engineering students, protection engineers, lecturers, technicians, and training participants

---

# 1. Product Vision

Protection System Relay Simulator Platform adalah website interaktif untuk mempelajari, menguji, dan memvisualisasikan cara kerja berbagai jenis relay proteksi sistem tenaga listrik.

Website tidak diposisikan sebagai website informasi biasa yang memiliki halaman panjang dan banyak konten untuk dibaca. Produk harus terasa seperti sebuah **engineering application** atau **virtual protection laboratory**.

Pengalaman yang ingin dicapai:

> User membuka aplikasi → memilih jenis relay → masuk ke workspace simulator → mengubah parameter → melihat hubungan parameter, perhitungan, karakteristik relay, kondisi sistem, dan keputusan trip secara real-time.

Setiap simulator merupakan modul independen dan memiliki halaman tersendiri.

Contoh:

- `/`
  - Protection Simulator Home
- `/simulator/overcurrent`
  - Overcurrent Relay Simulator
- `/simulator/differential`
  - Differential Relay Simulator
- `/simulator/distance`
  - Distance Relay Simulator
- `/simulator/underfrequency`
  - Underfrequency Relay Simulator

Arsitektur harus memungkinkan simulator baru ditambahkan tanpa mendesain ulang keseluruhan website.

---

# 2. Product Philosophy

Produk harus mengikuti empat prinsip utama.

### 2.1 Engineering First

Website harus terasa sebagai software engineering/protection engineering, bukan landing page marketing.

Prioritas desain:

- data;
- parameter;
- diagram;
- kurva;
- status sistem;
- perhitungan;
- visualization;
- interaction.

Dekorasi visual tidak boleh mengalahkan fungsi teknis.

---

### 2.2 Simulator, Not Calculator

User tidak hanya memasukkan angka kemudian memperoleh hasil.

Setiap input harus mempunyai hubungan dengan sistem.

Sebagai contoh pada Differential Relay:

```text
CT Primary
      │
      ▼
CT Ratio
      │
      ▼
Secondary Current
      │
      ├─────────────┐
      │             │
      ▼             ▼
Mismatch         CT Error
      │             │
      └──────┬──────┘
             ▼
      Measured Current
             │
        ┌────┴────┐
        ▼         ▼
      Idiff      Ibias
        │         │
        └────┬────┘
             ▼
   Differential Characteristic
             │
             ▼
        OPERATE / RESTRAIN
```

Perubahan satu parameter harus dapat memengaruhi parameter lain yang relevan.

---

### 2.3 Visual Learning

User harus dapat memahami:

- apa yang sedang terjadi;
- mengapa relay bekerja;
- bagaimana parameter memengaruhi hasil;
- bagaimana titik operasi berpindah;
- kapan relay masuk zona trip;
- kapan relay tetap restrain.

Karena itu simulasi harus menggunakan kombinasi:

- numerical values;
- animated diagrams;
- interactive curves;
- state indicators;
- calculation breakdown;
- contextual explanation.

---

### 2.4 Workspace-Oriented UI

Layout tidak menggunakan pola:

```text
Hero
↓
Feature
↓
About
↓
Chart
↓
Article
↓
Footer
```

Sebaliknya:

```text
┌─────────────────────────────────────────────────────┐
│                    APPLICATION                      │
│                                                     │
│ Sidebar          Engineering Workspace              │
│                                                     │
│ Simulator        Controls                           │
│ Navigation       Diagram                            │
│                  Graph                              │
│                  Results                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

Website harus terasa seperti aplikasi desktop modern yang berjalan di browser.

---

# 3. Primary Product Goal

Tujuan utama aplikasi adalah menyediakan environment simulasi relay proteksi yang:

1. interaktif;
2. edukatif;
3. teknis;
4. visual;
5. mudah dipahami;
6. secara engineering dapat dipertanggungjawabkan.

User harus dapat melihat hubungan antara:

```text
System Condition
      ↓
Relay Input
      ↓
Relay Parameter
      ↓
Relay Calculation
      ↓
Characteristic
      ↓
Protection Decision
      ↓
Trip / Restrain / Alarm
```

---

# 4. Product Scope

Versi awal website dirancang untuk menampung simulator berikut.

## Current Implementation Status — 2026-08-13

- [~] **Homepage / Protection Lab** — IMPLEMENTED R02 / PLATFORM SHELL ACTIVE / NOT FROZEN
- [~] **Overcurrent Relay Simulator** — **O10 TCC PASSED / NEXT O11 OPERATING SEQUENCE**
- [x] **Differential Relay Simulator** — **FINAL / COMPLETED (R10)**
- [ ] **Distance Relay Simulator** — PLANNED
- [ ] **Underfrequency Relay Simulator** — PLANNED

The Differential Relay module is the frozen production/reference implementation and must not be changed unless its scope is explicitly reopened. Homepage R02 provides the current minimal navigation shell. The active product-development focus is the Overcurrent Relay module, governed by `docs/PRD-overcurrent-relay.md`; its approved engineering stack, Parameter UI, radial SLD, and TCC have advanced through O10, with O11 Operating Sequence next.


## Core Simulator

### 01 — Overcurrent Relay Simulator

**Authoritative module PRD:** `docs/PRD-overcurrent-relay.md` (v1.0, 2026-08-13).

Mempelajari proteksi arus lebih. Modul ini direncanakan sebagai 50/51 protection & coordination laboratory dengan tiga pengalaman inti: Explore → Coordinate → Validate.

Potential capabilities:

- phase current;
- pickup current;
- current multiple;
- time dial / TMS;
- definite time;
- inverse curve;
- IEC inverse curve;
- IEEE inverse curve;
- relay operating time;
- trip indication;
- time-current characteristic.

---

### 02 — Differential Relay Simulator

Mempelajari prinsip differential protection.

Potential parameters:

- CT primary ratio;
- CT secondary ratio;
- current side 1;
- current side 2;
- transformer ratio;
- vector compensation;
- CT mismatch;
- CT measurement error;
- differential current;
- bias/restraint current;
- minimum pickup;
- slope 1;
- slope 2;
- breakpoint;
- additional slope regions;
- operating point;
- trip/restraint decision.

Interactive visualization:

```text
Ibias
  │
  │                    OPERATE
  │                  /
  │                /
  │              /
  │            /
  │__________/________________ Idiff
           RESTRAIN
```

Kurva sebenarnya akan mengikuti formulasi proteksi yang dipilih pada tahap engineering specification.

---

### 03 — Distance Relay Simulator

Mempelajari distance protection berdasarkan impedansi.

Potential parameters:

- system voltage;
- line current;
- line impedance;
- R1;
- X1;
- line length;
- fault distance;
- fault type;
- fault resistance;
- CT ratio;
- VT/PT ratio;
- Zone 1 reach;
- Zone 2 reach;
- Zone 3 reach;
- zone delay.

Visual utama:

**R-X impedance diagram**

User dapat melihat titik impedansi gangguan bergerak di dalam diagram.

---

### 04 — Underfrequency Relay Simulator

Mempelajari respon relay terhadap penurunan frekuensi.

Potential parameters:

- nominal frequency;
- actual frequency;
- pickup frequency;
- frequency stages;
- time delay;
- rate of change of frequency;
- load shedding stage.

Visual utama:

```text
Frequency
50 Hz ───────────────
                  \
                   \
48.5 Hz ────────────● Stage 1
                     \
48.0 Hz ──────────────● Stage 2
```

---

# 5. Future Simulator Architecture

Platform harus disiapkan untuk pengembangan modul berikutnya.

Possible future modules:

- Earth Fault Relay;
- Directional Overcurrent Relay;
- Restricted Earth Fault;
- Overvoltage Relay;
- Undervoltage Relay;
- Overfrequency Relay;
- ROCOF Relay;
- Reverse Power Relay;
- Thermal Overload Relay;
- Negative Sequence Relay;
- Breaker Failure Protection;
- Transformer Protection;
- Generator Protection;
- Busbar Protection;
- Motor Protection;
- Synchrocheck Relay.

Homepage tidak perlu menampilkan semuanya apabila belum tersedia.

Simulator yang belum selesai dapat memiliki status:

```text
AVAILABLE
BETA
COMING SOON
```

---

# 6. Information Architecture

Struktur utama:

```text
Protection Simulator
│
├── Home
│
├── Overcurrent Relay
│
├── Differential Relay
│
├── Distance Relay
│
├── Underfrequency Relay
│
└── Future Modules
```

Tidak menggunakan satu halaman panjang.

Setiap simulator menggunakan route terpisah.

---

# 7. Homepage Concept

Homepage merupakan **fixed application viewport**.

Target desktop:

```text
100vw × 100vh
```

Tidak terdapat vertical page scrolling.

Struktur utama:

```text
┌──────────────────────────────────────────────────────────────┐
│ SYSTEM PROTECTION LAB                         STATUS • READY │
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│ PROTECTION     │             MAIN WORKSPACE                  │
│ MODULES        │                                             │
│                │     Protection Relay Simulator              │
│ ● Overview     │                                             │
│                │     Interactive learning platform           │
│ 01 OCR         │                                             │
│ 02 Differential│          [ system illustration ]            │
│ 03 Distance    │                                             │
│ 04 Frequency   │                                             │
│                │                                             │
│ ─────────────  │                                             │
│ System Status  │                                             │
│ READY          │                                             │
│                │                                             │
└────────────────┴─────────────────────────────────────────────┘
```

---

# 8. Homepage Sidebar

Sidebar menjadi navigasi utama.

Contoh:

```text
PROTECTION LAB

OVERVIEW

RELAY SIMULATORS

01  Overcurrent
02  Differential
03  Distance
04  Underfrequency

ADVANCED

05  Directional OC
06  Earth Fault
07  REF

SYSTEM
About
Documentation
```

Navigasi harus dapat di-scan dengan cepat.

Sidebar tidak menggunakan card besar.

---

# 9. Homepage Main Workspace

Area utama homepage bukan sekadar hero banner.

Area ini memperkenalkan sistem.

Contoh struktur:

```text
PROTECTION SYSTEM
SIMULATION LAB

Interactive environment for
power system protection studies.

────────────────────────────

04
ACTIVE SIMULATORS

12+
PLANNED MODULES

REAL-TIME
CALCULATION ENGINE


[ OPEN SIMULATOR ]
```

Di belakang atau di samping informasi dapat terdapat visualisasi ringan berupa:

- simplified one-line diagram;
- transformer;
- CT;
- relay;
- circuit breaker;
- transmission line.

Visual harus bergerak sangat subtil.

---

# 10. Navigation Interaction

Saat cursor berada pada:

**Differential Relay**

sidebar:

```text
02 Differential
```

main workspace dapat berubah menjadi preview module:

```text
DIFFERENTIAL PROTECTION

87T

Compare currents entering
and leaving the protected zone.

[ CURRENT BALANCE DIAGRAM ]

Parameters
CT Ratio
Bias
Slope
Differential Current

[ Launch Simulator → ]
```

Tidak perlu berpindah halaman sampai user memilih module.

---

# 11. Simulator Page Architecture

Semua simulator menggunakan design language yang sama.

Contoh:

```text
┌───────────────────────────────────────────────────────────────┐
│ ← HOME     DIFFERENTIAL RELAY / 87T              SIM RUNNING │
├─────────────────┬───────────────────────┬─────────────────────┤
│                 │                       │                     │
│ PARAMETERS      │    LIVE SIMULATION    │      ANALYSIS       │
│                 │                       │                     │
│ CT Ratio        │   system diagram      │ Idiff     0.42 A    │
│ [1000/1]        │                       │ Ibias     2.30 A    │
│                 │   CT1 ─ Relay ─ CT2   │                     │
│ CT Error        │                       │ STATUS              │
│ [ 2.0 % ]       │                       │ RESTRAIN            │
│                 ├───────────────────────┤                     │
│ Slope 1         │                       │                     │
│ [ 30 % ]        │ characteristic curve │ Calculation         │
│                 │                       │                     │
│ Slope 2         │          ●            │ Idiff = |I1-I2|     │
│ [ 60 % ]        │        /              │                     │
│                 │      /                │                     │
│                 │____/________________  │                     │
└─────────────────┴───────────────────────┴─────────────────────┘
```

---

# 12. Mandatory Back Navigation

Setiap halaman simulator wajib mempunyai tombol:

```text
← HOME
```

atau:

```text
← Protection Lab
```

Lokasinya konsisten di kiri atas.

Tidak boleh bergantung hanya pada browser Back.

User harus selalu mengetahui cara kembali ke homepage.

---

# 13. Simulator Layout System

Layout simulator menggunakan tiga zona utama.

## Zone A — Parameter Panel

Lebar sekitar:

```text
20–25%
```

Berisi editable parameters.

Contoh input:

```text
CT PRIMARY

1000
──────
1 A
```

Jenis control:

- numeric field;
- dropdown;
- toggle;
- segmented control;
- slider;
- stepper.

Slider hanya digunakan apabila benar-benar membantu interaksi.

Nilai engineering tetap harus bisa diketik secara presisi.

---

## Zone B — Simulation Workspace

Lebar sekitar:

```text
45–55%
```

Merupakan pusat perhatian.

Berisi:

- one-line diagram;
- relay visualization;
- fault visualization;
- phasor;
- characteristic curve;
- dynamic operating point.

---

## Zone C — Results / Analysis

Lebar sekitar:

```text
25–30%
```

Berisi:

- calculated values;
- relay state;
- equations;
- decision;
- event information.

Contoh:

```text
RELAY STATE

● OPERATE

Idiff
2.85 A

Ibias
3.40 A

Threshold
2.61 A

Margin
+0.24 A

OPERATING CONDITION
Idiff > Threshold
```

---

# 14. Avoid Long Simulator Pages

Simulator juga sebisa mungkin menggunakan:

```text
100vh
```

bukan halaman panjang.

Jika jumlah parameter terlalu banyak:

gunakan:

- internal panel scrolling;
- collapsible parameter groups;
- tabs;
- drawer;
- expandable advanced settings.

Jangan membuat seluruh browser page harus di-scroll jauh.

---

# 15. Parameter Hierarchy

Parameter dibagi menjadi tiga level.

### SYSTEM

Parameter kondisi sistem.

Contoh:

```text
System Current
System Voltage
Frequency
Line Impedance
Fault Position
```

### RELAY

Parameter setting relay.

Contoh:

```text
Pickup
Slope
Time Delay
Zone Reach
Characteristic
```

### INSTRUMENT

Parameter measurement chain.

Contoh:

```text
CT Ratio
VT Ratio
CT Error
CT Saturation
Mismatch
```

Pembagian ini penting agar user tidak melihat puluhan input tanpa konteks.

---

# 16. Parameter Dependency Engine

Salah satu requirement terpenting adalah keterhubungan antarparameter.

Contoh Differential Relay:

```text
Primary Current
      ↓
CT Ratio
      ↓
Secondary Current
      ↓
CT Error
      ↓
Effective Current
      ↓
Idiff / Ibias
      ↓
Characteristic Comparison
      ↓
Relay Decision
```

Ketika user mengubah CT ratio:

```text
1000/1
```

menjadi:

```text
800/1
```

nilai downstream harus langsung dihitung ulang.

Tidak boleh membutuhkan reload halaman.

---

# 17. Real-Time Simulation

Target interaction:

```text
User changes parameter
        ↓
Calculation engine updates
        ↓
Diagram updates
        ↓
Graph updates
        ↓
Operating point moves
        ↓
Relay state evaluated
        ↓
UI state updates
```

Target perceived response:

**instantaneous.**

---

# 18. Animation Philosophy

Animasi wajib ada, tetapi harus bersifat teknis.

Gunakan animation untuk menjelaskan keadaan sistem.

Contoh:

### Current Flow

```text
Bus ───────► CT ───────► Relay
```

Gerakan pulse kecil menunjukkan current flow.

---

### Breaker Trip

Ketika relay operate:

```text
CLOSED

──────●──────

↓

OPEN

─────●  ●────
```

breaker melakukan animation membuka.

---

### Fault

Fault dapat ditampilkan sebagai marker pada transmission line.

```text
SOURCE ─────────────⚡──────────── BUS
```

Bukan efek ledakan/glow berlebihan.

---

### Operating Point

Saat parameter berubah, titik pada kurva berpindah secara smooth.

```text
previous
    ●
     \
      \
       ● current
```

Gunakan interpolated transition.

---

# 19. Animation Timing

Animation guideline:

Micro interaction:

```text
120–180 ms
```

Panel transition:

```text
180–250 ms
```

Graph transitions:

```text
250–400 ms
```

Simulation sequence dapat lebih panjang jika memang menunjukkan proses fisik.

Hindari animasi lambat yang menghambat eksperimen.

---

# 20. Visual Direction

Keyword visual:

**Industrial Control System**

dipadukan dengan:

**Modern Engineering Software**

dan:

**Protection Laboratory Instrumentation**

Bukan:

- futuristic AI dashboard;
- cyberpunk;
- gaming interface;
- crypto dashboard;
- SaaS landing page.

---

# 21. Color Philosophy

Base interface menggunakan neutral industrial palette.

Contoh:

```text
Background
#0F1115

Surface
#161A20

Panel
#1B2027

Border
#2A3039

Primary Text
#E6E9ED

Secondary Text
#8E98A7
```

Accent digunakan berdasarkan arti teknis.

Contoh:

```text
Blue
Normal measurement

Amber
Warning

Red
Trip / fault

Green
Healthy / active

Cyan
Selected measurement
```

Accent tidak boleh digunakan sebagai glow dekoratif.

---

# 22. Avoid AI-Style Visuals

Secara eksplisit hindari:

- giant gradients;
- purple-blue gradient;
- neon glow;
- glowing cards;
- glassmorphism berlebihan;
- floating blobs;
- blurred gradient background;
- random orbit animation;
- meaningless particles;
- huge rounded cards;
- dashboard dengan puluhan cards;
- oversized marketing typography;
- gradient CTA;
- fake AI visualization.

Elemen harus memiliki alasan fungsional.

---

# 23. Shape Language

Gunakan radius kecil.

Recommended:

```text
Panel radius:
4–8 px
```

Button:

```text
4–6 px
```

Input:

```text
4–6 px
```

Bukan:

```text
20–32 px
```

yang menghasilkan interface terlalu lembut seperti aplikasi consumer.

---

# 24. Borders

Industrial interface sangat bergantung pada struktur.

Gunakan thin borders:

```text
1 px
```

untuk:

- panel;
- parameter groups;
- tables;
- graph container;
- toolbars.

Border lebih penting daripada shadow.

---

# 25. Shadow Usage

Gunakan shadow sangat sedikit.

Avoid:

```text
giant floating shadows
```

Sebaliknya gunakan:

```text
border
surface hierarchy
spacing
```

untuk membedakan komponen.

---

# 26. Typography

Primary recommendation:

```text
Inter
IBM Plex Sans
Roboto
```

Engineering numerical data dapat menggunakan:

```text
IBM Plex Mono
JetBrains Mono
```

Contoh:

```text
CURRENT

2.485 A
```

Label:

sans-serif.

Value:

monospace.

Hal ini membuat UI terasa seperti engineering instrument.

---

# 27. Numeric Formatting

Semua engineering value harus menggunakan unit.

Wrong:

```text
2.35
```

Correct:

```text
2.35 A
```

Wrong:

```text
80
```

Correct:

```text
80 %
```

Wrong:

```text
0.4
```

Correct:

```text
0.40 Ω
```

---

# 28. Visual Status System

Gunakan status yang konsisten.

### NORMAL

```text
● NORMAL
```

### PICKUP

```text
● PICKUP
```

### WARNING

```text
▲ WARNING
```

### TRIP

```text
■ TRIP
```

### RESTRAIN

```text
● RESTRAIN
```

Status tidak boleh hanya dibedakan berdasarkan warna.

Gunakan:

- icon;
- text;
- color.

---

# 29. Differential Simulator Example

Sebagai referensi UX, simulator Differential Relay dapat mempunyai panel:

```text
SYSTEM

Primary Current 1
[ 800 A ]

Primary Current 2
[ 760 A ]


CT CONFIGURATION

CT1 Ratio
[ 1000 / 1 ]

CT2 Ratio
[ 1000 / 1 ]

CT1 Error
[ 1.0 % ]

CT2 Error
[ 2.0 % ]


DIFFERENTIAL SETTING

Minimum Pickup
[ 0.20 pu ]

Slope 1
[ 30 % ]

Breakpoint
[ 2.0 pu ]

Slope 2
[ 60 % ]
```

---

# 30. Differential Live Results

Right panel:

```text
MEASURED CURRENT

I1
0.792 A

I2
0.745 A


CALCULATED

Idiff
0.047 A

Ibias
0.769 A


RELAY

Threshold
0.231 A

State
RESTRAIN
```

---

# 31. Differential Characteristic Graph

Kurva menjadi komponen utama.

Graph harus mempunyai:

```text
Y Axis
Differential Current — Idiff

X Axis
Bias / Restraint Current — Ibias
```

Tampilkan:

- minimum pickup;
- slope 1;
- breakpoint;
- slope 2;
- additional slope;
- operating region;
- restraining region;
- current operating point.

Saat parameter berubah:

```text
Slope 1: 30 → 40 %
```

kurva harus berubah secara live.

---

# 32. Explain Calculation

User dapat membuka:

```text
CALCULATION
```

dan melihat:

```text
I1 = Primary Current / CT Ratio

I2 = Primary Current / CT Ratio

Idiff = |I1 − I2|

Ibias = f(I1, I2)

Threshold = characteristic(Ibias)

Decision:

Idiff > Threshold
→ OPERATE

Idiff ≤ Threshold
→ RESTRAIN
```

Persamaan aktual akan ditetapkan dalam engineering specification masing-masing relay.

---

# 33. Educational Layer

Simulator harus mengajarkan konsep, bukan hanya memberikan angka.

Gunakan icon:

```text
ⓘ
```

misalnya:

```text
Slope 1      ⓘ
```

Tooltip:

> Menentukan sensitivitas differential relay pada area bias rendah.

Tidak perlu membuat paragraf panjang di halaman utama.

---

# 34. Parameter Highlighting

Ketika sebuah parameter sedang diedit, bagian visual yang dipengaruhi dapat memperoleh highlight sementara.

Contoh user mengubah:

```text
CT Ratio
```

maka visual CT dan secondary current dapat mendapatkan emphasis singkat.

Ini membantu user memahami hubungan cause-and-effect.

---

# 35. Interactive Diagram

Diagram bukan gambar statis.

Elemen diagram dapat menjadi interactive.

Contoh:

```text
GENERATOR
    │
   CT1
    │
 TRANSFORMER
    │
   CT2
    │
   BUS
```

Klik `CT1`:

panel parameter otomatis membuka:

```text
CT1 CONFIGURATION
```

Klik transformer:

muncul:

```text
TRANSFORMER DATA
```

---

# 36. Fault Injection

Simulator tertentu membutuhkan fault injection.

UI dapat menggunakan:

```text
FAULT

Type
[ Phase-Phase ▼ ]

Location
[────────●────]

Resistance
[ 5 Ω ]

[ APPLY FAULT ]
```

Setelah `APPLY FAULT`:

1. fault muncul pada diagram;
2. current berubah;
3. measurement berubah;
4. relay calculation berubah;
5. operating point bergerak;
6. relay menentukan state;
7. breaker dapat trip.

---

# 37. Simulation Controls

Global simulation toolbar:

```text
▶ RUN

Ⅱ PAUSE

■ RESET
```

Untuk simulator yang tidak membutuhkan timeline, `RUN` dapat dihilangkan dan menggunakan real-time mode.

---

# 38. Scenario Presets

Setiap simulator nantinya dapat memiliki preset.

Contoh Differential:

```text
SCENARIOS

Normal Load

Internal Fault

External Fault

CT Mismatch

CT Saturation

Heavy Through Fault
```

Preset sangat berguna untuk pendidikan.

---

# 39. Reset Function

Setiap simulator wajib mempunyai:

```text
RESET
```

Reset mengembalikan:

- system parameters;
- relay settings;
- graph;
- diagram;
- simulation state;

ke konfigurasi default.

---

# 40. Homepage Module Cards

Homepage boleh mempunyai module preview, tetapi tidak menggunakan card grid generik.

Lebih baik menggunakan vertical module selector.

Contoh:

```text
01
OVERCURRENT
50 / 51
──────────────────────────
Time-current protection


02
DIFFERENTIAL
87
──────────────────────────
Current differential protection


03
DISTANCE
21
──────────────────────────
Impedance-based protection
```

Saat dipilih, informasi lengkap muncul di main workspace.

---

# 41. Homepage Responsive Behaviour

Desktop:

```text
Sidebar + Main Workspace
```

Tablet:

```text
Compact Sidebar + Main Workspace
```

Mobile:

```text
Top navigation
↓
Simulator selector
↓
Preview
```

Requirement **no-scroll homepage** terutama ditargetkan untuk desktop application experience.

Pada layar sangat kecil, usability lebih penting daripada memaksakan zero-scroll.

---

# 42. Simulator Responsive Behaviour

Desktop merupakan target utama.

Prioritas:

```text
1440 × 900
1920 × 1080
2560 × 1440
```

Tablet tetap dapat digunakan.

Smartphone dapat menyediakan simplified mode, tetapi bukan target utama untuk engineering simulation.

---

# 43. Application Header

Simulator header:

```text
← PROTECTION LAB

DIFFERENTIAL RELAY
87T

Scenario: Internal Fault

────────────────

RESET
SETTINGS
```

Header harus compact.

Target:

```text
48–60 px
```

bukan navigation bar besar.

---

# 44. Density

UI menggunakan medium-high information density.

Tujuannya mendekati software seperti:

- industrial control software;
- SCADA engineering tools;
- protection relay software;
- laboratory instrumentation.

Tetapi tetap dibuat lebih modern dan mudah digunakan.

---

# 45. Interaction Feedback

Saat user mengganti nilai:

```text
Slope
30 → 35 %
```

feedback harus langsung terlihat.

Misalnya:

- graph bergerak;
- threshold berubah;
- operating point berubah;
- result berubah.

Tidak memerlukan tombol:

```text
CALCULATE
```

untuk perubahan parameter normal.

---

# 46. Input Validation

Semua parameter membutuhkan engineering constraints.

Contoh:

```text
CT Error
Range: 0–20 %

Slope
Range: 0–200 %

Frequency
Range sesuai scenario
```

Jika value tidak valid:

```text
CT Error

[-4 %]

Invalid value.
Allowed range: 0–20 %.
```

Jangan melakukan silent correction tanpa memberitahu user.

---

# 47. Unit Handling

Arsitektur harus mendukung engineering unit.

Contoh:

```text
A
kA
V
kV
Ω
Hz
s
ms
%
pu
°
```

Value dan unit harus dipisahkan secara internal.

Contoh data model:

```text
value: 5
unit: "A"
```

bukan string:

```text
"5 A"
```

---

# 48. Simulation Accuracy Requirement

Satu prinsip penting:

> Tampilan boleh disederhanakan. Perhitungan relay tidak boleh dibuat asal untuk menghasilkan visual yang menarik.

Setiap simulator nantinya membutuhkan **Engineering Specification** sendiri.

Contoh:

```text
PRD Platform
        │
        ├── Differential Relay Engineering Spec
        ├── Overcurrent Relay Engineering Spec
        ├── Distance Relay Engineering Spec
        └── Underfrequency Relay Engineering Spec
```

Engineering Specification mendefinisikan:

- equation;
- assumptions;
- convention;
- unit;
- characteristic;
- calculation sequence;
- operating logic;
- references.

---

# 49. Technical Architecture Direction

Prototype awal dapat dibuat menggunakan:

```text
HTML
CSS
JavaScript
```

atau:

```text
HTML + Tailwind
JavaScript
Chart Library
```

Untuk produk modular yang berkembang menjadi banyak simulator, architecture yang lebih tepat nantinya:

```text
React / Next.js
        │
        ├── UI Layer
        ├── Simulation Engine
        ├── Chart Engine
        ├── Relay Modules
        └── Shared Components
```

---

# 50. Simulation Engine Separation

Calculation tidak boleh dicampur dengan UI component.

Recommended architecture:

```text
UI
 │
 ▼
Simulator Controller
 │
 ▼
Relay Calculation Engine
 │
 ├── Input validation
 ├── Unit conversion
 ├── Mathematical model
 ├── Characteristic evaluation
 └── Relay decision
 │
 ▼
Simulation State
 │
 ▼
Graph / Diagram / Result
```

Ini penting agar mathematical correctness dapat diuji secara terpisah.

---

# 51. Relay Module Architecture

Contoh struktur konseptual:

```text
simulators/

├── overcurrent/
│   ├── config
│   ├── engine
│   ├── equations
│   ├── visualization
│   └── ui
│
├── differential/
│   ├── config
│   ├── engine
│   ├── equations
│   ├── visualization
│   └── ui
│
├── distance/
│
└── underfrequency/
```

Dengan model ini, simulator baru dapat ditambahkan sebagai module.

---

# 52. Shared Design Components

Component yang dapat digunakan seluruh simulator:

```text
AppShell

SimulatorHeader

ParameterPanel

ParameterGroup

EngineeringInput

UnitSelector

StatusIndicator

ValueDisplay

CalculationPanel

ChartContainer

OneLineDiagram

ScenarioSelector

SimulationControls

Tooltip

ResetButton

HomeButton
```

Tetapi setiap simulator tetap boleh mempunyai visualisasi unik.

---

# 53. Graph Requirements

Graph harus:

- responsive;
- interactive;
- smooth;
- readable;
- zoomable jika diperlukan;
- memiliki engineering axis;
- menampilkan unit;
- memiliki grid;
- memiliki tooltip;
- mempunyai operating point;
- dapat update tanpa refresh halaman.

Hindari chart dekoratif.

---

# 54. Empty State

Jika simulator belum tersedia:

```text
DIRECTIONAL OVERCURRENT

67

Module currently under development.

Planned capabilities:
Directional characteristic
Polarization
Forward / reverse operation

COMING SOON
```

Tidak perlu membuat halaman palsu.

---

# 55. Loading State

Karena simulasi secara umum berjalan client-side, loading seharusnya sangat sedikit.

Jika diperlukan:

```text
INITIALIZING
PROTECTION MODEL
```

dengan progress minimal.

Jangan menggunakan artificial long loading animation.

---

# 56. Home Transition

Ketika user memilih Differential:

```text
02 DIFFERENTIAL
```

transisi:

```text
Homepage
   ↓
sidebar selection
   ↓
workspace fade/slide
   ↓
Differential simulator loaded
```

Target sekitar:

```text
200–350 ms
```

Tidak menggunakan full-screen cinematic animation.

---

# 57. URL State

Simulator harus mempunyai URL sendiri.

Contoh:

```text
/simulator/differential
```

sehingga halaman dapat:

- bookmarked;
- refreshed;
- dibagikan;
- diakses secara langsung.

---

# 58. Browser Behaviour

Refresh pada:

```text
/simulator/differential
```

harus tetap membuka Differential Simulator.

Jangan kembali ke homepage akibat refresh.

---

# 59. Accessibility

Minimal:

- keyboard navigation;
- visible focus state;
- sufficient text contrast;
- status tidak hanya bergantung pada warna;
- readable font size;
- tooltip dapat diakses;
- form input mempunyai label.

---

# 60. Performance

Target pengalaman:

- homepage terasa instant;
- perubahan parameter terasa real-time;
- chart tidak lag;
- animation tetap smooth;
- perubahan input tidak menyebabkan rerender besar seluruh application.

Calculation engine harus deterministic dan ringan.

---

# 61. Design Anti-Patterns

Dilarang menggunakan pola:

```text
20 rounded statistic cards

gradient everywhere

giant hero heading

floating neon objects

AI-style purple glow

glass panels everywhere

random abstract particles

scroll-driven animations

marketing-style CTA sections

excessive shadows
```

Produk ini merupakan engineering simulator, bukan landing page startup.

---

# 62. Desired Interface Character

Interface harus terasa:

```text
Precise
Technical
Structured
Responsive
Industrial
Professional
Modern
Calm
Dense but readable
```

Bukan:

```text
Playful
Flashy
Futuristic
AI-looking
Gaming
Decorative
```

---

# 63. Proposed Homepage Wireframe

```text
┌────────────────────────────────────────────────────────────────────┐
│ PROTECTION LAB                                    SYSTEM ● ONLINE │
├──────────────────┬─────────────────────────────────────────────────┤
│                  │                                                 │
│ SYSTEM           │  POWER SYSTEM PROTECTION                        │
│ PROTECTION       │  SIMULATION LAB                                 │
│                  │                                                 │
│ OVERVIEW         │  Explore protection relay behaviour through     │
│                  │  interactive engineering simulations.           │
│ RELAYS           │                                                 │
│                  │        SOURCE                                   │
│ 01 Overcurrent   │          │                                      │
│                  │        [CT]                                     │
│ 02 Differential ●│          │                                      │
│                  │    [TRANSFORMER]                                │
│ 03 Distance      │          │                                      │
│                  │        [CT]                                     │
│ 04 Frequency     │          │                                      │
│                  │       [RELAY]                                   │
│ ──────────────── │                                                 │
│                  │                                                 │
│ MODULES          │  SELECTED MODULE                                │
│ 04 ACTIVE        │                                                 │
│                  │  DIFFERENTIAL PROTECTION / 87                   │
│                  │  [ OPEN SIMULATOR → ]                           │
└──────────────────┴─────────────────────────────────────────────────┘
```

Tidak terdapat page-scroll pada desktop.

---

# 64. Proposed Differential Simulator Wireframe

```text
┌─────────────────────────────────────────────────────────────────────┐
│ ← HOME    DIFFERENTIAL RELAY / 87T                  ● LIVE         │
├─────────────────┬──────────────────────────┬────────────────────────┤
│ PARAMETERS      │ SYSTEM                   │ RELAY ANALYSIS         │
│                 │                          │                        │
│ SYSTEM          │ Source                   │ STATUS                 │
│ I1    800 A     │   │                      │ ● RESTRAIN             │
│ I2    760 A     │  CT1                     │                        │
│                 │   │                      │ DIFFERENTIAL CURRENT   │
│ CT              │ Transformer             │ 0.047 A                │
│ CT1   1000/1    │   │                      │                        │
│ CT2   1000/1    │  CT2                     │ BIAS CURRENT           │
│                 │   │                      │ 0.769 A                │
│ ERROR           │ Relay                    │                        │
│ CT1    1 %      │                          │ THRESHOLD              │
│ CT2    2 %      ├──────────────────────────┤ 0.231 A                │
│                 │ CHARACTERISTIC           │                        │
│ SETTING         │                          │ CALCULATION            │
│ Pickup 0.2 pu   │ Idiff                    │                        │
│ Slope1 30 %     │   │        OPERATE       │ I1 = ...               │
│ Slope2 60 %     │   │       /              │ I2 = ...               │
│                 │   │     /  ●             │ Idiff = ...            │
│                 │   │___/________ Ibias    │ Ibias = ...            │
│                 │                          │                        │
│ [RESET]         │                          │                        │
└─────────────────┴──────────────────────────┴────────────────────────┘
```

---

# 65. UX Success Criteria

Produk dianggap berhasil apabila user baru dapat:

1. menemukan simulator yang diinginkan dalam beberapa detik;
2. memahami parameter utama tanpa membaca manual panjang;
3. mengubah suatu parameter;
4. langsung melihat pengaruhnya;
5. memahami mengapa operating point berubah;
6. mengetahui apakah relay trip atau restrain;
7. kembali ke homepage dengan mudah;
8. berpindah simulator tanpa kebingungan.

---

# 66. Engineering Success Criteria

Untuk setiap simulator:

- formula terdokumentasi;
- satuan konsisten;
- parameter dependency jelas;
- hasil reproducible;
- calculation engine dapat diuji;
- decision logic dapat diverifikasi;
- grafik sesuai persamaan;
- operating point sesuai calculation engine.

---

# 67. MVP

MVP sebaiknya tidak langsung membuat seluruh relay.

Tahap pertama:

```text
Protection Simulator Shell
        │
        ├── Homepage
        │
        ├── Navigation System
        │
        ├── Shared UI Components
        │
        └── Differential Relay Simulator
```

Differential Relay digunakan sebagai **reference simulator**.

Jika:

- layout;
- interaction;
- calculation pattern;
- chart system;
- visualization;
- animation;

sudah matang pada Differential Simulator, pola tersebut dapat digunakan sebagai dasar simulator lain.

---

# 68. Phase 2

Setelah Differential:

```text
Overcurrent Relay
```

ditambahkan.

Fokus:

- current pickup;
- inverse characteristics;
- TMS;
- trip time;
- TCC curve.

---

# 69. Phase 3

Tambahkan:

```text
Distance Relay
```

Fokus:

- R-X diagram;
- fault position;
- zone protection;
- impedance calculation.

---

# 70. Phase 4

Tambahkan:

```text
Underfrequency Relay
```

Fokus:

- frequency decay;
- stage pickup;
- timer;
- load shedding visualization.

---

# 71. Development Principle

Jangan mengembangkan banyak simulator secara bersamaan sebelum design system dan simulation architecture stabil.

Urutan yang disarankan:

```text
1. Application Shell
2. Homepage UX
3. Simulator Layout
4. Differential Engineering Model
5. Differential UI
6. Interactive Curve
7. Simulation Animation
8. Validation
9. Shared Component Extraction
10. Additional Relay Modules
```

---

# 72. Final Product Identity

Website harus memberikan kesan:

> **“Virtual Protection Engineering Laboratory.”**

Ketika user membuka aplikasi, mereka seharusnya tidak merasa sedang melihat sebuah website biasa.

Mereka harus merasa sedang membuka sebuah **protection engineering workstation**.

Visual hierarchy:

```text
ENGINEERING DATA
      >
SIMULATION
      >
VISUALIZATION
      >
EXPLANATION
      >
DECORATION
```

Dengan demikian estetika tetap kuat, tetapi tidak pernah mengorbankan fungsi engineering.

---

# 73. Product North Star

Seluruh keputusan UI, UX, animation, dan engineering harus kembali kepada satu pertanyaan:

> **“Apakah perubahan yang dilakukan membantu user memahami mengapa relay mengambil keputusan tersebut?”**

Jika jawabannya tidak, fitur atau elemen tersebut kemungkinan tidak perlu berada di simulator.
