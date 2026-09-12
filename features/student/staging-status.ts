export type StagingCapability = {
  label: string;
  state: "ready" | "pending";
  detail: string;
};

export const stagingCapabilities: StagingCapability[] = [
  {
    label: "Interfaz base",
    state: "ready",
    detail: "Navegación limpia sin estadísticas académicas ficticias.",
  },
  {
    label: "Supabase académico",
    state: "pending",
    detail: "Se conectará únicamente contra el entorno de prueba validado.",
  },
  {
    label: "Autenticación",
    state: "pending",
    detail: "Se habilitará después de validar el modelo institucional y RLS.",
  },
  {
    label: "Mastery y ranking",
    state: "pending",
    detail: "Nunca se calcularán en el navegador.",
  },
];
