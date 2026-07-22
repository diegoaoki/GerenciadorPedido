'use client';

import { useEffect, useState } from 'react';
import { api, Paginated, Product } from '@/lib/api';
import { PageHeader, Card, Badge, brl, EmptyState } from '@/components/ui';

const MARKETPLACE_LABELS: Record<string, string> = {
  MERCADO_LIVRE: 'Mercado Livre',
  SHOPEE: 'Shopee',
  AMAZON: 'Amazon',
  MAGALU: 'Magalu',
  AMERICANAS: 'Americanas',
};

export default function ProdutosPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const res = await api.get<Paginated<Product>>(
      `/products?take=100${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    );
    setProducts(res.items);
    setLoading(false);
  }

  useEffect(() => {
    load().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <PageHeader
        title="Produtos"
        subtitle="Catálogo central — a fonte da verdade dos seus itens"
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            {showForm ? 'Fechar' : '+ Novo produto'}
          </button>
        }
      />

      {showForm && <NewProductForm onCreated={() => { setShowForm(false); load(); }} />}

      <div className="mb-4 flex gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && load()}
          placeholder="Buscar por título, marca ou SKU…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
        />
        <button onClick={load} className="rounded-lg border border-slate-300 px-4 text-sm">
          Buscar
        </button>
      </div>

      {loading ? (
        <EmptyState>Carregando…</EmptyState>
      ) : products.length === 0 ? (
        <EmptyState>Nenhum produto cadastrado. Crie o primeiro acima.</EmptyState>
      ) : (
        <div className="space-y-4">
          {products.map((p) => (
            <Card key={p.id}>
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-semibold">{p.title}</div>
                  <div className="text-xs text-slate-400">
                    {p.brand ?? 'sem marca'} · {p.category ?? 'sem categoria'}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {p.fulfillmentType === 'MADE_TO_ORDER' && (
                    <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                      Sob encomenda · {p.productionDays}d
                    </span>
                  )}
                  <Badge status={p.status} />
                </div>
              </div>

              {p.options.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {p.options.map((o) => (
                    <span
                      key={o.id}
                      className="rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600"
                      title={
                        o.type === 'SELECT'
                          ? o.choices
                              .map(
                                (c) =>
                                  `${c.label}${Number(c.priceModifier) ? ` (+${brl(c.priceModifier)})` : ''}`,
                              )
                              .join(', ')
                          : 'Texto do cliente'
                      }
                    >
                      {o.type === 'TEXT' ? '✏️' : '⚙️'} {o.name}
                      {o.required && <span className="text-red-500">*</span>}
                    </span>
                  ))}
                </div>
              )}
              <table className="mt-4 w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-400">
                    <th className="pb-2">SKU</th>
                    <th className="pb-2">Variação</th>
                    <th className="pb-2">Preço</th>
                    <th className="pb-2">Estoque</th>
                    <th className="pb-2">Anúncios</th>
                  </tr>
                </thead>
                <tbody>
                  {p.variants.map((v) => (
                    <tr key={v.id} className="border-t border-slate-100">
                      <td className="py-2 font-mono text-xs">{v.sku}</td>
                      <td className="py-2">
                        {Object.entries(v.attributes ?? {})
                          .map(([k, val]) => `${k}: ${val}`)
                          .join(', ') || '—'}
                      </td>
                      <td className="py-2">{brl(v.basePrice)}</td>
                      <td className="py-2">
                        {p.fulfillmentType === 'MADE_TO_ORDER'
                          ? 'sob encomenda'
                          : (v.inventory?.quantity ?? 0)}
                      </td>
                      <td className="py-2">{v.listings?.length ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <ChannelDescriptions product={p} onSaved={load} />
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

/** Editor de descrições por marketplace, com "copiar da descrição base". */
function ChannelDescriptions({ product, onSaved }: { product: Product; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState<string | null>(null); // marketplace em geração

  async function suggestWithAi(marketplace: string) {
    setAiLoading(marketplace);
    setErr(null);
    try {
      const res = await api.post<{ suggestion: string }>('/ai/suggest-description', {
        productId: product.id,
        marketplace,
        draft: drafts[marketplace] || undefined,
      });
      setDrafts((d) => ({ ...d, [marketplace]: res.suggestion }));
    } catch (e) {
      const msg = (e as Error).message;
      setErr(
        msg.includes('503') || msg.includes('ANTHROPIC_API_KEY')
          ? 'IA não configurada: adicione sua ANTHROPIC_API_KEY em apps/api/.env e reinicie a API.'
          : msg,
      );
    } finally {
      setAiLoading(null);
    }
  }

  const filled = product.channelDescriptions.length;

  function openEditor() {
    // Carrega o que já existe no banco para os rascunhos.
    const initial: Record<string, string> = {};
    for (const m of Object.keys(MARKETPLACE_LABELS)) {
      initial[m] =
        product.channelDescriptions.find((d) => d.marketplace === m)?.description ?? '';
    }
    setDrafts(initial);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      await api.put(`/products/${product.id}/descriptions`, {
        entries: Object.entries(drafts).map(([marketplace, description]) => ({
          marketplace,
          description,
        })),
      });
      setSavedMsg(true);
      setTimeout(() => setSavedMsg(false), 2500);
      onSaved();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={openEditor}
        className="mt-4 text-xs font-medium text-brand hover:underline"
      >
        📝 Descrições por marketplace
        {filled > 0 && ` (${filled} personalizada${filled > 1 ? 's' : ''})`}
      </button>
    );
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-semibold">Descrições por marketplace</span>
        <button onClick={() => setOpen(false)} className="text-xs text-slate-400">
          fechar
        </button>
      </div>

      <div className="mb-3 rounded-md bg-white p-3 text-xs text-slate-500">
        <span className="font-medium text-slate-600">Descrição base:</span>{' '}
        {product.description?.trim() || <em>— produto sem descrição base —</em>}
      </div>

      <div className="space-y-3">
        {Object.entries(MARKETPLACE_LABELS).map(([key, label]) => (
          <div key={key}>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-xs font-medium text-slate-600">{label}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => suggestWithAi(key)}
                  disabled={aiLoading !== null}
                  className="text-xs text-purple-600 hover:underline disabled:cursor-wait disabled:text-slate-300"
                  title={`Gerar descrição para ${label} com IA, a partir dos dados do produto${drafts[key]?.trim() ? ' e do rascunho atual' : ''}`}
                >
                  {aiLoading === key ? '✨ Gerando…' : '✨ Sugerir com IA'}
                </button>
                <button
                  onClick={() => setDrafts((d) => ({ ...d, [key]: product.description ?? '' }))}
                  disabled={!product.description?.trim()}
                  className="text-xs text-brand hover:underline disabled:cursor-not-allowed disabled:text-slate-300"
                  title={
                    product.description?.trim()
                      ? 'Copiar a descrição base para este marketplace'
                      : 'Produto sem descrição base para copiar'
                  }
                >
                  ⧉ Copiar da base
                </button>
              </div>
            </div>
            <textarea
              value={drafts[key] ?? ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
              rows={3}
              placeholder={`Vazio = usa a descrição base ao publicar no ${label}`}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
        ))}
      </div>

      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
      <div className="mt-3 flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          {saving ? 'Salvando…' : 'Salvar descrições'}
        </button>
        {savedMsg && <span className="text-xs text-green-600">✓ Salvo</span>}
      </div>
    </div>
  );
}

interface DraftChoice {
  label: string;
  priceModifier: string;
}
interface DraftOption {
  name: string;
  type: 'TEXT' | 'SELECT';
  required: boolean;
  choices: DraftChoice[];
}

function NewProductForm({ onCreated }: { onCreated: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [brand, setBrand] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [productionDays, setProductionDays] = useState('7');
  const [options, setOptions] = useState<DraftOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function addOption(type: 'TEXT' | 'SELECT') {
    setOptions((o) => [
      ...o,
      { name: '', type, required: false, choices: type === 'SELECT' ? [{ label: '', priceModifier: '0' }] : [] },
    ]);
  }
  function updateOption(i: number, patch: Partial<DraftOption>) {
    setOptions((o) => o.map((opt, idx) => (idx === i ? { ...opt, ...patch } : opt)));
  }
  function removeOption(i: number) {
    setOptions((o) => o.filter((_, idx) => idx !== i));
  }

  async function submit() {
    setSaving(true);
    setErr(null);
    try {
      await api.post('/products', {
        title,
        description: description || undefined,
        brand: brand || undefined,
        fulfillmentType: 'MADE_TO_ORDER',
        productionDays: Number(productionDays) || 7,
        variants: [{ sku, basePrice: Number(price), initialStock: 0 }],
        options: options
          .filter((o) => o.name.trim())
          .map((o) => ({
            name: o.name,
            type: o.type,
            required: o.required,
            choices:
              o.type === 'SELECT'
                ? o.choices
                    .filter((c) => c.label.trim())
                    .map((c) => ({ label: c.label, priceModifier: Number(c.priceModifier) || 0 }))
                : undefined,
          })),
      });
      onCreated();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mb-6">
      <div className="mb-3 text-sm font-semibold">Novo produto sob encomenda</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Título" value={title} onChange={setTitle} placeholder="Camiseta Personalizada" />
        <Field label="Marca" value={brand} onChange={setBrand} placeholder="MinhaMarca" />
        <Field label="SKU" value={sku} onChange={setSku} placeholder="CAM-M" />
        <Field label="Preço (R$)" value={price} onChange={setPrice} placeholder="59.90" />
        <Field label="Prazo de produção (dias)" value={productionDays} onChange={setProductionDays} placeholder="7" />
      </div>

      <label className="mt-3 block text-sm">
        <span className="mb-1 block text-xs text-slate-500">
          Descrição base (usada em todos os marketplaces; personalizável por canal depois)
        </span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Descreva o produto…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      {/* Editor de opções */}
      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-semibold">Opções do item</span>
          <div className="flex gap-2">
            <button onClick={() => addOption('TEXT')} className="rounded border border-slate-300 px-2 py-1 text-xs">
              + Personalização (texto)
            </button>
            <button onClick={() => addOption('SELECT')} className="rounded border border-slate-300 px-2 py-1 text-xs">
              + Adicional (escolha)
            </button>
          </div>
        </div>

        {options.length === 0 && (
          <p className="text-xs text-slate-400">
            Nenhuma opção. Ex.: personalização “Nome estampado” (texto) ou adicional “Tipo de estampa” (escolha com preço).
          </p>
        )}

        <div className="space-y-3">
          {options.map((opt, i) => (
            <div key={i} className="rounded-lg border border-slate-200 p-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs">
                  {opt.type === 'TEXT' ? '✏️ Texto' : '⚙️ Escolha'}
                </span>
                <input
                  value={opt.name}
                  onChange={(e) => updateOption(i, { name: e.target.value })}
                  placeholder={opt.type === 'TEXT' ? 'Nome estampado' : 'Tipo de estampa'}
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                />
                <label className="flex items-center gap-1 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={opt.required}
                    onChange={(e) => updateOption(i, { required: e.target.checked })}
                  />
                  obrigatório
                </label>
                <button onClick={() => removeOption(i)} className="text-xs text-red-500">
                  remover
                </button>
              </div>

              {opt.type === 'SELECT' && (
                <div className="mt-2 space-y-2 pl-2">
                  {opt.choices.map((c, ci) => (
                    <div key={ci} className="flex items-center gap-2">
                      <input
                        value={c.label}
                        onChange={(e) =>
                          updateOption(i, {
                            choices: opt.choices.map((cc, idx) => (idx === ci ? { ...cc, label: e.target.value } : cc)),
                          })
                        }
                        placeholder="Ex.: Bordado"
                        className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                      <span className="text-xs text-slate-400">+R$</span>
                      <input
                        value={c.priceModifier}
                        onChange={(e) =>
                          updateOption(i, {
                            choices: opt.choices.map((cc, idx) =>
                              idx === ci ? { ...cc, priceModifier: e.target.value } : cc,
                            ),
                          })
                        }
                        className="w-20 rounded border border-slate-300 px-2 py-1 text-sm"
                      />
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      updateOption(i, { choices: [...opt.choices, { label: '', priceModifier: '0' }] })
                    }
                    className="text-xs text-brand"
                  >
                    + adicionar escolha
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
      <button
        onClick={submit}
        disabled={saving || !title || !sku || !price}
        className="mt-4 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {saving ? 'Salvando…' : 'Salvar produto'}
      </button>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-xs text-slate-500">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-slate-300 px-3 py-2"
      />
    </label>
  );
}
