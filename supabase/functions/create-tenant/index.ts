<<<<<<< HEAD
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
=======
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Setup Supabase Clients
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Verificar se o usuário que chamou é Super Admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile || (profile.role !== 'super_admin' && profile.role !== 'Admin')) {
      return new Response(
        JSON.stringify({ error: 'Permissão negada. Apenas administradores podem criar empresas.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // 3. Receber dados do Body
    const { companyName, document, planId, adminName, adminEmail, adminPassword } = await req.json()

    if (!adminEmail || !adminPassword || !companyName) {
      throw new Error('Dados incompletos.')
    }

    // 4. Criar o Usuário Admin (Auth)
    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true, // Auto confirma o email
      user_metadata: {
        full_name: adminName,
        role: 'Admin' // Passa metadata para o trigger handle_new_user
      }
    })

    if (createUserError) throw createUserError

    // 5. Garantir que o Profile está correto (Role Admin e Permissões)
    // O trigger handle_new_user já deve ter rodado, mas forçamos o update para garantir
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        role: 'Admin',
        full_name: adminName,
        permissions: {
            financial_view: true, 
            approve_purchases: true, 
            manage_users: true, 
            delete_records: true,
            view_reports: true
        }
      })
      .eq('id', createdUser.user.id)

    if (profileError) throw profileError

    // 6. Criar o Tenant (Empresa)
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('saas_tenants')
      .insert({
        name: companyName,
        document: document,
        plan_id: planId,
        owner_id: createdUser.user.id, // Vincula ao novo usuário
        status: 'active'
      })
      .select()
      .single()

    if (tenantError) {
      // Rollback básico: se falhar ao criar empresa, deleta o usuário criado para não deixar lixo
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id)
      throw tenantError
    }

    // 7. Retorno de Sucesso
    return new Response(
      JSON.stringify({ 
        success: true, 
        tenant, 
        user: { 
          id: createdUser.user.id, 
          email: createdUser.user.email 
        } 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
>>>>>>> bde3a971e004485278097d878ecab25410d1f355
