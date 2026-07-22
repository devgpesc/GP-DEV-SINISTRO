export type MatrixPrintLayout = 'landscape' | 'list';

type MatrixPrintInput = {
  headerMeta: {
    quotationCode?: string;
    eventProtocol?: string;
    associateName?: string;
    vehicleLabel?: string;
    participationQuota?: number | string | null;
    eventOpenedAt?: string;
    quotationCreatedAt?: string;
    eventStatus?: string;
  };
  items: Array<{ id: string; name: string; quantity: number; unit?: string }>;
  suppliers: Array<{ id: string; name: string; city?: string }>;
  prices: Array<{ quotation_item_id: string; supplier_id: string; price: number; delivery_days?: number | null; availability?: boolean }>;
  layout?: MatrixPrintLayout;
};

const money = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

function computeChampionSupplierIds(input: MatrixPrintInput): Set<string> {
  const wins = new Map<string, number>();
  for (const item of input.items) {
    const offers = input.prices.filter((p) => p.quotation_item_id === item.id && Number(p.price) > 0);
    if (!offers.length) continue;
    const min = Math.min(...offers.map((p) => Number(p.price)));
    offers
      .filter((p) => Number(p.price) === min)
      .forEach((p) => wins.set(p.supplier_id, (wins.get(p.supplier_id) || 0) + 1));
  }
  let bestCount = 0;
  const champions = new Set<string>();
  for (const [id, count] of wins.entries()) {
    if (count > bestCount) {
      bestCount = count;
      champions.clear();
      champions.add(id);
    } else if (count === bestCount && bestCount > 0) {
      champions.add(id);
    }
  }
  return champions;
}

function buildLandscapeTable(input: MatrixPrintInput, championIds: Set<string>) {
  const supplierHeaders = input.suppliers.map((s) => `
    <th class="supplier-head ${championIds.has(s.id) ? 'champion-head' : ''}">
      <div class="supplier-name">${s.name}</div>
      <div class="supplier-city">${s.city || ''}</div>
      ${championIds.has(s.id) ? '<div class="champion-pill">Fornecedor campeão</div>' : ''}
    </th>
  `).join('');

  const rows = input.items.map((item) => {
    const itemPrices = input.suppliers.map((supplier) => {
      const price = input.prices.find((p) => p.quotation_item_id === item.id && p.supplier_id === supplier.id);
      const allForItem = input.prices.filter((p) => p.quotation_item_id === item.id && p.price > 0);
      const min = allForItem.length ? Math.min(...allForItem.map((p) => p.price)) : null;
      const isMin = price && min !== null && price.price === min;
      return `
        <td class="price-cell ${isMin ? 'best' : ''}">
          ${price ? `
            <div class="price-value ${isMin ? 'best-value' : ''}">R$ ${money(price.price)}</div>
            ${isMin ? '<div class="best-badge">Menor preço</div>' : ''}
            <div class="price-meta">${price.delivery_days ? `${price.delivery_days} dia(s)` : '—'}</div>
          ` : '<span class="empty">—</span>'}
        </td>
      `;
    }).join('');

    return `
      <tr>
        <td class="item-cell">
          <div class="item-name">${item.name}</div>
          <div class="item-qty">${item.quantity} ${item.unit || 'UN'}</div>
        </td>
        ${itemPrices}
      </tr>
    `;
  }).join('');

  return `
    <table class="matrix-table">
      <thead>
        <tr>
          <th class="item-head">Item / Qtd</th>
          ${supplierHeaders}
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function buildListTable(input: MatrixPrintInput, championIds: Set<string>) {
  return input.items.map((item) => {
    const offersRaw = input.suppliers
      .map((supplier) => {
        const price = input.prices.find((p) => p.quotation_item_id === item.id && p.supplier_id === supplier.id);
        if (!price) return null;
        return { supplier, price };
      })
      .filter(Boolean) as Array<{ supplier: { id: string; name: string; city?: string }; price: { price: number; delivery_days?: number | null } }>;

    const min = offersRaw.length ? Math.min(...offersRaw.map((o) => o.price.price)) : null;

    const offers = offersRaw
      .sort((a, b) => a.price.price - b.price.price)
      .map(({ supplier, price }) => {
        const isMin = min !== null && price.price === min;
        const isChampion = championIds.has(supplier.id);
        return `
          <div class="list-offer ${isMin ? 'best' : ''} ${isChampion ? 'champion' : ''}">
            <div>
              <div class="offer-supplier">${supplier.name}${isChampion ? ' ★' : ''}</div>
              <div class="offer-city">${supplier.city || ''}</div>
              ${isMin ? '<div class="best-badge">Menor preço</div>' : ''}
            </div>
            <div class="offer-price ${isMin ? 'best-value' : ''}">R$ ${money(price.price)}</div>
          </div>
        `;
      })
      .join('');

    return `
      <div class="list-item">
        <div class="list-item-head">
          <div>
            <div class="item-name">${item.name}</div>
            <div class="item-qty">${item.quantity} ${item.unit || 'UN'}</div>
          </div>
        </div>
        <div class="list-offers">${offers || '<p class="empty">Sem cotações</p>'}</div>
      </div>
    `;
  }).join('');
}

export function buildMatrixPrintHtml(input: MatrixPrintInput) {
  const layout = input.layout || 'landscape';
  const isLandscape = layout === 'landscape';
  const quota = input.headerMeta.participationQuota;
  const champions = computeChampionSupplierIds(input);
  const championNames = input.suppliers.filter((s) => champions.has(s.id)).map((s) => s.name);

  return `
    <html>
      <head>
        <title>Análise Comparativa ${input.headerMeta.quotationCode || ''}</title>
        <style>
          @page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 8mm; }
          * { box-sizing: border-box; }
          body { font-family: Inter, "Segoe UI", Arial, sans-serif; margin: 0; color: #0f172a; background: #fff; font-size: 11px; }
          .toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 10; background: #0f172a; color: white; padding: 8px 14px; display: flex; justify-content: space-between; align-items: center; gap: 8px; }
          .toolbar-actions { display: flex; gap: 6px; }
          .toolbar button { background: #2563eb; color: white; border: 0; border-radius: 8px; padding: 7px 12px; font-weight: 800; font-size: 10px; text-transform: uppercase; cursor: pointer; }
          .toolbar button.secondary { background: #334155; }
          .content { padding: 56px 10px 10px; max-width: ${isLandscape ? '100%' : '860px'}; margin: 0 auto; }
          .hero { background: white; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 12px; margin-bottom: 8px; }
          .title { font-size: 16px; font-weight: 900; color: #1d4ed8; margin: 0 0 2px; }
          .subtitle { display: none; }
          .meta-grid { display: grid; grid-template-columns: repeat(${isLandscape ? 4 : 3}, 1fr); gap: 6px; }
          .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 6px 8px; }
          .meta-label { font-size: 8px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
          .meta-value { font-size: 11px; font-weight: 800; margin-top: 2px; line-height: 1.25; }
          .champion-banner { margin-top: 6px; background: #ecfdf5; border: 1px solid #6ee7b7; color: #065f46; border-radius: 8px; padding: 5px 8px; font-size: 10px; font-weight: 800; }
          .matrix-table { width: 100%; border-collapse: collapse; background: white; border: 1px solid #e2e8f0; }
          .matrix-table th, .matrix-table td { border-bottom: 1px solid #e2e8f0; border-right: 1px solid #f1f5f9; padding: 5px 6px; vertical-align: top; }
          .item-head, .item-cell { width: 160px; background: #f8fafc; }
          .supplier-head { background: #eff6ff; min-width: 110px; }
          .supplier-head.champion-head { background: #ecfdf5; border-bottom: 2px solid #10b981; }
          .supplier-name { font-size: 9px; font-weight: 800; color: #1e3a8a; line-height: 1.2; }
          .champion-head .supplier-name { color: #065f46; }
          .supplier-city { font-size: 8px; color: #64748b; margin-top: 1px; }
          .champion-pill { display:inline-block; margin-top:3px; font-size:7px; font-weight:900; text-transform:uppercase; color:#065f46; background:#a7f3d0; padding:1px 5px; border-radius:999px; }
          .item-name { font-size: 11px; font-weight: 800; line-height: 1.2; }
          .item-qty { font-size: 9px; color: #64748b; margin-top: 2px; }
          .price-cell.best { background: #ecfdf5; box-shadow: inset 0 0 0 1px #34d399; }
          .price-value { font-size: 11px; font-weight: 900; color: #0f172a; }
          .price-value.best-value { color: #047857; font-size: 12px; }
          .best-badge { display: inline-block; margin-top: 2px; font-size: 7px; font-weight: 900; text-transform: uppercase; color: #047857; background: #d1fae5; padding: 1px 4px; border-radius: 999px; }
          .price-meta { font-size: 8px; color: #64748b; margin-top: 1px; }
          .empty { color: #94a3b8; }
          .list-item { background: white; border: 1px solid #e2e8f0; border-radius: 8px; padding: 8px; margin-bottom: 6px; }
          .list-item-head { margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #f1f5f9; }
          .list-offers { display: grid; gap: 4px; }
          .list-offer { display: flex; justify-content: space-between; gap: 8px; padding: 6px 8px; background: #f8fafc; border-radius: 6px; border: 1px solid #e2e8f0; }
          .list-offer.best { background: #ecfdf5; border-color: #34d399; }
          .list-offer.champion { border-left: 3px solid #10b981; }
          .offer-supplier { font-size: 10px; font-weight: 800; }
          .offer-city { font-size: 8px; color: #64748b; }
          .offer-price { font-size: 11px; font-weight: 900; color: #1d4ed8; white-space: nowrap; }
          .offer-price.best-value { color: #047857; font-size: 12px; }
          @media print { .toolbar { display: none !important; } .content { padding: 0; } body { background: white; } }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <span>Pré-visualização — ${input.headerMeta.quotationCode || 'Matriz'}</span>
          <div class="toolbar-actions">
            <button class="secondary" onclick="window.close()">Fechar</button>
            <button onclick="window.print()">Imprimir</button>
          </div>
        </div>
        <div class="content">
          <div class="hero">
            <h1 class="title">Análise Comparativa</h1>
            <div class="meta-grid">
              <div class="meta-card"><div class="meta-label">Pré-Orçamento</div><div class="meta-value">${input.headerMeta.quotationCode || '—'}</div></div>
              <div class="meta-card"><div class="meta-label">Protocolo</div><div class="meta-value">${input.headerMeta.eventProtocol || '—'}</div></div>
              <div class="meta-card"><div class="meta-label">Associado</div><div class="meta-value">${input.headerMeta.associateName || '—'}</div></div>
              <div class="meta-card"><div class="meta-label">Veículo / Placa</div><div class="meta-value">${input.headerMeta.vehicleLabel || '—'}</div></div>
              <div class="meta-card"><div class="meta-label">Status</div><div class="meta-value">${input.headerMeta.eventStatus || '—'}</div></div>
              <div class="meta-card"><div class="meta-label">Abertura</div><div class="meta-value">${input.headerMeta.eventOpenedAt || '—'}</div></div>
              <div class="meta-card"><div class="meta-label">Cotação</div><div class="meta-value">${input.headerMeta.quotationCreatedAt || '—'}</div></div>
              ${quota ? `<div class="meta-card"><div class="meta-label">Cota</div><div class="meta-value">R$ ${money(Number(quota))}</div></div>` : ''}
            </div>
            ${championNames.length ? `<div class="champion-banner">Campeão: ${championNames.join(' · ')}</div>` : ''}
          </div>
          ${isLandscape ? buildLandscapeTable(input, champions) : buildListTable(input, champions)}
        </div>
      </body>
    </html>
  `;
}

export function openMatrixPrintPreview(input: MatrixPrintInput) {
  const html = buildMatrixPrintHtml(input);
  const win = window.open('', '_blank', input.layout === 'list' ? 'width=900,height=800' : 'width=1200,height=800');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
  return win;
}
