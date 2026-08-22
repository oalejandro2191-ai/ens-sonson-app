import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(
    {
      ok: true,
      app: "ens-sonson-app",
      environment: process.env.NEXT_PUBLIC_APP_ENV ?? "development",
      commit: process.env.NEXT_PUBLIC_COMMIT_SHA ?? "unknown",
      academicDataMode: "backend-required",
      timestamp: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
