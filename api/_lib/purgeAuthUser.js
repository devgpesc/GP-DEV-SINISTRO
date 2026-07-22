/**
 * Limpa FKs que bloqueiam exclusao de auth.users e apaga a conta.
 * O erro "Database error deleting user" no dashboard costuma ser FK sem ON DELETE.
 */

async function nullifyIfExists(admin, table, column, userId) {
  try {
    const { error } = await admin.from(table).update({ [column]: null }).eq(column, userId);
    if (error && !/does not exist|Could not find|PGRST/i.test(error.message || '')) {
      console.warn(`[purgeAuthUser] update ${table}.${column}:`, error.message);
    }
  } catch (err) {
    console.warn(`[purgeAuthUser] update ${table}.${column}:`, err.message);
  }
}

async function deleteIfExists(admin, table, column, userId) {
  try {
    const { error } = await admin.from(table).delete().eq(column, userId);
    if (error && !/does not exist|Could not find|PGRST/i.test(error.message || '')) {
      console.warn(`[purgeAuthUser] delete ${table}.${column}:`, error.message);
    }
  } catch (err) {
    console.warn(`[purgeAuthUser] delete ${table}.${column}:`, err.message);
  }
}

export async function cleanupUserForeignKeys(admin, userId) {
  // Dono de tenant: nao apaga empresa, so solta o vinculo.
  await nullifyIfExists(admin, 'saas_tenants', 'owner_id', userId);

  await deleteIfExists(admin, 'organization_members', 'user_id', userId);
  await deleteIfExists(admin, 'notifications', 'user_id', userId);

  // Historico / auditoria: nullificar para preservar trilha.
  await nullifyIfExists(admin, 'audit_logs', 'user_id', userId);
  await nullifyIfExists(admin, 'event_history', 'user_id', userId);
  await nullifyIfExists(admin, 'purchase_order_history', 'user_id', userId);
  await nullifyIfExists(admin, 'supplier_reviews', 'user_id', userId);
  await nullifyIfExists(admin, 'manual_purchase_selections', 'user_id', userId);

  // Entidades de negocio: created_by
  await nullifyIfExists(admin, 'events', 'created_by', userId);
  await nullifyIfExists(admin, 'purchase_orders', 'created_by', userId);
  await nullifyIfExists(admin, 'invitations', 'created_by', userId);
  await nullifyIfExists(admin, 'api_keys', 'created_by', userId);
  await nullifyIfExists(admin, 'repurchase_releases', 'created_by', userId);

  // Perfil por ultimo (varias FKs apontam para profiles.id).
  await deleteIfExists(admin, 'profiles', 'id', userId);
}

export async function purgeAuthUserById(admin, userId) {
  // Preferir RPC SECURITY DEFINER se existir (trata FKs no banco).
  try {
    const { data, error } = await admin.rpc('admin_purge_auth_user', {
      target_user_id: userId,
    });
    if (!error) {
      return { ok: true, via: 'rpc', result: data };
    }
    if (!/Could not find|PGRST202|function/i.test(error.message || '')) {
      console.warn('[purgeAuthUser] rpc:', error.message);
    }
  } catch (err) {
    console.warn('[purgeAuthUser] rpc:', err.message);
  }

  await cleanupUserForeignKeys(admin, userId);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    // Ultima tentativa: SQL direto via rpc genérico nao existe — rethrow com mensagem clara.
    throw new Error(
      deleteError.message ||
        'Falha ao apagar Auth. Execute o SQL admin_purge_auth_user no Supabase SQL Editor.',
    );
  }

  return { ok: true, via: 'admin_api' };
}
