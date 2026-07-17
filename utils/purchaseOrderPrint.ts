export type PrintOrientation = 'portrait' | 'landscape';

export function buildPurchaseOrderHtml(order: any, orientation: PrintOrientation = 'portrait') {
  const isLandscape = orientation === 'landscape';
  const itemsHtml = order.items?.map((item: any) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0;">${item.name}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center;">${item.quantity} ${item.unit || ''}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right;">R$ ${(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: right; font-weight: 700;">R$ ${(item.total || (item.price * item.quantity)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
    </tr>
  `).join('') || '';

  return `
    <html>
      <head>
        <title>Ordem de Compra ${order.code}</title>
        <style>
          @page { size: A4 ${orientation}; margin: ${isLandscape ? '12mm' : '18mm'}; }
          * { box-sizing: border-box; }
          body { font-family: Inter, "Segoe UI", Arial, sans-serif; margin: 0; color: #0f172a; }
          .toolbar { position: fixed; top: 0; left: 0; right: 0; z-index: 10; background: #0f172a; color: white; padding: 12px 20px; display: flex; justify-content: space-between; align-items: center; }
          .toolbar button { background: #2563eb; color: white; border: 0; border-radius: 12px; padding: 10px 18px; font-weight: 800; font-size: 12px; text-transform: uppercase; cursor: pointer; }
          .content { padding: 80px 24px 24px; }
          .topbar { display: flex; justify-content: space-between; font-size: 11px; color: #64748b; margin-bottom: ${isLandscape ? '8px' : '14px'}; }
          .title { font-size: ${isLandscape ? '28px' : '34px'}; font-weight: 900; color: #1d4ed8; line-height: 1.05; margin: 8px 0 ${isLandscape ? '10px' : '16px'} 0; }
          .subtitle { font-size: 12px; color: #64748b; margin-bottom: 14px; }
          .meta-grid { display: grid; grid-template-columns: ${isLandscape ? 'repeat(3, 1fr)' : '1fr 1fr'}; gap: 10px; margin-bottom: 16px; }
          .meta-card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px; }
          .meta-label { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
          .meta-value { font-size: 14px; font-weight: 700; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          thead tr { background: #eff6ff; }
          th { text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: .3px; color: #1e3a8a; padding: 10px 12px; border-bottom: 1px solid #bfdbfe; }
          td { font-size: 13px; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
          .right, th.right { text-align: right; }
          .center, th.center { text-align: center; }
          .totals { margin-top: 18px; display: flex; justify-content: flex-end; }
          .total-box { min-width: 240px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 12px; padding: 12px; }
          .total-label { font-size: 10px; font-weight: 800; text-transform: uppercase; color: #1e3a8a; margin-bottom: 4px; }
          .total-value { font-size: 28px; font-weight: 900; color: #1e3a8a; text-align: right; line-height: 1; }
          .footer { margin-top: 24px; display: flex; justify-content: space-between; font-size: 11px; color: #64748b; }
          @media print { .toolbar { display: none !important; } .content { padding-top: 0; } }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <span>Pré-visualização — ${order.code}</span>
          <button onclick="window.print()">Imprimir</button>
        </div>
        <div class="content">
          <div class="topbar">
            <span>${new Date().toLocaleString('pt-BR')}</span>
            <span>Ordem de Compra ${order.code}</span>
          </div>
          <div class="title">Ordem de Compra ${order.code}</div>
          <div class="subtitle">Documento gerado automaticamente pela matriz de cotações.</div>
          <div class="meta-grid">
            <div class="meta-card"><div class="meta-label">Cliente</div><div class="meta-value">${order.customerName || 'Cliente não vinculado'}</div></div>
            <div class="meta-card"><div class="meta-label">Fornecedor</div><div class="meta-value">${order.supplierName}</div></div>
            <div class="meta-card"><div class="meta-label">Documento</div><div class="meta-value">${order.customerDocument || 'Não informado'}</div></div>
            <div class="meta-card"><div class="meta-label">Data</div><div class="meta-value">${new Date(order.createdAt).toLocaleDateString('pt-BR')}</div></div>
            <div class="meta-card"><div class="meta-label">Veículo</div><div class="meta-value">${order.vehicleLabel || 'Não vinculado'}</div></div>
            <div class="meta-card"><div class="meta-label">Sinistro</div><div class="meta-value">${order.eventProtocol || 'Não vinculado'}</div></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th class="center">Qtd</th>
                <th class="right">Unitário</th>
                <th class="right">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <div class="totals">
            <div class="total-box">
              <div class="total-label">Total da Ordem</div>
              <div class="total-value">R$ ${order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            </div>
          </div>
          <div class="footer">
            <span>Status: ${order.status}</span>
            <span>${order.items?.length || 0} item(ns)</span>
          </div>
        </div>
      </body>
    </html>
  `;
}

export function openPurchaseOrderPreview(order: any, orientation: PrintOrientation = 'portrait') {
  const html = buildPurchaseOrderHtml(order, orientation);
  const win = window.open('', '_blank', orientation === 'landscape' ? 'width=1200,height=800' : 'width=900,height=700');
  if (win) {
    win.document.write(html);
    win.document.close();
  }
  return win;
}
