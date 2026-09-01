/** Competition ranking (like pandas `.rank(method="min", ascending=False)`):
 * highest value gets rank 1, ties share the same (lowest) rank, and the
 * next distinct value's rank skips the tied count. Nulls are left as null.
 */
export function competitionRankDesc(values: (number | null)[]): (number | null)[] {
  const indexed = values
    .map((v, i) => ({ v, i }))
    .filter((x) => x.v !== null) as { v: number; i: number }[];

  indexed.sort((a, b) => b.v - a.v);

  const ranks = new Array<number | null>(values.length).fill(null);
  let rank = 0;
  let seen = 0;
  let prevValue: number | null = null;

  for (const { v, i } of indexed) {
    seen += 1;
    if (prevValue === null || v !== prevValue) {
      rank = seen;
      prevValue = v;
    }
    ranks[i] = rank;
  }

  return ranks;
}
