import { applyCors } from '../_lib/http.js';

export default async function handler(req, res) {
  if (!applyCors(req, res)) return res.status(403).json({ error: 'Origem nao autorizada.' });
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const cleanCnpj = String(req.query.cnpj || '').replace(/\D/g, '');
  if (cleanCnpj.length !== 14) return res.status(400).json({ error: 'CNPJ invalido.' });

  try {
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
    if (!response.ok) return res.status(response.status).json({ error: 'CNPJ nao encontrado.' });

    const data = await response.json();
    return res.json({
      name: data.razao_social,
      fantasy: data.nome_fantasia || data.razao_social,
      city: data.municipio,
      email: data.email,
      phone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1}) ${data.telefone_1}` : '',
    });
  } catch (error) {
    return res.status(500).json({ error: 'Erro na consulta CNPJ.' });
  }
}
