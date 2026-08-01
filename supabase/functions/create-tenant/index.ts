
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const allowedOrigins = new Set([
  'https://eventos.escsistemas.com',
  'https://gp-dev-sinistro.vercel.app',
  ...(Deno.env.get('CORS_ALLOWED_ORIGINS') || '').split(',').map((value) => value.trim()).filter(Boolean),
]);

serve(async (req) => {
  const origin = req.headers.get('origin') || '';
  if (origin && !allowedOrigins.has(origin)) {
    return new Response(JSON.stringify({ error: 'Origem nao autorizada.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json', 'Vary': 'Origin' },
    });
  }
  const corsHeaders = {
    ...(origin ? { 'Access-Control-Allow-Origin': origin } : {}),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Setup Supabase Clients
    // Client do usuário logado (para verificação de permissão)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Client Admin (Service Role) para criar usuário e empresa
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 2. Verificar se o usuário que chamou é Super Admin ou Admin
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) throw new Error('Unauthorized')

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('role, email')
      .eq('id', user.id)
      .single()

    if (!profile || profile.role !== 'super_admin') {
      return new Response(
        JSON.stringify({ error: 'Permissao negada. Apenas Super Admin pode criar empresas.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // 3. Receber dados do Body
    const { companyName, document, planId, adminName, adminEmail, adminPassword } = await req.json()

    if (!adminEmail || !adminPassword || !companyName) {
      throw new Error('Dados incompletos.')
    }

    // 4. Criar o Usuário Admin (Auth) com confirmação automática
    const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: {
        full_name: adminName,
        role: 'Admin'
      }
    })

    if (createUserError) throw createUserError

    // 5. Garantir que o Profile está correto (Role Admin e Permissões)
    // O trigger de banco handle_new_user já deve ter rodado, mas forçamos o update para garantir
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

    // 6. Criar o Tenant (Empresa) vinculado ao novo usuário
    const { data: tenant, error: tenantError } = await supabaseAdmin
      .from('saas_tenants')
      .insert({
        name: companyName,
        document: document,
        plan_id: planId,
        owner_id: createdUser.user.id,
        status: 'active'
      })
      .select()
      .single()

    if (tenantError) {
      // Rollback básico: se falhar ao criar empresa, deleta o usuário criado para não deixar lixo
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id)
      throw tenantError
    }

    const { error: memberError } = await supabaseAdmin
      .from('organization_members')
      .insert({
        tenant_id: tenant.id,
        user_id: createdUser.user.id,
        role: 'owner'
      })

    if (memberError) {
      await supabaseAdmin.from('saas_tenants').delete().eq('id', tenant.id)
      await supabaseAdmin.auth.admin.deleteUser(createdUser.user.id)
      throw memberError
    }

    // 7. Retorno de Sucesso
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error('[create-tenant]', error)
    return new Response(
      JSON.stringify({ error: 'Nao foi possivel criar a empresa.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
