// Connected entries come from the approved, published seller_directory view.
// Display completeness must not invent healthcare credential requirements for
// household, tutoring or pet-care providers. Participant-only stubs stay hidden.
export function isDiscoverableProvider(user) {
  const details = user.sellerDetails;
  return Boolean(user.role === 'seller' && user.status === 'active' && details && details.published !== false
    && details.services.some(service => service.id && service.name && (service.bio?.trim().length ?? 0) >= 40)
    && (details.locality || details.island));
}

export async function loadDirectoryRows(fetchPage) {
  const rows = [];
  let cursor = null;
  for (;;) {
    const {data,error} = await fetchPage(cursor);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Provider directory unavailable');
    if (!data.length) return rows;
    for (const row of data) {
      if (typeof row.user_id !== 'string' || (cursor && row.user_id <= cursor)) throw new Error('Invalid provider directory page');
      rows.push(row);
      cursor = row.user_id;
    }
  }
}

export function providerMatchesService(provider, family) {
  if (family === 'all') return true;
  return provider.sellerDetails?.services.some(service => {
    const slug = service.slug ?? service.id;
    return slug === family || slug.startsWith(family + '-')
      || (family === 'home-healthcare' && (/^adult-care-/.test(slug) || ['home-nursing','post-hospital-care','physiotherapy','disability-care'].includes(slug)))
      || (family === 'senior-care' && slug === 'respite-care');
  }) ?? false;
}

export function filterPublicProviders(providers, filters) {
  const query = (filters.search ?? '').trim().toLowerCase();
  const lowest = provider => Math.min(...(provider.sellerDetails?.services.map(s => s.rate).filter(rate => rate > 0) ?? []));
  return providers.filter(provider => {
    const details = provider.sellerDetails;
    const area = `${details?.locality ?? ''} ${details?.island ?? ''}`.toLowerCase();
    const areaMatches = filters.area === 'all' || area.includes(filters.area.toLowerCase()) || (filters.area === 'freeport' && area.includes('grand bahama')) || (filters.area === 'nassau' && area.includes('new providence'));
    return providerMatchesService(provider, filters.service) && areaMatches
      && (!query || `${provider.name} ${details?.headline ?? ''} ${details?.services.map(s=>s.name).join(' ') ?? ''}`.toLowerCase().includes(query));
  }).sort((a,b) => {
    const delta = filters.sort === 'lowest-rate' ? lowest(a)-lowest(b) : filters.sort === 'highest-rated' ? (b.sellerDetails?.rating ?? 0)-(a.sellerDetails?.rating ?? 0) : (b.sellerDetails?.completedBookings ?? 0)-(a.sellerDetails?.completedBookings ?? 0);
    return delta || a.id.localeCompare(b.id);
  });
}
