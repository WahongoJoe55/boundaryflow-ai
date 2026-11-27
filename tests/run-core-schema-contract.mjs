import fs from "node:fs";
import assert from "node:assert/strict";
const path = "supabase/migrations/20261110000100_core_application_baseline.sql";
const sql = fs.readFileSync(path, "utf8");
const required = [
 "CREATE TABLE public.profiles","CREATE TABLE public.projects","CREATE TABLE public.agreements","CREATE TABLE public.analyses",
 "REFERENCES auth.users(id) ON DELETE CASCADE","REFERENCES public.projects(id) ON DELETE CASCADE",
 "REFERENCES public.agreements(id) ON DELETE SET NULL","DEFAULT auth.uid()","DEFAULT gen_random_uuid()",
 "projects_user_updated_idx","agreements_user_project_idx","analyses_user_project_idx",
 "ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY","ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY",
 "ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY","ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY",
 "CREATE POLICY profiles_insert_own","CREATE POLICY projects_insert_own","CREATE POLICY agreements_insert_own",
 "CREATE POLICY analyses_insert_own","TO authenticated","GRANT SELECT, INSERT, UPDATE, DELETE"
];
for (const part of required) assert.ok(sql.includes(part), `baseline missing: ${part}`);
assert.equal((sql.match(/CREATE TABLE public\./g)||[]).length,4,"exactly four core tables");
assert.equal((sql.match(/CREATE POLICY /g)||[]).length,15,"all 15 production policies");
assert.ok(!/CREATE TABLE IF NOT EXISTS/i.test(sql),"must fail closed on pre-existing tables");
assert.ok(!/FORCE ROW LEVEL SECURITY/i.test(sql),"preserve production RLS force setting");
assert.ok(!/CREATE TRIGGER/i.test(sql),"no triggers were found in production metadata");
console.log("Core schema baseline contract: PASS (4 tables, 15 policies, RLS, defaults, constraints and indexes)");
