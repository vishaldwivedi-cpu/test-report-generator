# Test Planner (Auto) — 12th JEE

Ye doc us Google Sheet tab ka reference hai jo `Srinagar 12th JEE Pedagogy 2026-2027`
spreadsheet me bana hai.

**Sheet:** https://docs.google.com/spreadsheets/d/1GfhsHuiExBt4Uq9OZ74HmSUZWo6bHYcM-ThktXjqNJ8/edit#gid=394939899
**Tab:** `Test Planner (Auto)` (gid `394939899`)

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

`B9` (Number of tests) badalne se poora schedule expand / shrink ho jaata hai.
`B5` (Session start) badalne se saari dates shift ho jaati hain.

## Syllabus kaise nikalta hai

Har test ke liye ek **syllabus window** hoti hai:

```
window start = pichhle test ki date   (pehle test ke liye = session start − 1 din)
window end   = Test Date − 7 din      ("Syllabus Lock Date")
```

Us window me jitne chapters ka **END DATE** (Lecture Planner se) padta hai, wahi
chapters us test me aate hain — subject-wise alag-alag calculate hote hain.

Agar lock date tak koi naya chapter complete nahi hota, to status
`⚠ Lock date tak koi naya chapter complete nahi` dikhta hai — matlab us test me
dene ke liye naya syllabus nahi bacha (revision / full-syllabus test plan karo).

## Tab ka structure

| Rows | Content |
|------|---------|
| 1–2 | Title + rule summary |
| 4–14 | ⚙️ SETTINGS (sirf column `B` edit karo) + 📋 cycle rule reference |
| 15 | 📊 Summary line (auto) |
| 16 | 🗓️ Schedule section heading |
| 17 | Column headers |
| 18–137 | **Test schedule (auto-generated, 120 rows tak capacity)** |
| 139–185 | 📚 Chapter index — Lecture Planner se auto-pulled (`FILTER`) |

### Schedule columns

`Test No. | Test | Type | Pattern | Test Date | Day | Syllabus Lock Date (−7) |
Physics | Chemistry | Maths | # Chapters | Status | Test Name (report mapping) |
Syllabus window start | Mode | Max Marks | Cumulative of`

`Test Name (report mapping)` column (M) isliye hai taaki report generator ko pata
chale kaunsi CSV kis test se map karni hai — e.g. `MT-3 MAIN`, `CT-1 ADVANCED`.

## Formulas — key logic

Row 18 ka `A` column schedule numbers generate karta hai:

```gs
=ARRAYFORMULA(IF(ROW($A$18:$A$137)-17<=$B$9,(ROW($A$18:$A$137)-17),""))
```

Test name (MT / CT numbering):

```gs
=ARRAYFORMULA(IF($A$18:$A$137="","",
  IF($C$18:$C$137="Cumulative",
     "CT-"&COUNTIFS($C$18:$C$137,"Cumulative",ROW($C$18:$C$137),"<="&ROW($C$18:$C$137)),
     "MT-"&COUNTIFS($C$18:$C$137,"Milestone",ROW($C$18:$C$137),"<="&ROW($C$18:$C$137)))))
```

Subject-wise syllabus (Physics; Chemistry/Maths me sirf subject name badalta hai):

```gs
=MAP($A$18:$A$137,$G$18:$G$137,$N$18:$N$137,
  LAMBDA(n,lock,start,IF(n="","",
    IFERROR(IF(TEXTJOIN(", ",TRUE,FILTER($C$141:$C$185,
      ($B$141:$B$185="Physics")*(ISNUMBER($E$141:$E$185))
      *($E$141:$E$185<=lock)*($E$141:$E$185>start)))="","—",
      TEXTJOIN(", ",TRUE,FILTER($C$141:$C$185,
        ($B$141:$B$185="Physics")*(ISNUMBER($E$141:$E$185))
        *($E$141:$E$185<=lock)*($E$141:$E$185>start)))),"—"))))
```

Chapter index (Lecture Planner se live pull — `TOOL JEE` ke formulas resolve
hone ke baad dates aati hain, isliye `ISNUMBER` guard lagaya hai):

```gs
=IFERROR(ARRAYFORMULA(FILTER('Lecture Planner'!$C$9:$C$56,
   ISNUMBER('Lecture Planner'!$H$9:$H$56),'Lecture Planner'!$C$9:$C$56<>"")),"")
```

## Dhyan rakhne wali baatein

- `Lecture Planner` ka chapter data `TOOL JEE` tab ke `FILTER` formulas se aata
  hai. Agar `TOOL JEE` me batch/holiday settings badalte ho, to is planner ki
  chapter dates bhi khud update ho jaayengi.
- Chapter index ka range `Lecture Planner!9:56` hai (45 chapters). Naye chapters
  add karne ho to ye range badhana padega — `$141:$185` aur `$9:$56` dono.
- Schedule ka capacity 120 tests hai (`A18:A137`). Isse zyada chahiye to range
  extend karo.
