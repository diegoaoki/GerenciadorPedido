import { FulfillmentType } from '@prisma/client';

/**
 * Disponibilidade "virtual" para itens sob encomenda (MADE_TO_ORDER).
 * Sem limite de produção: anunciamos um número alto e o prazo de produção
 * (productionDays) informa o tempo de manuseio ao marketplace.
 */
export const MTO_VIRTUAL_AVAILABILITY = 999;

/**
 * Quantidade disponível para venda de uma variação, conforme o modelo
 * de entrega do produto:
 *  - STOCK:          quantidade física − reservado
 *  - MADE_TO_ORDER:  disponibilidade virtual (ilimitada na prática)
 */
export function availableForSale(
  fulfillmentType: FulfillmentType,
  inventory: { quantity: number; reserved: number } | null | undefined,
): number {
  if (fulfillmentType === 'MADE_TO_ORDER') return MTO_VIRTUAL_AVAILABILITY;
  return (inventory?.quantity ?? 0) - (inventory?.reserved ?? 0);
}
