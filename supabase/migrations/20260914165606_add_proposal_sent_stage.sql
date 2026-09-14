alter type public.opportunity_stage
  add value if not exists 'propuesta_enviada' after 'propuesta';
