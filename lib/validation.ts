import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().trim().min(3, "Indica el nombre de la cuenta"),
  accountType: z.enum(["condominio_existente", "torre_residencial", "proyecto_nuevo", "constructora", "desarrollador", "aliado"]),
  sector: z.string().trim().min(2, "Indica el sector"),
  units: z.coerce.number().int().positive("Indica una cantidad válida"),
  primaryProblem: z.string().trim().min(8, "Describe la necesidad principal"),
  stakeholderName: z.string().trim().min(3, "Indica un contacto"),
  stakeholderEmail: z.string().email("Correo inválido"),
  nextAction: z.string().trim().min(5, "La próxima acción es obligatoria"),
  nextActionAt: z.string().min(1, "Indica la fecha de seguimiento")
});

export const proposalSchema = z.object({
  opportunityId: z.string().min(1),
  monthlyFee: z.coerce.number().positive("Los honorarios deben ser mayores que cero"),
  issueDate: z.string().min(1),
  referenceIds: z.array(z.string()).length(3, "Selecciona exactamente tres referencias"),
  format: z.enum(["docx", "pdf"]).default("docx")
});
