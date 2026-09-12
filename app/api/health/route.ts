import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  const environment = process.env.NEXT_PUBLIC_APP_ENV ?? "development";
  const commit = process.env.NEXT_PUBLIC_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "unknown";
  const academicDataMode = process.env.NEXT_PUBLIC_ACADEMIC_DATA_MODE ?? "backend";
  const version = process.env.NEXT_PUBLIC_APP_VERSION ?? "staging-alpha";

  return NextResponse.json(
    {
      ok: true,
      app: "ENS English",
      environment,
      commit,
      academicDataMode,
      version,
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
