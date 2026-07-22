'use client';

import { useEffect, useState } from 'react';
import { api, OrderSummary, Paginated, Order, InventoryRow } from '@/lib/api';
import { PageHeader, Stat, Card, Badge, brl, EmptyState } from '@/components/ui';

export default function DashboardPage() {
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [recent, setRecent] = useState<Order[]>([]);
  const [lowStock, setLowStock] = useState<InventoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [s, orders, inv] = await Promise.all([
          api.get<OrderSummary>('/orders/summary'),
          api.get<Paginated<Order>>('/orders?take=5'),
          api.get<InventoryRow[]>('/inventory'),
        ]);
        setSummary(s);
        setRecent(orders.items);
        // Itens sob encomenda não entram no alerta (produção sem limite).
        setLowStock(
          inv.filter((r) => r.fulfillmentType === 'STOCK' && r.available <= 5).slice(0, 5),
        );
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  return (
    <>
      <PageHeader title="Painel" subtitle="Visão geral das suas vendas e estoque" />

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50 text-sm text-red-700">
          Não consegui falar com a API ({error}). Confirme que ela está rodando em
          <code className="mx-1">localhost:3333</code>.
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Stat label="Pedidos hoje" value={summary?.today ?? '—'} />
        <Stat label="Receita (pagos+)" value={summary ? brl(summary.revenue) : '—'} />
        <Stat
          label="Alertas de estoque"
          value={lowStock.length}
          hint="itens com ≤ 5 disponíveis"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Pedidos recentes</h2>
          {recent.length === 0 ? (
            <EmptyState>Nenhum pedido ainda.</EmptyState>
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-slate-100">
                {recent.map((o) => (
                  <li key={o.id} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="text-sm font-medium">#{o.externalOrderId}</div>
                      <div className="text-xs text-slate-400">{o.marketplace}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{brl(o.grandTotal)}</span>
                      <Badge status={o.status} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div>
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Estoque baixo</h2>
          {lowStock.length === 0 ? (
            <EmptyState>Tudo certo com o estoque. 👍</EmptyState>
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-slate-100">
                {lowStock.map((r) => (
                  <li key={r.variantId} className="flex items-center justify-between px-5 py-3">
                    <div>
                      <div className="text-sm font-medium">{r.sku}</div>
                      <div className="text-xs text-slate-400">{r.product}</div>
                    </div>
                    <span className="text-sm font-semibold text-red-600">{r.available}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
