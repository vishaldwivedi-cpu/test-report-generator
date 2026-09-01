import {
  pgTable,
  serial,
  text,
  timestamp,
  date,
  integer,
  numeric,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

// One row per uploaded CSV file. Deleting a row here (and its records)
// makes the file "disappear" from the next generated report, mirroring
// the "CSV folder is the single source of truth" rule of the original
// Python automation script.
export const uploadedFiles = pgTable(
  "uploaded_files",
  {
    id: serial("id").primaryKey(),
    filename: text("filename").notNull(),

    // NEET | JEE
    exam: text("exam").notNull(),
    // NEET | JEE_MAIN | JEE_ADVANCED
    track: text("track").notNull(),
    // 11TH | 12TH | DROPPER | UNKNOWN
    classLevel: text("class_level").notNull(),
    // TEST | AITS | UNIVERSE
    family: text("family").notNull(),
    // P1 | P2 | COMBINED | '' (advanced only)
    component: text("component").notNull().default(""),

    testDate: date("test_date").notNull(),

    status: text("status").notNull().default("OK"),
    errorMessage: text("error_message"),

    rawRowCount: integer("raw_row_count").notNull().default(0),
    uniqueRegistrations: integer("unique_registrations").notNull().default(0),
    blankRegistrations: integer("blank_registrations").notNull().default(0),
    qaIssues: jsonb("qa_issues").$type<{ issueType: string; registrationNo: string; details: string }[]>().notNull().default([]),

    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("uploaded_files_track_idx").on(table.exam, table.track, table.classLevel),
  ],
);

// One row per student per uploaded file (standardized / normalized shape).
// Advanced Physics/Chemistry/Maths/Total/Rank columns are prefixed so a
// single file can either be a "combined" advanced file (Paper 1 / Paper 2
// totals only) or a "per-paper" advanced file (subject-wise marks for one
// paper). Everything else (NEET, JEE Main) uses the plain columns.
export const testRecords = pgTable(
  "test_records",
  {
    id: serial("id").primaryKey(),
    fileId: integer("file_id")
      .notNull()
      .references(() => uploadedFiles.id, { onDelete: "cascade" }),

    registrationNo: text("registration_no").notNull(),
    studentName: text("student_name"),
    vertical: text("vertical"),
    region: text("region"),
    center: text("center"),

    rank: numeric("rank"),
    total: numeric("total"),

    physics: numeric("physics"),
    chemistry: numeric("chemistry"),
    maths: numeric("maths"),
    botany: numeric("botany"),
    zoology: numeric("zoology"),

    paper1: numeric("paper1"),
    paper2: numeric("paper2"),

    p1Physics: numeric("p1_physics"),
    p1Chemistry: numeric("p1_chemistry"),
    p1Maths: numeric("p1_maths"),
    p1Total: numeric("p1_total"),
    p1Rank: numeric("p1_rank"),

    p2Physics: numeric("p2_physics"),
    p2Chemistry: numeric("p2_chemistry"),
    p2Maths: numeric("p2_maths"),
    p2Total: numeric("p2_total"),
    p2Rank: numeric("p2_rank"),
  },
  (table) => [
    index("test_records_file_idx").on(table.fileId),
    index("test_records_reg_idx").on(table.registrationNo),
  ],
);
