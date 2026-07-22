/**
 * Executa SQL no Supabase/Postgres de producao (uso local pelo agente).
 *
 * Requisitos em .env.local (NAO commitar):
 *   DATABASE_URL=postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres
 *   — ou —
 *   SUPABASE_DB_PASSWORD=...  (monta a URL com SUPABASE_URL / project ref)
 *
 * Uso:
 *   node scripts/run-sql.mjs path/to/file.sql
 *   node scripts/run-sql.mjs --query "select 1"
 */
import fs from 'fs';
import path from 'path';
import pg from 'pg';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    const key = line.slice(0, i).trim();
    let value = line.slice(i + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    out[key] = value;
  }
  return out;
}

function resolveConnectionString(env) {
  if (env.DATABASE_URL || env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL) {
    return env.DATABASE_URL || env.POSTGRES_URL_NON_POOLING || env.POSTGRES_URL;
  }

  const password = env.SUPABASE_DB_PASSWORD || env.POSTGRES_PASSWORD;
  const host =
    env.POSTGRES_HOST ||
    (env.SUPABASE_URL || env.VITE_SUPABASE_URL || '')
      .replace(/^https?:\/\//, '')
      .replace('.supabase.co', '.supabase.co');

  // Project ref from URL: https://ref.supabase.co
  const refMatch = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || '').match(
    /https?:\/\/([a-z0-9]+)\.supabase\.co/i,
  );
  const ref = refMatch?.[1];
  const dbHost = env.POSTGRES_HOST || (ref ? `db.${ref}.supabase.co` : null);
  const user = env.POSTGRES_USER || 'postgres';
  const database = env.POSTGRES_DATABASE || 'postgres';
  const port = env.POSTGRES_PORT || '5432';

  if (password && dbHost) {
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${dbHost}:${port}/${database}`;
  }

  return null;
}

const root = process.cwd();
const env = {
  ...loadEnvFile(path.join(root, '.env')),
  ...loadEnvFile(path.join(root, '.env.local')),
  ...loadEnvFile(path.join(root, '.env.vercel.production')),
};

const connectionString = resolveConnectionString(env);
if (!connectionString) {
  console.error(`
Falta conexao com o banco.

Adicione em .env.local (nao commitar):

  DATABASE_URL=postgresql://postgres.[REF]:[SENHA]@aws-0-...pooler.supabase.com:5432/postgres

Ou:

  SUPABASE_URL=https://yxawavenbognqiihaesh.supabase.co
  SUPABASE_DB_PASSWORD=sua_senha_do_banco

Onde pegar:
  Supabase → Project Settings → Database → Connection string (URI)
`);
  process.exit(1);
}

const args = process.argv.slice(2);
let sql = '';
if (args[0] === '--query' || args[0] === '-q') {
  sql = args.slice(1).join(' ');
} else if (args[0]) {
  const file = path.resolve(args[0]);
  if (!fs.existsSync(file)) {
    console.error('Arquivo nao encontrado:', file);
    process.exit(1);
  }
  sql = fs.readFileSync(file, 'utf8');
} else {
  console.error('Uso: node scripts/run-sql.mjs <arquivo.sql> | --query "SQL"');
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
try {
  const result = await client.query(sql);
  const results = Array.isArray(result) ? result : [result];
  for (const r of results) {
    if (r.rows) {
      console.log(JSON.stringify({ rowCount: r.rowCount, rows: r.rows }, null, 2));
    } else {
      console.log(JSON.stringify({ command: r.command, rowCount: r.rowCount }, null, 2));
    }
  }
  console.log('OK SQL executado.');
} finally {
  await client.end();
}
