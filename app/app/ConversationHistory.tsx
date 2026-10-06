"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { latestMessagePage, mergeMessages, messageTime, olderMessageFilter, revalidateCachedMessages } from "../../lib/message-history.mjs";

type MessageRow={id:string;conversation_id:string;sender_id:string;body:string;created_at:string};
const PAGE_SIZE=50;
export function ConversationHistory({conversationId,currentUserId,otherName,otherReadAt,refreshKey}:{conversationId:string;currentUserId:string;otherName:string;otherReadAt?:string|null;refreshKey:string}) {
  const [rows,setRows]=useState<MessageRow[]>([]);
  const [hasMore,setHasMore]=useState(false);
  const [loading,setLoading]=useState(true);
  const [refreshing,setRefreshing]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [revision,setRevision]=useState(0);
  const state=useRef({rows:[] as MessageRow[],hasMore:false,busy:false});
  const root=useRef<HTMLDivElement>(null);

  useEffect(()=>{
    let active=true;
    const client=getSupabase();
    if(!client) return;
    const refresh=async()=>{
      if(state.current.busy || document.visibilityState!=="visible") return;
      state.current.busy=true;setRefreshing(true);
      try {
        const response=await client.from("messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id",conversationId).is("deleted_at",null).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(PAGE_SIZE+1);
        if(response.error) throw response.error;
        if(!active) return;
        const incoming=response.data.slice(0,PAGE_SIZE);
        let checked:MessageRow[]=[];
        try {
          checked=await revalidateCachedMessages(state.current.rows,incoming,conversationId,async(ids:string[])=>{
            const result=await client.rpc("conversation_message_history_subset" as never,{p_conversation_id:conversationId,p_message_ids:ids} as never);
            if(result.error)throw result.error;
            return result.data;
          });
        } catch {
          if(active)setNotice("Earlier history could not be rechecked and has been cleared from this view. Try loading earlier messages again.");
        }
        if(!active)return;
        const next=latestMessagePage(checked,incoming,response.data.length>PAGE_SIZE,state.current.hasMore);
        state.current.rows=next.rows;state.current.hasMore=next.hasMore;
        setRows(next.rows);setHasMore(next.hasMore);setError("");setLoading(false);
        if(next.gap) setNotice("Many new messages arrived. Showing the latest page; load earlier messages for the preceding history.");
        // Acknowledge only through a stored message that this response loaded.
        // Hidden tabs and failed history queries never mark messages read.
        if(incoming[0] && document.visibilityState==="visible") {
          const read=await client.rpc("mark_conversation_read_through" as never,{p_conversation_id:conversationId,p_message_id:incoming[0].id} as never);
          if(read.error && active) setNotice("Messages loaded, but read receipts could not be saved. They will retry automatically.");
        }
      } catch {if(active){state.current.rows=[];state.current.hasMore=false;setRows([]);setHasMore(false);setError("Message access could not be confirmed. History has been cleared from this view; refresh to try again.");setLoading(false);}}
      finally {state.current.busy=false;setRefreshing(false);}
    };
    void refresh();
    const timer=setInterval(()=>void refresh(),5000);
    document.addEventListener("visibilitychange",refresh);
    const channel=client.channel(`history-${conversationId}`).on("postgres_changes",{event:"UPDATE",schema:"public",table:"messages",filter:`conversation_id=eq.${conversationId}`},payload=>{
      if(!active) return;
      const row=payload.new as MessageRow & {deleted_at?:string|null;moderation_status?:string};
      const existing=state.current.rows;
      if(!existing.some(item=>item.id===row.id)) return;
      state.current.rows=row.deleted_at || (row.moderation_status && row.moderation_status!=="allowed") ? existing.filter(item=>item.id!==row.id) : mergeMessages(existing,[row]);
      setRows(state.current.rows);
    }).subscribe();
    return ()=>{active=false;clearInterval(timer);document.removeEventListener("visibilitychange",refresh);void client.removeChannel(channel);};
  },[conversationId,refreshKey,revision]);

  async function older() {
    const client=getSupabase(), cursor=state.current.rows[0];
    if(!client || !cursor || state.current.busy) return;
    state.current.busy=true;setLoading(true);setError("");
    const scroller=root.current?.closest(".thread-scroll");
    const before=scroller?.scrollHeight ?? 0;
    try {
      const response=await client.from("messages").select("id,conversation_id,sender_id,body,created_at").eq("conversation_id",conversationId).is("deleted_at",null).or(olderMessageFilter(cursor)).order("created_at",{ascending:false}).order("id",{ascending:false}).limit(PAGE_SIZE+1);
      if(response.error) throw response.error;
      if(!root.current) return;
      state.current.rows=mergeMessages(state.current.rows,response.data.slice(0,PAGE_SIZE));state.current.hasMore=response.data.length>PAGE_SIZE;
      setRows(state.current.rows);setHasMore(state.current.hasMore);
      requestAnimationFrame(()=>{if(scroller) scroller.scrollTop+=scroller.scrollHeight-before;});
    } catch {setError("Earlier messages could not be loaded. Try again; the current history has been kept.");}
    finally {state.current.busy=false;setLoading(false);}
  }

  return <div ref={root} aria-label="Conversation history">
    <div className="message-history-controls">
      <button type="button" disabled={loading || refreshing || !hasMore} onClick={()=>void older()}>Load earlier messages</button>
      <button type="button" disabled={loading || refreshing} onClick={()=>setRevision(value=>value+1)}>Refresh messages</button>
      <span>{rows.length} messages loaded{hasMore ? " · earlier history available" : loading ? "" : " · beginning of available history"}</span>
    </div>
    {loading&&<p role="status">Loading messages…</p>}
    {error&&<p role="alert">{error}</p>}
    {notice&&<p role="status">{notice}</p>}
    {rows.map(row=><div key={row.id} className={row.sender_id===currentUserId?"message mine":"message"}>
      <b>{row.sender_id===currentUserId ? "You" : otherName}</b><p>{row.body}</p>
      <small>{new Date(row.created_at).toLocaleString("en-BS",{timeZone:"America/Nassau"})} (Bahamas){row.sender_id===currentUserId&&otherReadAt&&messageTime(otherReadAt)>=messageTime(row.created_at)?" · Read":""}</small>
    </div>)}
    {!loading&&!error&&!rows.length&&<p>No messages yet. Start a secure booking conversation.</p>}
  </div>;
}
