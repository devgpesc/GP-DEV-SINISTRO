export type MatrixPrintLayout = 'landscape' | 'list';

type MatrixPrintInput = {
  headerMeta: {
    quotationCode?: string;
    eventProtocol?: string;
    associateName?: string;
    vehicleLabel?: string;
    participationQuota?: number | string | null;
  };
  items: Array<{ id: string; name: string; quantity: number; unit?: string }>;
  suppliers: Array<{ id: string; name: string; city?: string }>;
  prices: Array<{ quotation_item_id: string; supplier_id: string; price: number; delivery_days?: number | null; availability?: boolean }>;
  layout?: MatrixPrintLayout;
};

const money = (value: number) => value.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

function buildLandscapeTable(input: MatrixPrintInput) {
  const supplierHeaders = input.suppliers.map((s) => `
    <th class="supplier-head">
      <div class="supplier-name">${s.name}</div>
      <div class="supplier-city">${s.city || ''}</div>
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
            <div class="price-value">R$ ${money(price.price)}</div>
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

function buildListTable(input: MatrixPrintInput) {
  return input.items.map((item) => {
    const offers = input.suppliers.map((supplier) => {
      const price = input.prices.find((p) => p.quotation_item_id === item.id && p.supplier_id === supplier.id);
      if (!price) return '';
      return `
        <div class="list-offer">
          <div>
            <div class="offer-supplier">${supplier.name}</div>
            <div class="offer-city">${supplier.city || ''}</div>
          </div>
          <div class="offer-price">R$ ${money(price.price)}</div>
        </div>
      `;
    }).join('');

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

  return `
    <html>
      <head>
        <title>Análise Comparativa ${input.headerMeta.quotationCode || ''}</title>
        <style>
          @page { size: A4 ${isLandscape ? 'landscape' : 'portrait'}; margin: 12mm; }
          * { box-sizing: border-box; }
          body { font-family: Inter, "Segoe UI", Arial, sans-serif; margin: 0; color: #0f172a; background: #f8fafc; }
          .toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 10; background: #0f172a; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; gap: 12px; }
          .toolbar-actions { display: flex; gap: 8px; }
          .toolbar button { background: #2563eb; color: white; border: 0; border-radius: 12px; padding: 10px 16px; font-weight: 800; font-size: 11px; text-transform: uppercase; cursor: pointer; }
          .toolbar button.secondary { background: #334155; }
          .content { padding: 80px 20px 20px; max-width: ${isLandscape ? '100%' : '900px'}; margin: 0 auto; }
          .hero { background: white; border: 1px solid #e2e8f0; border-radius: 18px; padding: 18px; margin-bottom: 16px; }
          .title { font-size: 28px; font-weight: 900; color: #1d4ed8; margin: 0 0 6px; }
          .subtitle { color: #64748b; font-size: 13px; margin-bottom: 14px; }
          .meta-grid { display: grid; grid-template-columns: repeat(${isLandscape ? 5 : 2}, 1fr); gap: 10px; }
          .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px; }
          .meta-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; }
          .meta-value { font-size: 14px; font-weight: 800; margin-top: 4px; }
          .matrix-table { width: 100%; border-collapse: collapse; background: white; border-radius: 18px; overflow: hidden; border: 1px solid #e2e8f0; }
          .matrix-table th, .matrix-table td { border-bottom: 1px solid #e2e8f0; padding: 10px; vertical-align: top; }
          .item-head, .item-cell { width: 220px; background: #f8fafc; }
          .supplier-head { background: #eff6ff; min-width: 140px; }
          .supplier-name { font-size: 11px; font-weight: 800; color: #1e3a8a; }
          .supplier-city { font-size: 10px; color: #64748b; margin-top: 2px; }
          .item-name { font-size: 13px; font-weight: 800; }
          .item-qty { font-size: 11px; color: #64748b; margin-top: 4px; }
          .price-cell.best { background: #ecfdf5; border: 1px solid #86efac; }
          .price-value { font-size: 14px; font-weight: 900; color: #0f172a; }
          .best-badge { display: inline-block; margin-top: 4px; font-size: 9px; font-weight: 900; text-transform: uppercase; color: #047857; background: #d1fae5; padding: 2px 6px; border-radius: 999px; }
          .price-meta { font-size: 10px; color: #64748b; margin-top: 4px; }
          .empty { color: #94a3b8; }
          .list-item { background: white; border: 1px solid #e2e8f0; border-radius: 16px; padding: 14px; margin-bottom: 12px; }
          .list-item-head { margin-bottom: 10px; padding-bottom: 10px; border-bottom: 1px solid #f1f5f9; }
          .list-offers { display: grid; gap: 8px; }
          .list-offer { display: flex; justify-content: space-between; gap: 12px; padding: 10px 12px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0; }
          .offer-supplier { font-size: 12px; font-weight: 800; }
          .offer-city { font-size: 10px; color: #64748b; }
          .offer-price { font-size: 14px; font-weight: 900; color: #1d4ed8; white-space: nowrap; }
          @media print { .toolbar { display: none !important; } .content { padding-top: 0; } body { background: white; } }
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
            <p class="subtitle">Compare preços e aprove as melhores ofertas.</p>
            <div class="meta-grid">
              <div class="meta-card"><div class="meta-label">Pré-Orçamento</div><div class="meta-value">${input.headerMeta.quotationCode || '—'}</div></div>
              <div class="meta-card"><div class="meta-label">Sinistro</div><div class="meta-value">${input.headerMeta.eventProtocol || '—'}</div></div>
              <div class="meta-card"><div class="meta-label">Cliente</div><div class="meta-value">${input.headerMeta.associateName || '—'}</div></div>
              <div class="meta-card"><div class="meta-label">Veículo</div><div class="meta-value">${input.headerMeta.vehicleLabel || '—'}</div></div>
              ${quota ? `<div class="meta-card"><div class="meta-label">Cota Participação</div><div class="meta-value">R$ ${money(Number(quota))}</div></div>` : ''}
            </div>
          </div>
          ${isLandscape ? buildLandscapeTable(input) : buildListTable(input)}
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
