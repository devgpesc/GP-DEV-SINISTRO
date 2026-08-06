const knownErrorMessages: Array<[string, string]> = [
  ['invalid login credentials', 'E-mail ou senha incorretos.'],
  ['email not confirmed', 'O e-mail ainda não foi confirmado.'],
  ['user already registered', 'Este e-mail já possui uma conta.'],
  ['already registered', 'Este e-mail já possui uma conta.'],
  ['failed to fetch', 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'],
  ['network request failed', 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'],
  ['load failed', 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.'],
  ['rate limit', 'Muitas tentativas em pouco tempo. Aguarde um momento e tente novamente.'],
  ['row-level security', 'Seu usuário não possui permissão para realizar esta ação.'],
  ['permission denied', 'Seu usuário não possui permissão para realizar esta ação.'],
  ['duplicate key', 'Já existe um registro com esses dados.'],
  ['unique constraint', 'Já existe um registro com esses dados.'],
  ['foreign key', 'Este registro está vinculado a outros dados e não pode ser removido.'],
  ['not-null constraint', 'Preencha todos os campos obrigatórios.'],
  ['null value', 'Preencha todos os campos obrigatórios.'],
  ['schema cache', 'A estrutura do sistema está sendo atualizada. Tente novamente em instantes.'],
  ['could not find the', 'A estrutura do sistema está sendo atualizada. Tente novamente em instantes.'],
];

export const getUserFacingError = (
  error: unknown,
  fallback = 'Não foi possível concluir a operação. Tente novamente.',
) => {
  const raw = error instanceof Error
    ? error.message
    : String((error as { message?: unknown })?.message || error || '');
  const normalized = raw.toLowerCase();
  return knownErrorMessages.find(([term]) => normalized.includes(term))?.[1] || fallback;
};
