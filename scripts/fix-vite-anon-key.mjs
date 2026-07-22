/**
 * Define VITE_SUPABASE_ANON_KEY = JWT anon (nao publishable) na Vercel + .env.local
 */
import fs from 'fs';
import { spawnSync } from 'child_process';

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const i = line.indexOf('=');
    let v = line.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[line.slice(0, i).trim()] = v;
  }
  return out;
}

function saveEnvKey(file, key, value) {
  const lines = fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split(/\r?\n/) : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(key + '=')) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  fs.writeFileSync(file, next.filter((l, idx) => l || idx < next.length - 1).join('\n') + '\n');
}

const pull = spawnSync('vercel', ['env', 'pull', '.env.vercel.tmp', '--environment', 'production', '--yes'], {
  encoding: 'utf8',
  shell: true,
});
if (pull.status !== 0) {
  console.error(pull.stderr || pull.stdout);
  process.exit(1);
}

const env = loadEnv('.env.vercel.tmp');
const jwtAnon = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;

if (!jwtAnon || !jwtAnon.startsWith('eyJ')) {
  console.error('JWT anon nao encontrado no Vercel (SUPABASE_ANON_KEY).');
  process.exit(1);
}

console.log('JWT_ANON_LEN', jwtAnon.length);

// Atualiza Vercel VITE_SUPABASE_ANON_KEY
spawnSync('vercel', ['env', 'rm', 'VITE_SUPABASE_ANON_KEY', 'production', '-y'], {
  shell: true,
  stdio: 'ignore',
});
spawnSync('vercel', ['env', 'rm', 'VITE_SUPABASE_ANON_KEY', 'preview', '-y'], {
  shell: true,
  stdio: 'ignore',
});
spawnSync('vercel', ['env', 'rm', 'VITE_SUPABASE_ANON_KEY', 'development', '-y'], {
  shell: true,
  stdio: 'ignore',
});

for (const target of ['production', 'preview', 'development']) {
  const add = spawnSync('vercel', ['env', 'add', 'VITE_SUPABASE_ANON_KEY', target], {
    input: jwtAnon + '\n',
    encoding: 'utf8',
    shell: true,
  });
  console.log('Vercel', target, add.status === 0 ? 'OK' : 'FAIL');
}

if (url) {
  spawnSync('vercel', ['env', 'rm', 'VITE_SUPABASE_URL', 'production', '-y'], { shell: true, stdio: 'ignore' });
  const addUrl = spawnSync('vercel', ['env', 'add', 'VITE_SUPABASE_URL', 'production'], {
    input: url.replace(/\/$/, '') + '\n',
    encoding: 'utf8',
    shell: true,
  });
  console.log('VITE_SUPABASE_URL production', addUrl.status === 0 ? 'OK' : 'FAIL');
}

// Atualiza .env.local
saveEnvKey('.env.local', 'VITE_SUPABASE_ANON_KEY', jwtAnon);
if (url) saveEnvKey('.env.local', 'VITE_SUPABASE_URL', url.replace(/\/$/, ''));
saveEnvKey('.env.local', 'SUPABASE_ANON_KEY', jwtAnon);
// Evita publishable curta sobrescrever JWT no build antigo
saveEnvKey('.env.local', 'VITE_SUPABASE_PUBLISHABLE_KEY', jwtAnon);

for (const target of ['production', 'preview', 'development']) {
  spawnSync('vercel', ['env', 'rm', 'VITE_SUPABASE_PUBLISHABLE_KEY', target, '-y'], {
    shell: true,
    stdio: 'ignore',
  });
  const addPub = spawnSync('vercel', ['env', 'add', 'VITE_SUPABASE_PUBLISHABLE_KEY', target], {
    input: jwtAnon + '\n',
    encoding: 'utf8',
    shell: true,
  });
  console.log('VITE_SUPABASE_PUBLISHABLE_KEY', target, addPub.status === 0 ? 'OK' : 'FAIL');
}

fs.unlinkSync('.env.vercel.tmp');
console.log('OK chaves sincronizadas. Redeploy necessario.');
