import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

function json(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function randomPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  const chars = Array.from(bytes, (value) => alphabet[value % alphabet.length]);
  chars[0] = "A";
  chars[1] = "a";
  chars[2] = "7";
  chars[3] = "!";
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const swapBytes = crypto.getRandomValues(new Uint8Array(1));
    const j = swapBytes[0] % (i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json(405, { ok: false, error: "Método no permitido" });

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json(401, { ok: false, error: "Sesión requerida" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json(500, { ok: false, error: "Configuración incompleta" });

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const authResult = await caller.auth.getUser();
  if (authResult.error || !authResult.data.user) return json(401, { ok: false, error: "Sesión inválida" });

  let body: { student_user_id?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "Solicitud inválida" });
  }

  const targetUserId = body.student_user_id?.trim();
  if (!targetUserId) return json(400, { ok: false, error: "Estudiante requerido" });

  const validation = await caller.rpc("admin_validate_student_access_reset_v1", { target_user_id: targetUserId });
  if (validation.error || !validation.data?.authorized) {
    return json(403, { ok: false, error: validation.error?.message ?? "Acceso denegado" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const target = await admin.auth.admin.getUserById(targetUserId);
  if (target.error || !target.data.user) return json(404, { ok: false, error: "Cuenta Auth no encontrada" });

  const temporaryPassword = randomPassword();
  const updated = await admin.auth.admin.updateUserById(targetUserId, {
    password: temporaryPassword,
    user_metadata: {
      ...(target.data.user.user_metadata ?? {}),
      must_change_password: true,
      temporary_password_issued_at: new Date().toISOString(),
    },
  });
  if (updated.error) return json(500, { ok: false, error: "No fue posible regenerar el acceso" });

  const audit = await caller.rpc("admin_log_student_access_reset_v1", { target_user_id: targetUserId });

  return json(200, {
    ok: true,
    student_user_id: targetUserId,
    student_name: validation.data.student_name ?? null,
    temporary_password: temporaryPassword,
    must_change_password: true,
    audit_logged: !audit.error,
  });
});
