# Test Planner (Auto) — 12th JEE

Ye doc us Google Sheet tab ka reference hai jo `Srinagar 12th JEE Pedagogy 2026-2027`
spreadsheet me bana hai.

**Sheet:** https://docs.google.com/spreadsheets/d/1GfhsHuiExBt4Uq9OZ74HmSUZWo6bHYcM-ThktXjqNJ8/edit#gid=394939899
**Tab:** `Test Planner (Auto)` (gid `394939899`)
**Helper tab:** `Lecture Counts (JEE)` (gid `637879052`) — chapter-wise lecture / subtopic counts

## Business rules jo implement hue hain

| # | Rule | Kahan set hota hai |
|---|------|--------------------|
| 1 | Pehla test = session start + **30 din** | `B7` |
| 2 | Uske baad **har 14 din** ek test | `B6` |
| 3 | **Sunday pe bhi test hoga** (koi weekday shift nahi) | — (fixed) |
| 4 | Test ka syllabus test date se **7 din pehle tak** complete hona chahiye | `B8` |
| 5 | Syllabus source = **Lecture Planner** tab ke 12th JEE chapter **END DATE** | auto |
| 6 | MT → MT → CT pattern (MT-1, MT-2 → CT-1, MT-3, MT-4 → CT-2, …) | auto |
| 7 | MT = MAIN (150 marks), CT = ADVANCED P1+P2 (360 marks) | `B12`, `B13` |
| 8 | **Har MT ka syllabus alag (distinct)** — jo chapter kisi pehle MT me aa chuka, dobara kisi MT me nahi aayega | auto |
| 9 | **CT = pichhle 2 MT ka jod** — CT-1 = MT-1 + MT-2, CT-2 = MT-3 + MT-4, … | auto |
| 10 | Syllabus khatam hone ke baad bache tests **full revision** ban jaate hain | auto |

`B9` (Number of tests) badalne se poora schedule expand / shrink ho jaata hai.
`B5` (Session start) badalne se saari dates shift ho jaati hain.

## Syllabus kaise nikalta hai

Har test ke liye ek **syllabus window** hoti hai:

```
window end   = Test Date − 7 din                      ("Syllabus Lock Date")
window start = pichhle test ki Lock Date
               (pehle test ke liye = session start − 1 din)
```

Window nikalne ka rule (helper column `T`):

| Test ka type | Window start |
|---|---|
| MT-1 (pehla test) | `B5 − 1` |
| MT (2nd of pair) | previous test ki Lock Date |
| MT (1st of pair, n>1) | Lock date of (n−2) |
| CT (n) | Lock date of (n−3) → isse CT ka window = dono MT ke windows ka jod |

Kyuki window start `>` (strict) se filter hota hai, ek hi chapter do baar kabhi
nahi aata → **distinct syllabus** automatically guarantee ho jaata hai, aur CT
me exactly apne do MT ke chapters aate hain.

Agar lock date tak koi naya chapter complete nahi hota **aur** syllabus abhi
khatam nahi hua, to cell `—` dikhata hai (us subject me us test ke liye kuch
naya nahi). Agar saara syllabus khatam ho chuka hai, to cell `🔁 <poora syllabus>`
dikhata hai aur status `🔁 Syllabus khatam — full revision` ho jaata hai.

## Tab ka structure

| Rows | Content |
|------|---------|
| 1–2 | Title + rule summary |
| 4–14 | ⚙️ SETTINGS (sirf column `B` edit karo) + 📋 cycle rule reference |
| 15 | 📊 Summary line (auto) |
| 16 | 🗓️ Schedule section heading |
| 17 | Column headers (`A`–`R`) |
| 18–137 | **Test schedule (auto-generated, 120 rows tak capacity)** |
| 139–185 | 📚 Chapter index — Lecture Planner se auto-pulled (`FILTER`) |

### Schedule columns (A–R)

| Col | Header | Kya hai |
|-----|--------|---------|
| A | Test No. | 1…B9 |
| B | Test | MT-1, MT-2, CT-1, … |
| C | Type | Milestone / Cumulative |
| D | Pattern | MAIN / ADVANCED (P1+P2) |
| E | Test Date | auto (start + 30 + 14·(n−1)) |
| F | Day | weekday |
| G | Syllabus Lock Date (−7) | E − B8 |
| H | Physics | us test ke chapters |
| I | Chemistry | us test ke chapters |
| J | Maths | us test ke chapters |
| K | # Chapters | us test me kitne chapters |
| L | # Lectures | chapter index ke lecture counts ka sum |
| M | Status | ✅ / 🔁 |
| N | Test Name (report mapping) | `Srinagar 12th JEE \| MT-3 \| 24-Feb-2027 \| MAIN` |
| O | This test adds | `Alag syllabus (sirf naya)` / `= MT-1 + MT-2` / `Full syllabus revision` |
| P | Mode | OMR / Offline |
| Q | Max Marks | 150 / 360 |
| R | Syllabus window start | `T` ka visible copy |

Hidden helper columns: `S` (window end), `T` (window start), `U` (naye chapters ka count).

## Formulas — key logic

Schedule numbers:

```gs
=ARRAYFORMULA(IF(ROW($A$18:$A$137)-17<=$B$9,(ROW($A$18:$A$137)-17),""))
```

Window start (`T18`):

```gs
=MAP($A$18:$A$137,LAMBDA(n,IF(n="","",
  IF(MOD(n,3)=0, IF(n=3,$B$5-1,INDEX($G$18:$G$137,n-4)),
  IF(MOD(n,3)=1, IF(n=1,$B$5-1,INDEX($G$18:$G$137,n-2)),
                 INDEX($G$18:$G$137,n-1))))))
```

Subject syllabus (Physics; Chemistry/Maths me sirf subject name badalta hai):

```gs
=MAP($A$18:$A$137,$S$18:$S$137,$T$18:$T$137,
  LAMBDA(n,wend,wstart,IF(n="","",
    IFERROR(TEXTJOIN(", ",TRUE,FILTER($C$141:$C$185,
      ($B$141:$B$185="Physics")*(ISNUMBER($E$141:$E$185))
      *($E$141:$E$185<=wend)*($E$141:$E$185>wstart))),
      IF(wend>=MAX($E$141:$E$185),
         "🔁 "&TEXTJOIN(", ",TRUE,FILTER($C$141:$C$185,$B$141:$B$185="Physics")),
         "—")))))
```

Lecture count (chapter index `D` column, `Lecture Counts (JEE)` se lookup):

```gs
=MAP($C$141:$C$185,$B$141:$B$185,LAMBDA(c,s,IF(c="","",
   IFERROR(INDEX('Lecture Counts (JEE)'!$C$5:$C$60,
     MATCH(c&"|"&s,'Lecture Counts (JEE)'!$F$5:$F$60,0)),""))))
```

## Dhyan rakhne wali baatein

- `Lecture Planner` ka chapter data `TOOL JEE` tab ke `FILTER` formulas se aata
  hai. Agar `TOOL JEE` me batch/holiday settings badalte ho, to is planner ki
  chapter dates bhi khud update ho jaayengi.
- Chapter index ka range `Lecture Planner!9:56` hai (45 chapters). Naye chapters
  add karne ho to ye range badhana padega — `$141:$185` aur `$9:$56` dono.
- `Lecture Counts (JEE)` ke chapter names **planner ki spelling** me hain
  (`POLYMERS`, `SURFACE CHEMISTRY`, `Salt analysis`, …), kyunki lookup key
  `chapter|subject` se banti hai.
- Schedule ka capacity 120 tests hai (`A18:A137`). Isse zyada chahiye to range
  extend karo.
