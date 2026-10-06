const stampPattern = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/;
export function messageTime(value) {
  const match = typeof value === "string" && value.match(stampPattern);
  if (!match || !Number.isFinite(Date.parse(match[1] + match[3]))) throw new Error("Invalid message timestamp");
  return BigInt(Date.parse(match[1] + match[3])) * 1000n + BigInt((match[2] ?? "").padEnd(6, "0"));
}
export function compareMessages(a, b) {
  const left=messageTime(a.created_at), right=messageTime(b.created_at);
  return left < right ? -1 : left > right ? 1 : a.id.localeCompare(b.id);
}
export function olderMessageFilter(cursor) {
  messageTime(cursor.created_at);
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(cursor.id)) throw new Error("Invalid message cursor");
  return `created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`;
}
export function mergeMessages(current, incoming) {
  return [...new Map([...current,...incoming].map(row=>[row.id,row])).values()].sort(compareMessages);
}
export function latestMessagePage(current, incoming, pageHasMore, previousHasMore) {
  const latest=mergeMessages([],incoming);
  // Empty RLS results must clear previously visible bodies after access loss.
  if(!pageHasMore) return {rows:latest,hasMore:false,gap:false};
  const gap=Boolean(current.length && latest.length && compareMessages(latest[0],current.at(-1))>0 && pageHasMore);
  const older=latest.length ? current.filter(row=>compareMessages(row,latest[0])<0) : [];
  return { rows:gap ? latest : mergeMessages(older,latest), hasMore:older.length&&!gap ? previousHasMore : pageHasMore, gap };
}

// Revalidate loaded older bodies too: RLS-hidden updates may not be delivered by
// realtime, and refreshing only the latest page can retain stale older content.
export async function revalidateCachedMessages(current, incoming, conversationId, fetchBatch) {
  const newestIds=new Set(incoming.map(row=>row.id));
  const currentIds=new Set(current.map(row=>row.id));
  const ids=[...new Set(current.filter(row=>!newestIds.has(row.id)).map(row=>row.id))];
  const confirmed=[];
  for(let index=0;index<ids.length;index+=1000) {
    const batch=ids.slice(index,index+1000), requested=new Set(batch);
    const rows=await fetchBatch(batch);
    if(!Array.isArray(rows)) throw new Error('invalid_history_response');
    for(const row of rows) {
      if(!row || !requested.has(row.id) || row.conversation_id!==conversationId || typeof row.body!=='string' || typeof row.sender_id!=='string')
        throw new Error('invalid_history_response');
      messageTime(row.created_at);
    }
    confirmed.push(...rows);
  }
  return mergeMessages(confirmed,incoming.filter(row=>currentIds.has(row.id)));
}
