// One-shot: print every FK referencing auth.users(id) in public.* with its
// delete action, using pg_catalog (information_schema misses cross-schema FKs
// in Supabase for non-owner roles). Run from backend/.
//
// Usage:  DATABASE_URL=... node scripts/verify-cascade-fks.mjs
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL not set");

const sql = postgres(url, { prepare: false, ssl: "require" });

const rows = await sql`
  SELECT
    child_ns.nspname  AS child_schema,
    child.relname     AS child_table,
    a.attname         AS child_column,
    CASE c.confdeltype
      WHEN 'a' THEN 'NO ACTION'
      WHEN 'r' THEN 'RESTRICT'
      WHEN 'c' THEN 'CASCADE'
      WHEN 'n' THEN 'SET NULL'
      WHEN 'd' THEN 'SET DEFAULT'
    END AS delete_rule
  FROM pg_constraint c
  JOIN pg_class child
    ON child.oid = c.conrelid
  JOIN pg_namespace child_ns
    ON child_ns.oid = child.relnamespace
  JOIN pg_class parent
    ON parent.oid = c.confrelid
  JOIN pg_namespace parent_ns
    ON parent_ns.oid = parent.relnamespace
  JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS ck(attnum, ord) ON TRUE
  JOIN pg_attribute a
    ON a.attrelid = child.oid
   AND a.attnum = ck.attnum
  WHERE c.contype = 'f'
    AND parent_ns.nspname = 'auth'
    AND parent.relname = 'users'
    AND child_ns.nspname = 'public'
  ORDER BY child.relname, a.attname;
`;

if (rows.length === 0) {
  console.log("(no public.* FKs reference auth.users)");
} else {
  for (const r of rows) {
    console.log(`${r.child_schema}.${r.child_table}(${r.child_column}) → auth.users ON DELETE ${r.delete_rule}`);
  }
}

await sql.end();
