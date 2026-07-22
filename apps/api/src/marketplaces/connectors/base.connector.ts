import { Logger } from '@nestjs/common';
import { Marketplace } from '@prisma/client';
import {
  ConnectorContext,
  ConnectorResult,
  MarketplaceConnector,
  NormalizedOrder,
  PublishListingInput,
} from './connector.interface';

/**
 * Base opcional para os conectores. Cada método real deve ser
 * sobrescrito; o padrão retorna "não implementado" para deixar
 * explícito o que ainda falta em cada marketplace.
 */
export abstract class BaseConnector implements MarketplaceConnector {
  abstract readonly marketplace: Marketplace;
  protected readonly logger = new Logger(this.constructor.name);

  protected notImplemented<T = unknown>(op: string): ConnectorResult<T> {
    const error = `[${this.constructor.name}] "${op}" ainda não implementado`;
    this.logger.warn(error);
    return { ok: false, error };
  }

  async publishListing(
    _input: PublishListingInput,
  ): Promise<ConnectorResult<{ externalListingId: string }>> {
    return this.notImplemented<{ externalListingId: string }>('publishListing');
  }

  async updateStock(
    _externalListingId: string,
    _quantity: number,
    _ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    return this.notImplemented('updateStock');
  }

  async updatePrice(
    _externalListingId: string,
    _price: number,
    _ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    return this.notImplemented('updatePrice');
  }

  async closeListing(
    _externalListingId: string,
    _ctx: ConnectorContext,
  ): Promise<ConnectorResult> {
    return this.notImplemented('closeListing');
  }

  async fetchOrders(
    _since: Date,
    _ctx: ConnectorContext,
  ): Promise<ConnectorResult<NormalizedOrder[]>> {
    return { ok: true, data: [] };
  }
}
