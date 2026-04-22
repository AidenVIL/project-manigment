alter table public.email_templates
add column if not exists design jsonb;

notify pgrst, 'reload schema';
