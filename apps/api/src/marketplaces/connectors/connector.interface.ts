import { Marketplace } from '@prisma/client';

/**
 * Contrato que TODO marketplace deve implementar.
 *
 * O núcleo do hub só conhece esta interface — nunca os detalhes de cada
 * API. Adicionar um marketplace novo = criar uma classe que implementa
 * isto e registrá-la no ConnectorRegistry. Nada mais no sistema muda.
 */
export interface MarketplaceConnector {
  readonly marketplace: Marketplace;

  /** Publica (ou recria) um anúncio a partir dos dados do hub. */
  publishListing(input: PublishListingInput): Promise<ConnectorResult<{ externalListingId: string }>>;

  /** Atualiza a quantidade disponível de um anúncio já publicado. */
  updateStock(externalListingId: string, quantity: number, ctx: ConnectorContext): Promise<ConnectorResult>;

  /** Atualiza o preço de um anúncio já publicado. */
  updatePrice(externalListingId: string, price: number, ctx: ConnectorContext): Promise<ConnectorResult>;

  /** Pausa ou encerra um anúncio no marketplace. */
  closeListing(externalListingId: string, ctx: ConnectorContext): Promise<ConnectorResult>;

  /** Busca pedidos novos/atualizados desde uma data. */
  fetchOrders(since: Date, ctx: ConnectorContext): Promise<ConnectorResult<NormalizedOrder[]>>;
}

/** Credenciais/tokens da conta conectada, repassados a cada chamada. */
export interface ConnectorContext {
  accountId: string;
  credentials: Record<string, unknown>;
}

export interface PublishListingInput {
  ctx: ConnectorContext;
  title: string;
  description?: string;
  sku: string;
  price: number;
  quantity: number;
  images: string[];
  attributes: Record<string, unknown>;
}

/** Pedido já traduzido para o formato unificado do hub. */
export interface NormalizedOrder {
  externalOrderId: string;
  status: string;
  placedAt: Date;
  buyerName?: string;
  buyerEmail?: string;
  buyerDoc?: string;
  itemsTotal: number;
  shippingTotal: number;
  grandTotal: number;
  shippingAddress?: Record<string, unknown>;
  trackingCode?: string;
  items: NormalizedOrderItem[];
}

export interface NormalizedOrderItem {
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  externalListingId?: string;
}

export interface ConnectorResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
