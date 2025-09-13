export type FindCompletedOpts = {
  query: string;
  categoryId?: string; // Pokemon Singles: '183454'
  page?: number;
  perPage?: number;
};

export async function findCompletedItems({ query, categoryId, page = 1, perPage = 50 }: FindCompletedOpts) {
  const appId = process.env.EBAY_APP_ID;
  if (!appId) return { items: [] as any[], total: 0 };

  const params = new URLSearchParams({
    'OPERATION-NAME': 'findCompletedItems',
    'SERVICE-VERSION': '1.13.0',
    'SECURITY-APPNAME': appId,
    'GLOBAL-ID': process.env.EBAY_GLOBAL_ID || 'EBAY-US',
    'RESPONSE-DATA-FORMAT': 'JSON',
    'REST-PAYLOAD': 'true',
    'keywords': query,
    'paginationInput.entriesPerPage': String(perPage),
    'paginationInput.pageNumber': String(page),
    'itemFilter(0).name': 'SoldItemsOnly',
    'itemFilter(0).value(0)': 'true',
  });
  if (categoryId) params.set('categoryId', categoryId);

  const url = `https://svcs.ebay.com/services/search/FindingService/v1?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`eBay Finding ${res.status}`);
  const json = await res.json();

  const searchRes = json?.findCompletedItemsResponse?.[0];
  const ack = searchRes?.ack?.[0];
  if (ack !== 'Success') return { items: [], total: 0 };

  const items = (searchRes?.searchResult?.[0]?.item || []).map((it: any) => {
    const price = it?.sellingStatus?.[0]?.currentPrice?.[0];
    const ended = it?.listingInfo?.[0]?.endTime?.[0];
    return {
      itemId: it?.itemId?.[0],
      title: it?.title?.[0] || '',
      priceCents: Math.round(Number(price?.__value__) * 100),
      currency: price?.['@currencyId'] || 'USD',
      soldAt: ended ? new Date(ended) : null,
      url: it?.viewItemURL?.[0] || '',
    };
  });

  const total = Number(searchRes?.paginationOutput?.[0]?.totalEntries?.[0] || 0);
  return { items, total };
}

