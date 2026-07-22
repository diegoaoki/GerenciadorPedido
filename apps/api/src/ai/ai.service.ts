import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import Anthropic from '@anthropic-ai/sdk';
import { Marketplace } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const MARKETPLACE_STYLE: Record<Marketplace, string> = {
  MERCADO_LIVRE:
    'Mercado Livre: descrição pode ser longa e detalhada, texto puro (sem HTML). Compradores pesquisam bastante — inclua especificações, diferenciais e informações de produção/envio.',
  SHOPEE:
    'Shopee: descrição curta e escaneável, público jovem, tom leve. Emojis são bem aceitos e comuns. Destaque promoções e personalização logo no início.',
  AMAZON:
    'Amazon: tom profissional e objetivo, foco em bullet points de benefícios e especificações. Sem emojis, sem superlativos exagerados.',
  MAGALU:
    'Magalu: descrição clara e confiável para consumidor de varejo nacional, tom amigável, parágrafos curtos.',
  AMERICANAS:
    'Americanas: semelhante ao varejo nacional, descrição clara, benefícios primeiro, parágrafos curtos.',
};

@Injectable()
export class AiService {
  private readonly client: Anthropic | null;

  constructor(private readonly prisma: PrismaService) {
    // O SDK resolve a credencial via ANTHROPIC_API_KEY.
    this.client = process.env.ANTHROPIC_API_KEY ? new Anthropic() : null;
  }

  /**
   * Gera uma sugestão de descrição para um produto em um marketplace,
   * usando os dados do catálogo (título, marca, opções, prazo) e a
   * descrição base como matéria-prima.
   */
  async suggestDescription(input: {
    productId: string;
    marketplace: Marketplace;
    draft?: string;
  }) {
    if (!this.client) {
      throw new ServiceUnavailableException(
        'IA não configurada: defina ANTHROPIC_API_KEY em apps/api/.env e reinicie a API.',
      );
    }

    const product = await this.prisma.product.findUnique({
      where: { id: input.productId },
      include: {
        variants: true,
        options: { include: { choices: true }, orderBy: { position: 'asc' } },
      },
    });
    if (!product)
      throw new NotFoundException(`Produto ${input.productId} não encontrado`);

    const optionsText = product.options
      .map((o) => {
        if (o.type === 'TEXT')
          return `- ${o.name} (personalização por texto, escolhida pelo cliente)`;
        const choices = o.choices
          .map(
            (c) =>
              `${c.label}${Number(c.priceModifier) > 0 ? ` (+R$${Number(c.priceModifier).toFixed(2)})` : ''}`,
          )
          .join(', ');
        return `- ${o.name}: ${choices}`;
      })
      .join('\n');

    const variantsText = product.variants
      .map((v) => {
        const attrs = Object.entries(
          (v.attributes as Record<string, string>) ?? {},
        )
          .map(([k, val]) => `${k}: ${val}`)
          .join(', ');
        return `- ${v.sku}${attrs ? ` (${attrs})` : ''} — R$${Number(v.basePrice).toFixed(2)}`;
      })
      .join('\n');

    const prompt = [
      `Escreva uma descrição de venda para o produto abaixo, otimizada para o marketplace indicado.`,
      ``,
      `## Produto`,
      `Título: ${product.title}`,
      product.brand ? `Marca: ${product.brand}` : null,
      product.category ? `Categoria: ${product.category}` : null,
      product.fulfillmentType === 'MADE_TO_ORDER'
        ? `Modelo: produzido sob encomenda após a compra, prazo de produção de ${product.productionDays} dias úteis. Isso DEVE ficar claro na descrição.`
        : null,
      variantsText ? `\n## Variações\n${variantsText}` : null,
      optionsText ? `\n## Opções que o cliente pode escolher\n${optionsText}` : null,
      product.description
        ? `\n## Descrição base escrita pelo vendedor (use como matéria-prima)\n${product.description}`
        : null,
      input.draft?.trim()
        ? `\n## Rascunho atual do vendedor para este marketplace (melhore a partir dele)\n${input.draft}`
        : null,
      ``,
      `## Marketplace de destino`,
      MARKETPLACE_STYLE[input.marketplace],
      ``,
      `## Regras`,
      `- Escreva em português do Brasil.`,
      `- Responda APENAS com o texto da descrição, sem preâmbulo, sem título, sem comentários.`,
      `- Não invente características que não estão nos dados acima.`,
      `- Não inclua preço na descrição (o marketplace já exibe).`,
    ]
      .filter((line): line is string => line !== null)
      .join('\n');

    const response = await this.client.messages.create({
      model: 'claude-opus-4-8',
      max_tokens: 1024,
      thinking: { type: 'adaptive' },
      messages: [{ role: 'user', content: prompt }],
    });

    const suggestion = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    return { suggestion };
  }
}
