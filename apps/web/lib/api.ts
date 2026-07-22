/**
 * Cliente HTTP mínimo para a API. Usa caminhos relativos (/api/...) que o
 * next.config.mjs encaminha para a API NestJS — sem CORS no desenvolvimento.
 * Anexa o JWT salvo no login; em 401 redireciona para /login.
 */
const TOKEN_KEY = 'imp_token';
const ROLE_KEY = 'imp_role';

export const auth = {
  token: (): string | null =>
    typeof window === 'undefined' ? null : localStorage.getItem(TOKEN_KEY),
  role: (): string | null =>
    typeof window === 'undefined' ? null : localStorage.getItem(ROLE_KEY),
  setSession: (t: string, role: string) => {
    localStorage.setItem(TOKEN_KEY, t);
    localStorage.setItem(ROLE_KEY, role);
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ROLE_KEY);
    window.location.href = '/login';
  },
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = auth.token();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/login') {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = '/login';
    throw new Error('Sessão expirada');
  }
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

// ---- Tipos de resposta (parciais, o que o painel usa) ----

export interface Paginated<T> {
  items: T[];
  total: number;
  skip: number;
  take: number;
}

export interface Variant {
  id: string;
  sku: string;
  attributes: Record<string, string>;
  basePrice: string;
  inventory?: { quantity: number; reserved: number };
  listings?: { id: string; marketplace: string; status: string }[];
}

export interface OptionChoice {
  id: string;
  label: string;
  priceModifier: string;
}

export interface ProductOption {
  id: string;
  name: string;
  type: 'TEXT' | 'SELECT';
  required: boolean;
  choices: OptionChoice[];
}

export interface ChannelDescription {
  id: string;
  marketplace: string;
  description: string;
}

export interface Product {
  id: string;
  title: string;
  description?: string;
  brand?: string;
  category?: string;
  status: string;
  fulfillmentType: 'STOCK' | 'MADE_TO_ORDER';
  productionDays: number;
  variants: Variant[];
  options: ProductOption[];
  channelDescriptions: ChannelDescription[];
}

export interface InventoryRow {
  variantId: string;
  sku: string;
  product: string;
  attributes: Record<string, string>;
  fulfillmentType: 'STOCK' | 'MADE_TO_ORDER';
  productionDays: number;
  quantity: number;
  reserved: number;
  available: number;
}

export interface Order {
  id: string;
  marketplace: string;
  externalOrderId: string;
  status: string;
  buyerName?: string;
  grandTotal: string;
  placedAt: string;
  items: { sku: string; title: string; quantity: number; unitPrice: string }[];
}

export interface OrderSummary {
  byStatus: { status: string; _count: number }[];
  revenue: string | number;
  today: number;
}
