export const studentSections = [
  "inicio",
  "aprender",
  "jugar",
  "progreso",
  "companeros",
  "perfil",
] as const;

export type StudentSection = (typeof studentSections)[number];

export function resolveStudentSection(parts: string[]): StudentSection {
  const candidate = parts[0] ?? "inicio";
  return studentSections.includes(candidate as StudentSection)
    ? (candidate as StudentSection)
    : "inicio";
}
