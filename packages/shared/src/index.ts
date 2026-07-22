/**
 * Tipos e enums compartilhados entre a API e o painel web.
 * Espelham (sem acoplar) os enums do Prisma para uso no frontend.
 */

export const MARKETPLACES = [
  'MERCADO_LIVRE',
  'SHOPEE',
  'AMAZON',
  'MAGALU',
  'AMERICANAS',
] as const;

export type Marketplace = (typeof MARKETPLACES)[number];

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  MERCADO_LIVRE: 'Mercado Livre',
  SHOPEE: 'Shopee',
  AMAZON: 'Amazon',
  MAGALU: 'Magalu',
  AMERICANAS: 'Americanas',
};

export type ProductStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

export type ListingStatus =
  | 'DRAFT' // criado no hub, ainda não publicado
  | 'PUBLISHING' // enviando ao marketplace
  | 'ACTIVE' // publicado e ativo
  | 'PAUSED' // pausado no marketplace
  | 'ERROR' // falha na última sincronização
  | 'CLOSED'; // encerrado

export type OrderStatus =
  | 'PENDING' // aguardando pagamento
  | 'PAID' // pago
  | 'PROCESSING' // em separação
  | 'SHIPPED' // enviado
  | 'DELIVERED' // entregue
  | 'CANCELLED' // cancelado
  | 'RETURNED'; // devolvido

export type StockMovementType =
  | 'INBOUND' // entrada (compra/produção)
  | 'OUTBOUND' // saída (venda)
  | 'ADJUSTMENT' // ajuste manual
  | 'RESERVATION' // reserva por pedido
  | 'RELEASE'; // liberação de reserva

/** Payload de sincronização que o hub envia para um conector. */
export interface StockSyncPayload {
  externalListingId: string;
  availableQuantity: number;
}

export interface PriceSyncPayload {
  externalListingId: string;
  price: number;
}

/** Resultado padronizado de qualquer operação de conector. */
export interface ConnectorResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}
