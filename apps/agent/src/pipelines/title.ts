import { sharedPrisma as db } from '../../../../packages/shared/db.js';

export async function cardTitleForTweet(cardId: string): Promise<string> {
  const card = await db.card
    .findUnique({
      where: { id: cardId },
      select: { name: true, setCode: true, number: true, variantKey: true },
    })
    .catch(() => null);

  if (!card) return cardId;
  const left = [card.setCode, card.number].filter(Boolean).join(' ').toUpperCase();
  const variant = card.variantKey ? ` ${card.variantKey}` : '';
  const right = card.name ? ` — ${card.name}` : '';
  const composite = `${left}${variant}${right}`.trim();
  return composite || cardId;
}

