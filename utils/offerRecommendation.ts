export interface ComparableOffer {
  supplier_id: string;
  price: number;
  delivery_days?: number | null;
  availability?: boolean;
}

export interface OfferRecommendation {
  bestPrice: number;
  bestDeliveryDays: number | null;
  supplierIds: string[];
  priceTie: boolean;
  technicalTie: boolean;
  reason: 'lowest-price' | 'fastest-delivery' | 'technical-tie';
}

const sameMoney = (first: number, second: number) => Math.abs(first - second) < 0.005;

const deliveryRank = (offer: ComparableOffer) => {
  const days = Number(offer.delivery_days);
  return Number.isFinite(days) && days >= 0 ? days : Number.POSITIVE_INFINITY;
};

export const getOfferRecommendation = (offers: ComparableOffer[]): OfferRecommendation | null => {
  const availableOffers = offers
    .filter((offer) => offer.availability !== false)
    .filter((offer) => Number.isFinite(Number(offer.price)) && Number(offer.price) > 0);

  if (availableOffers.length === 0) return null;

  const sorted = [...availableOffers].sort((first, second) => {
    const priceDifference = Number(first.price) - Number(second.price);
    if (!sameMoney(Number(first.price), Number(second.price))) return priceDifference;
    return deliveryRank(first) - deliveryRank(second);
  });

  const bestPrice = Number(sorted[0].price);
  const lowestPriceOffers = sorted.filter((offer) => sameMoney(Number(offer.price), bestPrice));
  const bestDeliveryRank = Math.min(...lowestPriceOffers.map(deliveryRank));
  const recommendedOffers = lowestPriceOffers.filter((offer) => deliveryRank(offer) === bestDeliveryRank);
  const technicalTie = recommendedOffers.length > 1;

  return {
    bestPrice,
    bestDeliveryDays: Number.isFinite(bestDeliveryRank) ? bestDeliveryRank : null,
    supplierIds: recommendedOffers.map((offer) => offer.supplier_id),
    priceTie: lowestPriceOffers.length > 1,
    technicalTie,
    reason: technicalTie ? 'technical-tie' : lowestPriceOffers.length > 1 ? 'fastest-delivery' : 'lowest-price',
  };
};

