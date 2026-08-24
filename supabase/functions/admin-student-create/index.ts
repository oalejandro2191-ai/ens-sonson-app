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

  let body: { full_name?: string; email?: string; group_id?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "Solicitud inválida" });
  }

  const fullName = body.full_name?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const groupId = body.group_id?.trim() ?? "";
  if (!fullName || !email || !groupId) return json(400, { ok: false, error: "Nombre, correo de acceso y grupo son obligatorios" });

  const validation = await caller.rpc("admin_validate_student_creation_v1", {
    provided_full_name: fullName,
    provided_email: email,
    target_group_id: groupId,
  });
  if (validation.error || !validation.data?.authorized) {
    return json(403, { ok: false, error: validation.error?.message ?? "Acceso denegado" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const temporaryPassword = randomPassword();
  const created = await admin.auth.admin.createUser({
    email: validation.data.email,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      full_name: validation.data.full_name,
      must_change_password: true,
      created_by_institution_admin: true,
      temporary_password_issued_at: new Date().toISOString(),
    },
  });

  if (created.error || !created.data.user) {
    const duplicate = /already|registered|exists/i.test(created.error?.message ?? "");
    return json(duplicate ? 409 : 500, {
      ok: false,
      error: duplicate ? "Ya existe una cuenta con ese correo de acceso" : "No fue posible crear la cuenta Auth",
    });
  }

  const userId = created.data.user.id;
  const provision = await caller.rpc("admin_provision_created_student_v1", {
    target_user_id: userId,
    provided_full_name: validation.data.full_name,
    target_group_id: validation.data.group_id,
  });

  if (provision.error) {
    const cleanup = await admin.auth.admin.deleteUser(userId);
    return json(500, {
      ok: false,
      error: "No fue posible completar la creación institucional del estudiante",
      auth_account_rolled_back: !cleanup.error,
    });
  }

  return json(201, {
    ok: true,
    user_id: userId,
    full_name: validation.data.full_name,
    email: validation.data.email,
    group_id: validation.data.group_id,
    group_name: validation.data.group_name,
    status: "active",
    temporary_password: temporaryPassword,
    must_change_password: true,
  });
});
