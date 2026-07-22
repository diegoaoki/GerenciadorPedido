'use client';

import { useEffect, useState } from 'react';
import { api, Order, Paginated } from '@/lib/api';
import { PageHeader, Card, Badge, brl, EmptyState } from '@/components/ui';

const STATUSES = ['PENDING', 'PAID', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await api.get<Paginated<Order>>(
      `/orders?take=100${filter ? `&status=${filter}` : ''}`,
    );
    setOrders(res.items);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function changeStatus(id: string, status: string) {
    let trackingCode: string | undefined;
    if (status === 'SHIPPED') {
      trackingCode =
        window.prompt('Código de rastreio (deixe vazio se não tiver):')?.trim() ||
        undefined;
    }
    const res = await api.patch<{ marketplaceSync?: { ok: boolean; error?: string } }>(
      `/orders/${id}/status`,
      { status, trackingCode },
    );
    if (res.marketplaceSync && !res.marketplaceSync.ok) {
      alert(
        `Status atualizado no hub, mas o marketplace respondeu:\n${res.marketplaceSync.error}`,
      );
    }
    load();
  }

  return (
    <>
      <PageHeader title="Pedidos" subtitle="Todos os marketplaces em uma fila só" />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip label="Todos" active={filter === ''} onClick={() => setFilter('')} />
        {STATUSES.map((s) => (
          <FilterChip key={s} label={s} active={filter === s} onClick={() => setFilter(s)} />
        ))}
      </div>

      {loading ? (
        <EmptyState>Carregando…</EmptyState>
      ) : orders.length === 0 ? (
        <EmptyState>
          Nenhum pedido {filter && `com status ${filter}`}. Pedidos aparecem aqui após a
          importação de um marketplace conectado.
        </EmptyState>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => (
            <Card key={o.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">
                    #{o.externalOrderId}{' '}
                    <span className="text-xs font-normal text-slate-400">· {o.marketplace}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    {o.buyerName ?? 'Cliente'} ·{' '}
                    {new Date(o.placedAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold">{brl(o.grandTotal)}</span>
                  <Badge status={o.status} />
                </div>
              </div>

              <div className="mt-3 border-t border-slate-100 pt-3 text-sm text-slate-600">
                {o.items.map((it, i) => (
                  <div key={i} className="flex justify-between">
                    <span>
                      {it.quantity}× {it.title}{' '}
                      <span className="font-mono text-xs text-slate-400">({it.sku})</span>
                    </span>
                    <span>{brl(it.unitPrice)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3 flex items-center gap-3">
                <span className="text-xs text-slate-400">Alterar status:</span>
                <select
                  value={o.status}
                  onChange={(e) => changeStatus(o.id, e.target.value)}
                  className="rounded border border-slate-300 px-2 py-1 text-xs"
                >
                  {STATUSES.concat('RETURNED').map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                <a
                  href={`/pedidos/${o.id}/ficha`}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  🖨️ Ficha de produção
                </a>
              </div>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs font-medium ${
        active ? 'bg-brand text-white' : 'bg-white text-slate-600 border border-slate-200'
      }`}
    >
      {label}
    </button>
  );
}
