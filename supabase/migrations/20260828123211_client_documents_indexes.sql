create index client_documents_stakeholder_idx
on public.client_documents(stakeholder_id)
where stakeholder_id is not null;

create index client_documents_generated_by_idx
on public.client_documents(generated_by);
