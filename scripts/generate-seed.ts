// Regenerates supabase/seed.sql from the sample data set (src/lib/data/sample.ts).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildSampleDataset } from "../src/lib/data/sample";
import { renderSeedSql } from "../src/lib/data/seedSql";

const target = fileURLToPath(new URL("../supabase/seed.sql", import.meta.url));
async function main() {
  const sql = renderSeedSql(await buildSampleDataset());
  writeFileSync(target, sql);
  console.log(`Wrote ${target}`);
}

void main();
