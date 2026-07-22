'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { PageHeader, Card, EmptyState } from '@/components/ui';

const LABELS: Record<string, string> = {
  MERCADO_LIVRE: 'Mercado Livre',
  SHOPEE: 'Shopee',
  AMAZON: 'Amazon',
  MAGALU: 'Magalu',
  AMERICANAS: 'Americanas',
};

interface Account {
  id: string;
  marketplace: string;
  nickname: string;
  active: boolean;
  _count: { listings: number; orders: number };
}

export default function MarketplacesPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [supported, setSupported] = useState<string[]>([]);
  const [marketplace, setMarketplace] = useState('MERCADO_LIVRE');
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(true);

  async function load() {
    const [accs, sup] = await Promise.all([
      api.get<Account[]>('/marketplaces/accounts'),
      api.get<string[]>('/marketplaces/supported'),
    ]);
    setAccounts(accs);
    setSupported(sup);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
  }, []);

  async function addAccount() {
    if (!nickname) return;
    await api.post('/marketplaces/accounts', { marketplace, nickname });
    setNickname('');
    load();
  }

  const [feedback, setFeedback] = useState<string | null>(null);

  async function connectMl(accountId: string) {
    try {
      const { url } = await api.get<{ url: string }>(
        `/marketplaces/mercado-livre/connect/${accountId}`,
      );
      window.open(url, '_blank'); // usuário autoriza na aba do ML
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }

  async function importOrders(accountId: string) {
    setFeedback('Importando pedidos…');
    try {
      const res = await api.post<{ imported: number; error?: string }>(
        `/marketplaces/accounts/${accountId}/import-orders`,
      );
      setFeedback(
        res.error ? `Erro: ${res.error}` : `✅ ${res.imported} pedido(s) importado(s)/atualizado(s).`,
      );
    } catch (e) {
      setFeedback((e as Error).message);
    }
  }

  return (
    <>
      <PageHeader title="Marketplaces" subtitle="Conecte suas contas de vendas" />

      <Card className="mb-6">
        <div className="mb-3 text-sm font-semibold">Conectar nova conta</div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">Marketplace</span>
            <select
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
            >
              {(supported.length ? supported : Object.keys(LABELS)).map((m) => (
                <option key={m} value={m}>
                  {LABELS[m] ?? m}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-slate-500">Apelido</span>
            <input
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Minha Loja ML"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button
            onClick={addAccount}
            disabled={!nickname}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Conectar
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          As credenciais/OAuth de cada canal serão configuradas por aqui na próxima etapa.
        </p>
      </Card>

      {loading ? (
        <EmptyState>Carregando…</EmptyState>
      ) : accounts.length === 0 ? (
        <EmptyState>Nenhuma conta conectada ainda.</EmptyState>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {accounts.map((a) => (
            <Card key={a.id}>
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">{a.nickname}</div>
                  <div className="text-xs text-slate-400">{LABELS[a.marketplace] ?? a.marketplace}</div>
                </div>
                <span
                  className={`h-2.5 w-2.5 rounded-full ${a.active ? 'bg-green-500' : 'bg-slate-300'}`}
                  title={a.active ? 'Ativa' : 'Inativa'}
                />
              </div>
              <div className="mt-4 flex gap-6 text-sm">
                <div>
                  <div className="text-xs text-slate-400">Anúncios</div>
                  <div className="font-semibold">{a._count.listings}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Pedidos</div>
                  <div className="font-semibold">{a._count.orders}</div>
                </div>
              </div>

              <div className="mt-4 flex gap-2 border-t border-slate-100 pt-3">
                {a.marketplace === 'MERCADO_LIVRE' && (
                  <button
                    onClick={() => connectMl(a.id)}
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                  >
                    🔗 Conectar
                  </button>
                )}
                <button
                  onClick={() => importOrders(a.id)}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                >
                  ⬇️ Importar pedidos
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {feedback && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
          {feedback}
        </div>
      )}
    </>
  );
}
