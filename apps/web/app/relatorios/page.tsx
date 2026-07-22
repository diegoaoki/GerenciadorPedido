'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, Stat, EmptyState, brl } from '@/components/ui';

interface Report {
  days: number;
  totals: {
    revenue: number;
    orders: number;
    avgTicket: number;
    cost: number;
    margin: number;
    marginPct: number;
    costCoverage: number;
  };
  byDay: Array<{ date: string; revenue: number; orders: number }>;
  byMarketplace: Array<{ marketplace: string; orders: number; revenue: number }>;
  topProducts: Array<{ sku: string; title: string; quantity: number; revenue: number }>;
}

const MARKETPLACE_LABELS: Record<string, string> = {
  MERCADO_LIVRE: 'Mercado Livre',
  SHOPEE: 'Shopee',
  AMAZON: 'Amazon',
  MAGALU: 'Magalu',
  AMERICANAS: 'Americanas',
};

const PERIODS = [7, 30, 90];

export default function RelatoriosPage() {
  const [days, setDays] = useState(30);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get<Report>(`/reports?days=${days}`)
      .then(setReport)
      .finally(() => setLoading(false));
  }, [days]);

  const maxDayRevenue = Math.max(1, ...(report?.byDay.map((d) => d.revenue) ?? [1]));
  const maxMkt = Math.max(1, ...(report?.byMarketplace.map((m) => m.revenue) ?? [1]));
  const maxQty = Math.max(1, ...(report?.topProducts.map((p) => p.quantity) ?? [1]));
  const bestDay = report?.byDay.reduce(
    (best, d) => (d.revenue > (best?.revenue ?? 0) ? d : best),
    null as null | { date: string; revenue: number },
  );

  return (
    <>
      <PageHeader
        title="Relatórios"
        subtitle="Vendas consolidadas de todos os marketplaces"
        action={
          <div className="flex gap-2">
            {PERIODS.map((p) => (
              <button
                key={p}
                onClick={() => setDays(p)}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  days === p
                    ? 'bg-brand text-white'
                    : 'border border-slate-200 bg-white text-slate-600'
                }`}
              >
                {p} dias
              </button>
            ))}
          </div>
        }
      />

      {loading || !report ? (
        <EmptyState>Carregando…</EmptyState>
      ) : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Receita" value={brl(report.totals.revenue)} />
            <Stat label="Pedidos" value={report.totals.orders} />
            <Stat label="Ticket médio" value={brl(report.totals.avgTicket)} />
            <Stat
              label="Margem estimada"
              value={`${brl(report.totals.margin)}`}
              hint={
                report.totals.costCoverage >= 99
                  ? `${report.totals.marginPct.toFixed(0)}% da receita`
                  : report.totals.costCoverage > 0
                    ? `custo cadastrado em ${report.totals.costCoverage.toFixed(0)}% dos itens`
                    : 'cadastre o preço de custo dos produtos'
              }
            />
          </div>

          {/* Receita por dia */}
          <Card className="mt-6">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Receita por dia</h2>
              {bestDay && bestDay.revenue > 0 && (
                <span className="text-xs text-slate-400">
                  melhor dia: {new Date(bestDay.date + 'T12:00:00').toLocaleDateString('pt-BR')}{' '}
                  ({brl(bestDay.revenue)})
                </span>
              )}
            </div>
            {report.totals.orders === 0 ? (
              <div className="py-8 text-center text-sm text-slate-400">
                Nenhuma venda no período.
              </div>
            ) : (
              <div className="flex h-36 items-end gap-[2px]">
                {report.byDay.map((d) => (
                  <div
                    key={d.date}
                    className="group relative flex-1"
                    title={`${new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR')} · ${brl(d.revenue)} · ${d.orders} pedido(s)`}
                  >
                    <div
                      className="mx-auto w-full rounded-t bg-brand transition-opacity group-hover:opacity-80"
                      style={{
                        height: `${Math.max(d.revenue > 0 ? 4 : 1, (d.revenue / maxDayRevenue) * 100)}%`,
                        opacity: d.revenue > 0 ? 1 : 0.15,
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
            <div className="mt-1 flex justify-between text-[10px] text-slate-400">
              <span>
                {new Date(report.byDay[0]?.date + 'T12:00:00').toLocaleDateString('pt-BR')}
              </span>
              <span>hoje</span>
            </div>
          </Card>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Por marketplace */}
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-700">
                Receita por marketplace
              </h2>
              {report.byMarketplace.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">Sem vendas.</div>
              ) : (
                <div className="space-y-3">
                  {report.byMarketplace.map((m) => (
                    <div key={m.marketplace}>
                      <div className="mb-1 flex justify-between text-sm">
                        <span className="font-medium">
                          {MARKETPLACE_LABELS[m.marketplace] ?? m.marketplace}
                        </span>
                        <span className="text-slate-600">
                          {brl(m.revenue)}{' '}
                          <span className="text-xs text-slate-400">({m.orders})</span>
                        </span>
                      </div>
                      <div className="h-2 rounded bg-slate-100">
                        <div
                          className="h-2 rounded bg-brand"
                          style={{ width: `${(m.revenue / maxMkt) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* Produtos mais vendidos */}
            <Card className="p-0">
              <h2 className="px-5 pt-5 text-sm font-semibold text-slate-700">
                Produtos mais vendidos
              </h2>
              {report.topProducts.length === 0 ? (
                <div className="py-6 text-center text-sm text-slate-400">Sem vendas.</div>
              ) : (
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400">
                      <th className="px-5 py-2">Produto</th>
                      <th className="px-5 py-2 text-right">Qtd</th>
                      <th className="px-5 py-2 text-right">Receita</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.topProducts.map((p) => (
                      <tr key={p.sku} className="border-t border-slate-50">
                        <td className="px-5 py-2">
                          <div className="font-medium">{p.title}</div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] text-slate-400">
                              {p.sku}
                            </span>
                            <div className="h-1 flex-1 rounded bg-slate-100">
                              <div
                                className="h-1 rounded bg-brand"
                                style={{ width: `${(p.quantity / maxQty) * 100}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-2 text-right font-semibold">{p.quantity}</td>
                        <td className="px-5 py-2 text-right">{brl(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
