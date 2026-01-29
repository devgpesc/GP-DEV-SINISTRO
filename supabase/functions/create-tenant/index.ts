/// <reference types="https://deno.land/x/types/index.d.ts" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const body = await req.json();
    const { company, admin } = body;

    if (!company || !admin) {
      return new Response(JSON.stringify({ error: "Payload inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // 1. Criar usuário no Auth
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.admin.createUser({
        email: admin.email,
        password: admin.password,
        email_confirm: true,
        user_metadata: {
          full_name: admin.name,
        },
      });

    if (userError || !userData?.user) {
      throw userError || new Error("Falha ao criar usuário");
    }

    const userId = userData.user.id;

    // 2. Criar empresa (tenant)
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from("saas_tenants")
      .insert({
        name: company.name,
        document: company.document ?? null,
        plan_id: company.plan_id ?? null,
        owner_id: userId,
        status: "active",
      })
      .select()
      .single();

    if (tenantError) {
      throw tenantError;
    }

    // 3. Criar profile como Admin
    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email: admin.email,
      full_name: admin.name,
      role: "Admin",
      permissions: {
        super_admin: false,
        manage_users: true,
        manage_purchases: true,
        manage_financial: true,
      },
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      throw profileError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        tenant,
        admin_user_id: userId,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("create-tenant error:", err);

    return new Response(
      JSON.stringify({
        success: false,
        error: String(err),
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
});
