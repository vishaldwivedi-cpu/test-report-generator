# Test Planner (Auto) — Srinagar 12th JEE 2026-2027

Fully-automatic JEE test schedule built inside the Google Sheet
**Srinagar 12th JEE Pedagogy 2026-2027**
(`1GfhsHuiExBt4Uq9OZ74HmSUZWo6bHYcM-ThktXjqNJ8`, TZ Asia/Calcutta).

Tab: **`Test Planner (Auto)`** — sheet id `394939899`, 320 × 26, frozen 18 rows / 2 cols.

---

## 1. Settings (`A4:B15`) — the only cells a human edits

| Cell | Meaning | Value |
|---|---|---|
| `B5` | Session start | 2026-12-14 |
| `B6` | Gap between tests (days) | 14 |
| `B7` | 1st test after start (days) | 30 |
| `B8` | Syllabus lock (days before test) | 7 |
| `B9` | **LAST test date** | 2027-08-07 |
| `B10` | **Number of tests (AUTO)** | `=1+CEILING(($B$9-($B$5+$B$7))/$B$6)` → **16** |
| `B11` | Pattern cycle | MAIN, MAIN, ADVANCED (P1+P2) |
| `B12` | Marks MAIN | 150 |
| `B13` | Marks ADVANCED (P1+P2) | 360 |

Test count is **derived**, never hardcoded: change `B5`/`B6`/`B9` and every
date, serial, syllabus window and test name recomputes.

`A15` holds the live summary line (total tests, first test, last test +
REVISION flag, revision count, chapter split).

## 2. Generated result (16 tests)

- First test **13-Jan-2027** = session start + 30 din.
- Last test **07-Aug-2027**, type **REVISION**, full syllabus (45 chapters).
- Pattern rows: MT, MT, CT, MT, MT, CT, … MT-1…MT-10, CT-1…CT-5, REVISION.

| # | Test | Type | Date | Lock (−7) |
|---|------|------|------|-----------|
| 1 | MT-1 | Milestone | 13-Jan-2027 | 06-Jan-2027 |
| 2 | MT-2 | Milestone | 27-Jan-2027 | 20-Jan-2027 |
| 3 | CT-1 | Cumulative | 10-Feb-2027 | 03-Feb-2027 |
| 4 | MT-3 | Milestone | 24-Feb-2027 | 17-Feb-2027 |
| 5 | MT-4 | Milestone | 10-Mar-2027 | 03-Mar-2027 |
| 6 | CT-2 | Cumulative | 24-Mar-2027 | 17-Mar-2027 |
| 7 | MT-5 | Milestone | 07-Apr-2027 | 31-Mar-2027 |
| 8 | MT-6 | Milestone | 21-Apr-2027 | 14-Apr-2027 |
| 9 | CT-3 | Cumulative | 05-May-2027 | 28-Apr-2027 |
| 10 | MT-7 | Milestone | 19-May-2027 | 12-May-2027 |
| 11 | MT-8 | Milestone | 02-Jun-2027 | 26-May-2027 |
| 12 | CT-4 | Cumulative | 16-Jun-2027 | 09-Jun-2027 |
| 13 | MT-9 | Milestone | 30-Jun-2027 | 23-Jun-2027 |
| 14 | MT-10 | Milestone | 14-Jul-2027 | 07-Jul-2027 |
| 15 | CT-5 | Cumulative | 28-Jul-2027 | 21-Jul-2027 |
| 16 | REVISION | Revision | 07-Aug-2027 | 31-Jul-2027 |

## 3. Column map (`A`–`U`, headers row 17, data rows 18–137)

| Col | Content |
|---|---|
| A | Test No. (count-driven serial) |
| B | Test name (MT-n / CT-n / REVISION) |
| C | Type (Milestone / Cumulative / REVISION) |
| D | Pattern (MAIN / ADVANCED (P1+P2), every 3rd = ADVANCED) |
| E | Test date (Sunday-aligned series, last cell forced to `B9`) |
| F | Day |
| G | Syllabus lock date = `E − B8` |
| H | **Physics** syllabus |
| I | **Chemistry** syllabus |
| J | **Maths** syllabus |
| K | # Chapters in window |
| L | # Lectures in window |
| M | Status (`✅ 7-din rule pass` / `🔁 Full revision`) |
| N | Test Name for report mapping (`Srinagar 12th JEE \| MT-3 \| 24-Feb-2027 \| MAIN`) |
| O | This test adds (distinct syllabus / CT union / full revision) |
| P | Mode (OMR / OMR P1+P2) |
| Q | Max marks (from `B12` / `B13`) |
| R | Syllabus window start |
| S | Window END (hidden helper) |
| T | Window START (hidden helper) |
| U | New-chapter count (hidden helper) |

## 4. Syllabus logic (H / I / J)

One `MAP` spill formula per subject in `H18` / `I18` / `J18`, spilled over
`$A$18:$A$137` with the window `$T` (start) → `$S` (end):

```
=MAP($A$18:$A$137,$S$18:$S$137,$T$18:$T$137,LAMBDA(n,wend,wstart,
   IF(n="","",
   IF(n=$B$10, <all chapters of the subject>,          ' last test = full revision
   IFERROR(TEXTJOIN(", ",TRUE,
      FILTER($C$141:$C$185, subject*ISNUMBER($E)*($E<=wend)*($E>wstart))),
   IFERROR("⏳ Chal raha hai:"&CHAR(10)&TEXTJOIN(CHAR(10),TRUE,
      FILTER("• "&'Subtopics (12th JEE)'!$B$3:$B$1000,
             subject*ISNUMBER(I)*(I<=wend)*(I>wstart))),
   "—"))))))
```

- **Chapter branch** — chapters whose *end date* (`$E$141:$E$185`, from the
  chapter index) falls in the window → the whole chapter is "covered".
- **Blank branch (user's rule)** — when no chapter completes in the window,
  the cell shows the **subtopics** covered up to the 7-day lock date, pulled
  live from `Subtopics (12th JEE)` and prefixed `⏳ Chal raha hai:`.
  Filtering is on the **cover-date column I** of that tab (not the
  chapter-level START/END), so a chapter that is only half-taught contributes
  only the lectures already delivered.
- **Last test** (`n = $B$10`) dumps every chapter of the subject → revision.

### Windows (S = window END, T = window START)

- MT rows: window = previous MT/CT lock → this test's lock.
- CT rows: window = lock of the MT two rows up → this test's lock
  (i.e. **union of the previous 2 MTs**, which is what O shows as text).
- REVISION row: `S = MAX($E$141:$E$185)` so the whole course is in range.

## 5. Chapter index (`A139:J185`, hidden helper block)

`H` = chapter start date, `I` = subtopic count, `J` = exact source-sheet
chapter name (static 45-row map, `J141:J185`), `E` = chapter end date,
`D` = lecture count, `C` = chapter name, `B` = subject.

Chapter end dates come from the **Lecture Planner → 12th JEE** rows; the
45 chapters are Phy 14 / Chem 17 / Maths 14, ending **03-Aug-2027**.

## 6. Support tabs

| Tab | id | Role |
|---|---|---|
| `Lecture Counts (JEE)` | 637879052 | `A5:F49` — subject, chapter, lecture count, subtopic count, topics, `Key = Chapter\|Subject` |
| `Subtopics (12th JEE)` | 1409133609 | 2000×14, frozen 3. `A3` = live `QUERY` over the three JEE source tabs → `A:D` Chapter/Subtopic/Subject/Lec No.; `E` START, `F` END, `G` Lec(n), `H` Label, `I` **cover date** |
| `Copy of JEE Physics / Chemistry / Math` | 1650991468 / 388463990 / 1892701278 | hidden local import sources for the QUERY |

### Cover-date math (column `I` of `Subtopics (12th JEE)`)

```
cover = E + (G-1)/chapterLectures × (F - E)
```

`E`/`F` = the chapter's START / END dates, `G` = the lecture number of that
subtopic inside the chapter, `chapterLectures` looked up from
`Test Planner (Auto)!D141:D185` via the source-name map.
Verified on Electrostatics: ECF rows 46370 / 46384 / 1 → cover 46370.

## 7. Notes / gotchas

- `LET` and nested `MAP`+`JOIN`/`SEARCH` reliably break in this workbook —
  the working pattern is `MAP` + `FILTER` + `TEXTJOIN`, everything wrapped in
  `IFERROR`.
- Writes must stay inside the grid width; expand with `update_sheet_properties`
  before writing to a column beyond the current count.
- `update_sheet_properties` resets other tabs' `hidden` flag when omitted —
  re-verify `TOOL JEE` (1603918877) stays hidden after every call.
- The hidden `Holidays` / `Holiday` tabs are **not** used; tests are never
  shifted off their Sunday date.
