import { existsSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const requiredLocalEnv = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
  'VITE_API_BASE_URL',
];

const requiredProductionSecrets = [
  'VERCEL_TOKEN',
  'VERCEL_ORG_ID',
  'VERCEL_PROJECT_ID',
  'SUPABASE_ACCESS_TOKEN',
  'SUPABASE_DB_PASSWORD',
  'SUPABASE_PROJECT_ID',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_ANON_KEY',
];

const results = [];

function record(name, ok, detail) {
  results.push({ name, ok, detail });
  const icon = ok ? 'OK' : 'FAIL';
  console.log(`${icon} ${name}${detail ? ` - ${detail}` : ''}`);
}

function quoteWinArg(arg) {
  const value = String(arg);
  if (!/[\s"]/u.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function run(name, command, args, options = {}) {
  let executable = command;
  let finalArgs = args;

  if (process.platform === 'win32' && ['npm', 'npx'].includes(command)) {
    executable = process.env.ComSpec || 'cmd.exe';
    finalArgs = ['/d', '/s', '/c', [command, ...args.map(quoteWinArg)].join(' ')];
  }

  const result = spawnSync(executable, finalArgs, {
    encoding: 'utf8',
    shell: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
    env: { ...process.env, CI: '1', ...(options.env || {}) },
  });

  return {
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout || ''}${result.stderr || ''}`.trim(),
  };
}

function parseEnvNames(filePath) {
  if (!existsSync(filePath)) return new Set();
  const names = new Set();
  for (const line of readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/);
    if (match) names.add(match[1]);
  }
  return names;
}

console.log('Production preflight\n');

const envNames = parseEnvNames('.env.local');
if (!existsSync('.env.local')) {
  record('.env.local', false, 'arquivo nao encontrado');
} else {
  const missing = requiredLocalEnv.filter((name) => !envNames.has(name));
  record('.env.local', missing.length === 0, missing.length ? `faltando: ${missing.join(', ')}` : 'variaveis locais presentes');
}

const build = run('npm build', 'npm', ['run', 'build']);
record('Build local', build.ok, build.ok ? 'tsc + vite build OK' : `exit ${build.status}`);
if (!build.ok && build.output) console.log(build.output);

const gitDryRun = run('git push dry-run', 'git', ['push', '--dry-run', 'origin', 'HEAD:main']);
record('GitHub push permission', gitDryRun.ok, gitDryRun.ok ? 'origin/main aceita push' : 'sem permissao de push ou credencial invalida');
if (!gitDryRun.ok && gitDryRun.output) console.log(gitDryRun.output);

const vercelWhoami = run('vercel whoami', 'npx', ['--yes', 'vercel@latest', 'whoami']);
record('Vercel auth', vercelWhoami.ok, vercelWhoami.ok ? vercelWhoami.output.split(/\r?\n/).pop() : 'nao autorizado; faca login ou configure VERCEL_TOKEN');

const supabaseVersion = run('supabase version', 'npx', ['--yes', 'supabase@latest', '--version']);
record('Supabase CLI', supabaseVersion.ok, supabaseVersion.ok ? supabaseVersion.output : 'CLI indisponivel via npx');

if (envNames.has('DATABASE_URL')) {
  const databaseConnection = run(
    'database connection',
    'node',
    ['scripts/run-sql.mjs', '--query', 'select 1 as ok'],
  );
  record(
    'Supabase database connection',
    databaseConnection.ok,
    databaseConnection.ok ? 'consulta direta aprovada' : 'DATABASE_URL sem acesso ao banco',
  );
  if (!databaseConnection.ok && databaseConnection.output) console.log(databaseConnection.output);
} else {
  record('Supabase database connection', false, 'DATABASE_URL ausente em .env.local');
}

console.log('\nGitHub Actions secrets esperados:');
for (const name of requiredProductionSecrets) console.log(`- ${name}`);

const failed = results.filter((result) => !result.ok);
if (failed.length) {
  console.error(`\nPreflight falhou em ${failed.length} item(ns). Corrija as contas/segredos acima antes do deploy automatico.`);
  process.exit(1);
}

console.log('\nPreflight aprovado. A esteira pode publicar em producao via push ou workflow_dispatch no main.');
