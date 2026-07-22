'use client';

import { useEffect, useState } from 'react';
import { api, InventoryRow } from '@/lib/api';
import { PageHeader, Card, EmptyState } from '@/components/ui';

export default function EstoquePage() {
  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    const data = await api.get<InventoryRow[]>('/inventory');
    setRows(data);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function adjust(variantId: string, delta: number) {
    await api.post(`/inventory/${variantId}/adjust`, { delta, reason: 'Ajuste manual pelo painel' });
    load();
  }

  return (
    <>
      <PageHeader
        title="Estoque"
        subtitle="Quantidade única por SKU — sincroniza para todos os marketplaces"
      />
      {loading ? (
        <EmptyState>Carregando…</EmptyState>
      ) : rows.length === 0 ? (
        <EmptyState>Sem itens em estoque. Cadastre produtos primeiro.</EmptyState>
      ) : (
        <Card className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs text-slate-400">
                <th className="px-5 py-3">SKU</th>
                <th className="px-5 py-3">Produto</th>
                <th className="px-5 py-3 text-right">Físico</th>
                <th className="px-5 py-3 text-right">Reservado</th>
                <th className="px-5 py-3 text-right">Disponível</th>
                <th className="px-5 py-3 text-center">Ajustar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.variantId} className="border-b border-slate-50">
                  <td className="px-5 py-3 font-mono text-xs">{r.sku}</td>
                  <td className="px-5 py-3">{r.product}</td>
                  {r.fulfillmentType === 'MADE_TO_ORDER' ? (
                    <td colSpan={3} className="px-5 py-3 text-right text-sm text-purple-600">
                      Sob encomenda · produção {r.productionDays} dias
                    </td>
                  ) : (
                    <>
                      <td className="px-5 py-3 text-right">{r.quantity}</td>
                      <td className="px-5 py-3 text-right text-amber-600">{r.reserved}</td>
                      <td className={`px-5 py-3 text-right font-semibold ${r.available <= 5 ? 'text-red-600' : ''}`}>
                        {r.available}
                      </td>
                    </>
                  )}
                  <td className="px-5 py-3 text-center">
                    {r.fulfillmentType === 'MADE_TO_ORDER' ? (
                      <span className="text-xs text-slate-300">—</span>
                    ) : (
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => adjust(r.variantId, -1)}
                          className="h-7 w-7 rounded border border-slate-300 hover:bg-slate-100"
                        >
                          −
                        </button>
                        <button
                          onClick={() => adjust(r.variantId, 1)}
                          className="h-7 w-7 rounded border border-slate-300 hover:bg-slate-100"
                        >
                          +
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
