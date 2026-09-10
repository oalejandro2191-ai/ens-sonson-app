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

function validPassword(value: string) {
  return value.length >= 10 &&
    value.length <= 72 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /[0-9]/.test(value) &&
    /[^A-Za-z0-9]/.test(value);
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

  let body: { new_password?: string };
  try {
    body = await request.json();
  } catch {
    return json(400, { ok: false, error: "Solicitud inválida" });
  }

  const newPassword = body.new_password ?? "";
  if (!validPassword(newPassword)) {
    return json(400, {
      ok: false,
      error: "La nueva contraseña debe tener entre 10 y 72 caracteres e incluir mayúscula, minúscula, número y símbolo",
    });
  }

  const state = await caller.rpc("get_my_student_activation_state_v1");
  if (state.error) return json(403, { ok: false, error: state.error.message });
  if (!state.data?.required) return json(409, { ok: false, error: "Esta cuenta no requiere activación" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const current = await admin.auth.admin.getUserById(authResult.data.user.id);
  if (current.error || !current.data.user) return json(404, { ok: false, error: "Cuenta Auth no encontrada" });

  const now = new Date().toISOString();
  const updated = await admin.auth.admin.updateUserById(authResult.data.user.id, {
    password: newPassword,
    app_metadata: {
      ...(current.data.user.app_metadata ?? {}),
      must_change_password: false,
      password_changed_at: now,
    },
    user_metadata: {
      ...(current.data.user.user_metadata ?? {}),
      must_change_password: false,
      password_changed_at: now,
    },
  });

  if (updated.error) return json(500, { ok: false, error: "No fue posible actualizar la contraseña" });

  const activation = await admin.rpc("service_complete_student_activation_v1", {
    target_user_id: authResult.data.user.id,
  });

  if (activation.error) {
    await admin.auth.admin.updateUserById(authResult.data.user.id, {
      app_metadata: {
        ...(updated.data.user?.app_metadata ?? current.data.user.app_metadata ?? {}),
        must_change_password: true,
      },
    });
    return json(500, { ok: false, error: "La contraseña cambió, pero no fue posible completar la activación. Intente nuevamente." });
  }

  return json(200, {
    ok: true,
    status: activation.data?.status ?? "active",
    activated: Boolean(activation.data?.activated),
    reauthentication_required: true,
  });
});
