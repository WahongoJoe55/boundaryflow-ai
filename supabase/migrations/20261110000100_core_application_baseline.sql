-- BoundaryFlow core application baseline.
-- Reconstructed from read-only production schema metadata and checked against
-- current browser application Supabase insert/select usage.
-- Fresh staging projects only. Plain CREATE TABLE statements intentionally
-- fail if any target table already exists; this is not an overwrite migration.
BEGIN;
CREATE TABLE public.profiles (
 id uuid NOT NULL, display_name text, created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT profiles_pkey PRIMARY KEY (id),
 CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);
CREATE TABLE public.projects (
 id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
 name text NOT NULL, client_name text, status text NOT NULL DEFAULT 'active'::text,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT projects_pkey PRIMARY KEY (id),
 CONSTRAINT projects_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
 CONSTRAINT projects_name_check CHECK (char_length(btrim(name)) >= 1 AND char_length(btrim(name)) <= 160),
 CONSTRAINT projects_client_name_check CHECK (client_name IS NULL OR char_length(client_name) <= 160),
 CONSTRAINT projects_status_check CHECK (status = ANY (ARRAY['active'::text, 'archived'::text]))
);
CREATE TABLE public.agreements (
 id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
 project_id uuid NOT NULL, title text NOT NULL DEFAULT 'Agreement'::text, content text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT agreements_pkey PRIMARY KEY (id),
 CONSTRAINT agreements_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
 CONSTRAINT agreements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
 CONSTRAINT agreements_content_check CHECK (char_length(content) <= 200000),
 CONSTRAINT agreements_title_length CHECK (char_length(title) >= 1 AND char_length(title) <= 160)
);
CREATE TABLE public.analyses (
 id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL DEFAULT auth.uid(),
 project_id uuid NOT NULL, agreement_id uuid, client_message text NOT NULL,
 result_json jsonb NOT NULL DEFAULT '{}'::jsonb, generated_response text,
 created_at timestamptz NOT NULL DEFAULT now(),
 CONSTRAINT analyses_pkey PRIMARY KEY (id),
 CONSTRAINT analyses_agreement_id_fkey FOREIGN KEY (agreement_id) REFERENCES public.agreements(id) ON DELETE SET NULL,
 CONSTRAINT analyses_project_id_fkey FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE,
 CONSTRAINT analyses_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
 CONSTRAINT analyses_client_message_check CHECK (char_length(client_message) <= 100000)
);
CREATE INDEX projects_user_updated_idx ON public.projects USING btree (user_id, updated_at DESC);
CREATE INDEX agreements_user_project_idx ON public.agreements USING btree (user_id, project_id, updated_at DESC);
CREATE INDEX analyses_user_project_idx ON public.analyses USING btree (user_id, project_id, created_at DESC);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agreements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY profiles_insert_own ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = (SELECT auth.uid() AS uid));
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING (id = (SELECT auth.uid() AS uid));
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO authenticated USING (id = (SELECT auth.uid() AS uid)) WITH CHECK (id = (SELECT auth.uid() AS uid));
CREATE POLICY projects_delete_own ON public.projects FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid() AS uid));
CREATE POLICY projects_insert_own ON public.projects FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid() AS uid));
CREATE POLICY projects_select_own ON public.projects FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid() AS uid));
CREATE POLICY projects_update_own ON public.projects FOR UPDATE TO authenticated USING (user_id = (SELECT auth.uid() AS uid)) WITH CHECK (user_id = (SELECT auth.uid() AS uid));
CREATE POLICY agreements_delete_own ON public.agreements FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid() AS uid));
CREATE POLICY agreements_insert_own ON public.agreements FOR INSERT TO authenticated WITH CHECK (
 user_id = (SELECT auth.uid() AS uid) AND EXISTS (
  SELECT 1 FROM public.projects p WHERE p.id = agreements.project_id AND p.user_id = (SELECT auth.uid() AS uid)
 ));
CREATE POLICY agreements_select_own ON public.agreements FOR SELECT TO authenticated USING (
 user_id = (SELECT auth.uid() AS uid) AND EXISTS (
  SELECT 1 FROM public.projects p WHERE p.id = agreements.project_id AND p.user_id = (SELECT auth.uid() AS uid)
 ));
CREATE POLICY agreements_update_own ON public.agreements FOR UPDATE TO authenticated
 USING (user_id = (SELECT auth.uid() AS uid) AND EXISTS (
  SELECT 1 FROM public.projects p WHERE p.id = agreements.project_id AND p.user_id = (SELECT auth.uid() AS uid)
 ))
 WITH CHECK (user_id = (SELECT auth.uid() AS uid) AND EXISTS (
  SELECT 1 FROM public.projects p WHERE p.id = agreements.project_id AND p.user_id = (SELECT auth.uid() AS uid)
 ));
CREATE POLICY analyses_delete_own ON public.analyses FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid() AS uid));
CREATE POLICY analyses_insert_own ON public.analyses FOR INSERT TO authenticated WITH CHECK (
 user_id = (SELECT auth.uid() AS uid)
 AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = analyses.project_id AND p.user_id = (SELECT auth.uid() AS uid))
 AND (agreement_id IS NULL OR EXISTS (
  SELECT 1 FROM public.agreements a WHERE a.id = analyses.agreement_id
   AND a.project_id = analyses.project_id AND a.user_id = (SELECT auth.uid() AS uid)
  ))
);
CREATE POLICY analyses_select_own ON public.analyses FOR SELECT TO authenticated USING (
 user_id = (SELECT auth.uid() AS uid)
 AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = analyses.project_id AND p.user_id = (SELECT auth.uid() AS uid))
);
CREATE POLICY analyses_update_own ON public.analyses FOR UPDATE TO authenticated
 USING (user_id = (SELECT auth.uid() AS uid) AND EXISTS (
  SELECT 1 FROM public.projects p WHERE p.id = analyses.project_id AND p.user_id = (SELECT auth.uid() AS uid)
 ))
 WITH CHECK (
  user_id = (SELECT auth.uid() AS uid)
  AND EXISTS (SELECT 1 FROM public.projects p WHERE p.id = analyses.project_id AND p.user_id = (SELECT auth.uid() AS uid))
  AND (agreement_id IS NULL OR EXISTS (
   SELECT 1 FROM public.agreements a WHERE a.id = analyses.agreement_id
    AND a.project_id = analyses.project_id AND a.user_id = (SELECT auth.uid() AS uid)
  ))
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles, public.projects, public.agreements, public.analyses TO authenticated;
COMMENT ON TABLE public.profiles IS 'BoundaryFlow user profile; row identity is the matching auth.users id.';
COMMENT ON TABLE public.projects IS 'User-owned BoundaryFlow client/project workspace.';
COMMENT ON TABLE public.agreements IS 'User-owned agreed-scope snapshots attached to a project.';
COMMENT ON TABLE public.analyses IS 'User-owned scope analyses and generated response history.';
COMMIT;
