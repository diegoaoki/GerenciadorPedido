'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';

interface FichaOrder {
  id: string;
  externalOrderId: string;
  marketplace: string;
  status: string;
  buyerName?: string;
  grandTotal: string;
  placedAt: string;
  trackingCode?: string;
  shippingAddress?: Record<string, unknown>;
  items: Array<{
    id: string;
    sku: string;
    title: string;
    quantity: number;
    unitPrice: string;
    variant?: {
      attributes: Record<string, string>;
      product?: { productionDays: number; fulfillmentType: string };
    } | null;
    options: Array<{ id: string; name: string; value: string }>;
  }>;
}

export default function FichaPage() {
  const params = useParams<{ id: string }>();
  const [order, setOrder] = useState<FichaOrder | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    api
      .get<FichaOrder>(`/orders/${params.id}`)
      .then(setOrder)
      .catch((e) => setErr((e as Error).message));
  }, [params?.id]);

  if (err) return <div className="p-8 text-sm text-red-600">{err}</div>;
  if (!order) return <div className="p-8 text-sm text-slate-400">Carregando…</div>;

  const placed = new Date(order.placedAt);
  const productionDays = Math.max(
    7,
    ...order.items.map((it) => it.variant?.product?.productionDays ?? 0),
  );
  const deadline = new Date(placed.getTime() + productionDays * 24 * 60 * 60 * 1000);
  const daysLeft = Math.ceil((deadline.getTime() - Date.now()) / (24 * 60 * 60 * 1000));

  return (
    <div className="mx-auto max-w-2xl print:max-w-none">
      {/* Barra de ações — some na impressão */}
      <div className="mb-6 flex items-center justify-between print:hidden">
        <a href="/pedidos" className="text-sm text-brand hover:underline">
          ← Voltar aos pedidos
        </a>
        <button
          onClick={() => window.print()}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          🖨️ Imprimir / salvar PDF
        </button>
      </div>

      {/* Ficha */}
      <div className="rounded-xl border-2 border-slate-800 bg-white p-6 print:rounded-none print:border-black">
        <div className="flex items-start justify-between border-b-2 border-slate-800 pb-4 print:border-black">
          <div>
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Ficha de produção
            </div>
            <div className="text-2xl font-black">#{order.externalOrderId}</div>
            <div className="text-sm text-slate-600">
              {order.marketplace.replace('_', ' ')} · pedido em{' '}
              {placed.toLocaleDateString('pt-BR')}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
              Prazo de envio
            </div>
            <div
              className={`text-2xl font-black ${daysLeft <= 2 ? 'text-red-600' : ''}`}
            >
              {deadline.toLocaleDateString('pt-BR')}
            </div>
            <div className={`text-sm ${daysLeft <= 2 ? 'text-red-600' : 'text-slate-600'}`}>
              {daysLeft >= 0 ? `faltam ${daysLeft} dia(s)` : `ATRASADO ${-daysLeft} dia(s)`}
            </div>
          </div>
        </div>

        <div className="mt-4 text-sm">
          <span className="font-semibold">Cliente:</span> {order.buyerName ?? '—'}
        </div>

        {/* Itens */}
        <div className="mt-4 space-y-4">
          {order.items.map((it, idx) => (
            <div key={it.id} className="rounded-lg border border-slate-300 p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-lg font-bold">
                    {idx + 1}. {it.title}
                  </div>
                  <div className="font-mono text-xs text-slate-500">SKU: {it.sku}</div>
                  {it.variant?.attributes &&
                    Object.keys(it.variant.attributes).length > 0 && (
                      <div className="mt-1 text-sm">
                        {Object.entries(it.variant.attributes)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </div>
                    )}
                </div>
                <div className="rounded-lg border-2 border-slate-800 px-3 py-1 text-center print:border-black">
                  <div className="text-[10px] font-bold uppercase">Qtd</div>
                  <div className="text-2xl font-black">{it.quantity}</div>
                </div>
              </div>

              {/* Personalizações — o coração da ficha */}
              {it.options.length > 0 ? (
                <div className="mt-3 rounded-lg bg-amber-50 p-3 print:border print:border-black">
                  <div className="text-xs font-bold uppercase tracking-wide text-amber-700">
                    ⚠️ Personalização do cliente
                  </div>
                  {it.options.map((o) => (
                    <div key={o.id} className="mt-1 text-lg">
                      <span className="font-semibold">{o.name}:</span>{' '}
                      <span className="font-black">{o.value}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-3 text-xs text-slate-400">Sem personalização</div>
              )}
            </div>
          ))}
        </div>

        {/* Checklist de produção */}
        <div className="mt-6 border-t-2 border-slate-800 pt-4 print:border-black">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
            Acompanhamento
          </div>
          <div className="mt-2 grid grid-cols-4 gap-3 text-center text-sm">
            {['Produzido', 'Conferido', 'Embalado', 'Enviado'].map((etapa) => (
              <div key={etapa} className="rounded-lg border border-slate-300 p-3">
                <div className="mx-auto mb-1 h-6 w-6 rounded border-2 border-slate-800 print:border-black" />
                {etapa}
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-slate-400">
            Ficha gerada em {new Date().toLocaleString('pt-BR')} · Pedido {order.id}
          </div>
        </div>
      </div>
    </div>
  );
}
