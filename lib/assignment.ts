import { z } from "zod";

export const opportunityAssignmentSchema = z.object({
  opportunityId: z.string().uuid(),
  newOwnerId: z.string().uuid(),
  reason: z.string().trim().min(3, "El motivo debe tener al menos 3 caracteres.").max(500),
  note: z.string().trim().max(2000).optional().default("")
});
