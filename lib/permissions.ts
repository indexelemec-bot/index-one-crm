import type { Opportunity, UserProfile } from "@/types/domain";

export const canManageUsers = (user: UserProfile) => user.role === "superadmin";
export const canEditCommercial = (user: UserProfile) => ["superadmin", "gerencia_comercial", "ejecutivo"].includes(user.role);
export const canSeeOpportunity = (user: UserProfile, opportunity: Opportunity) => ["superadmin", "gerencia_comercial", "administracion", "consulta"].includes(user.role) || opportunity.ownerId === user.id;
