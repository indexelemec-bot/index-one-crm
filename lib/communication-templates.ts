export const communicationTemplates = [
  { id: "seguimiento", label: "Seguimiento formal", subject: "Seguimiento a nuestra conversación — {{cliente}}", body: "Estimado/a {{contacto}},\n\nGracias por el tiempo compartido. Damos seguimiento a nuestra conversación sobre las necesidades de administración de {{cliente}}.\n\nQuedamos atentos para confirmar el próximo paso acordado.\n\nCordialmente," },
  { id: "propuesta", label: "Envío de propuesta", subject: "Propuesta de administración — {{cliente}}", body: "Estimado/a {{contacto}},\n\nCompartimos y formalizamos la propuesta de servicios de administración preparada para {{cliente}}, basada en las necesidades conversadas.\n\nNos gustaría revisarla juntos para aclarar cualquier punto y acordar los próximos pasos.\n\nCordialmente," },
  { id: "reunion", label: "Confirmación de reunión", subject: "Confirmación de reunión — {{cliente}}", body: "Estimado/a {{contacto}},\n\nConfirmamos nuestra próxima reunión para continuar el diagnóstico y revisar las prioridades de {{cliente}}.\n\nAgradecemos confirmar su disponibilidad.\n\nCordialmente," },
  { id: "decision", label: "Próximo paso de decisión", subject: "Próximo paso acordado — {{cliente}}", body: "Estimado/a {{contacto}},\n\nConforme a nuestra conversación, resumimos el próximo paso acordado para avanzar con la solución de administración de {{cliente}}.\n\nQuedamos disponibles para completar cualquier requisito pendiente de la junta.\n\nCordialmente," }
] as const;

export function renderCommunicationTemplate(templateId: string, client: string, contact: string) {
  const template = communicationTemplates.find((item) => item.id === templateId) ?? communicationTemplates[0];
  const replace = (value: string) => value.replaceAll("{{cliente}}", client).replaceAll("{{contacto}}", contact);
  return { subject: replace(template.subject), body: replace(template.body) };
}
