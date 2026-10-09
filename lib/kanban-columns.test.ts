import { describe, expect, it } from "vitest";
import { kanbanColumnForStage, kanbanColumns } from "@/lib/constants";

describe("Kanban simplificado para condominios", () => {
  it("muestra únicamente cuatro pasos comerciales", () => {
    expect(kanbanColumns.map((column) => column.label)).toEqual([
      "Acercamiento inicial",
      "Evaluación",
      "Propuesta",
      "Cierre final",
    ]);
  });

  it("agrupa las etapas detalladas sin mostrar clientes ya cerrados", () => {
    expect(kanbanColumnForStage("problema_detectado")?.id).toBe("acercamiento");
    expect(kanbanColumnForStage("presentacion")?.id).toBe("evaluacion");
    expect(kanbanColumnForStage("negociacion")?.id).toBe("propuesta");
    expect(kanbanColumnForStage("contrato_transicion")?.id).toBe("cierre");
    expect(kanbanColumnForStage("cliente_activo")).toBeUndefined();
    expect(kanbanColumnForStage("perdida")).toBeUndefined();
  });
});
