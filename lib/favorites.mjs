export function checkFavoriteConfirmation(value, sellerId, favorite) {
  if (value?.ok !== true || value.seller_id !== sellerId || value.favorite !== favorite) {
    throw new Error('Saved-provider change was not confirmed. Please refresh and try again.');
  }
  return value;
}

export function applyFavorite(ids, sellerId, favorite) {
  const without = ids.filter(id => id !== sellerId);
  return favorite ? [...without, sellerId] : without;
}

/** Read every private bookmark with stable keyset pagination, not a silent API cap. */
export async function loadFavoriteIds(fetchPage) {
  const ids = [];
  let cursor = null;
  for (;;) {
    const { data, error } = await fetchPage(cursor);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Saved providers could not be loaded');
    if (!data.length) return ids;
    for (const item of data) {
      if (typeof item.seller_id !== 'string' || (cursor && item.seller_id <= cursor)) throw new Error('Invalid saved-provider page');
      ids.push(item.seller_id);
      cursor = item.seller_id;
    }
  }
}
