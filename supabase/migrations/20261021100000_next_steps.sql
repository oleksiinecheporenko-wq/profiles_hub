-- Next steps of the client PDF, edited while the estimate is ready.
-- null = not customised: the PDF uses the standard steps from the app code.

alter table public.estimates
  add column next_steps jsonb
    constraint estimates_next_steps_array check (next_steps is null or jsonb_typeof(next_steps) = 'array');
