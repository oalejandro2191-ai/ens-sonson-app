import { StudentApp } from "@/components/student-app";

export default async function StudentPage({
  params,
}: {
  params: Promise<{ section?: string[] }>;
}) {
  const { section = [] } = await params;
  return <StudentApp section={section} />;
}
