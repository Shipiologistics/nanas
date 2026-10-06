"use client";

import {useEffect,useRef,useState,type FormEvent} from "react";
import {adminCommand} from "../../lib/nanas-api";
import {getSupabase} from "../../lib/supabase";
import styles from "./admin-message-audit.module.css";

type Context={case_id:string;purpose_code:string;reason:string};
type Cursor={id:string;created_at:string}|null;
type EvidencePage={audit_id:string;access_expires_at:string;has_more:boolean;next_cursor:Cursor;messages:{id:string;sender_id:string;body:string;created_at:string;moderation_status:string;message_type:string}[]};
const blank:Context={case_id:"",purpose_code:"dispute-review",reason:""};

export function AdminMessageAudit({conversationId,adminUserId}:{conversationId:string;adminUserId:string}) {
 const [draft,setDraft]=useState<Context>(blank);
 const [context,setContext]=useState<Context|null>(null);
 const [page,setPage]=useState<EvidencePage|null>(null);
 const [trail,setTrail]=useState<Cursor[]>([null]);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [sessionLost,setSessionLost]=useState(false);
 const attempt=useRef(0),pending=useRef(false);
 useEffect(()=>{
  const invalidate=()=>{attempt.current++;pending.current=false;};
  const clear=(message:string)=>{invalidate();setBusy(false);setPage(null);setContext(null);setDraft(blank);setTrail([null]);setError(message);};
  const visibility=()=>{if(document.visibilityState!=="visible")clear("Evidence cleared when this tab was hidden. Authorize a new read to continue.");};
  document.addEventListener("visibilitychange",visibility);
  const subscription=getSupabase()?.auth.onAuthStateChange((event,session)=>{
   if(event==="SIGNED_OUT"||session?.user.id!==adminUserId){clear("The administrator session changed. Reopen this view after signing in.");setSessionLost(true);}
  }).data.subscription;
  return ()=>{invalidate();subscription?.unsubscribe();document.removeEventListener("visibilitychange",visibility);};
 },[adminUserId,conversationId]);
 useEffect(()=>{
  if(!page)return;
  const timer=setTimeout(()=>{attempt.current++;pending.current=false;setBusy(false);setPage(null);setContext(null);setDraft(blank);setTrail([null]);setError("Recent-authentication access expired. Sign out and sign in again before reopening evidence.");},Math.max(0,Date.parse(page.access_expires_at)-Date.now()));
  return ()=>clearTimeout(timer);
 },[page]);

 async function load(next:Context,nextTrail:Cursor[]) {
  if(pending.current||sessionLost)return;
  const token=++attempt.current;pending.current=true;setBusy(true);setPage(null);setError("");setContext(next);setTrail(nextTrail);
  const cursor=nextTrail.at(-1);
  try {
   const result=await adminCommand("read_messages",{conversation_id:conversationId,...next,before_id:cursor?.id??null,before_created_at:cursor?.created_at??null,limit:50});
   if(attempt.current!==token)return;
   setPage(result as EvidencePage);
  } catch(cause) {if(attempt.current===token)setError(cause instanceof Error?cause.message:"Message access could not be confirmed. No evidence is displayed.");}
  finally {if(attempt.current===token){pending.current=false;setBusy(false);}}
 }
 function submit(event:FormEvent<HTMLFormElement>){
  event.preventDefault();const form=new FormData(event.currentTarget);
  const next={case_id:String(form.get("caseId")).trim(),purpose_code:String(form.get("purpose")),reason:String(form.get("reason")).trim()};
  setDraft(next);void load(next,[null]);
 }
 function changeContext(){attempt.current++;pending.current=false;setBusy(false);setPage(null);setContext(null);setTrail([null]);setError("");}

 return <section className={styles.root} aria-label="Case-scoped message evidence">
  <h2>Purpose-gated message access</h2>
  <p>Each page requires a sign-in within the last ten minutes, message-read permission and permission for the selected case type. Each successful read records the case, reason and page size.</p>
  <p>Use an open booking-linked dispute, support or safety case, or a report about a message or booking review. An account-only case or profile report does not authorize all conversations.</p>
  {error&&<p role="alert" className={styles.notice}>{error}</p>}
  {!context?<form className="portal-form" onSubmit={submit}>
   <label>Access purpose<select name="purpose" defaultValue={draft.purpose_code} disabled={sessionLost}>
    <option value="dispute-review">Dispute review</option><option value="safety-incident">Safety incident</option><option value="support-case">Support case</option><option value="moderation-review">Moderation review</option>
   </select></label>
   <label>Authorized case UUID<input name="caseId" required minLength={36} maxLength={36} defaultValue={draft.case_id} placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" disabled={sessionLost}/></label>
   <label>Access reason<textarea name="reason" required minLength={5} maxLength={1000} defaultValue={draft.reason} disabled={sessionLost}/></label>
   <button type="submit" disabled={busy||sessionLost}>Record purpose and open latest messages</button>
  </form>:<>
   <p>Case <code>{context.case_id}</code> · {context.purpose_code} · page {trail.length}</p>
   <p>Reason: {context.reason}</p>
   <div className={styles.actions}>
    <button type="button" disabled={busy} onClick={()=>void load(context,[null])}>Latest messages</button>
    <button type="button" disabled={busy||trail.length<2} onClick={()=>void load(context,trail.slice(0,-1))}>Newer messages</button>
    <button type="button" disabled={busy||!page?.has_more} onClick={()=>void load(context,[...trail,page!.next_cursor])}>Earlier messages</button>
    {!page&&!busy&&<button type="button" onClick={()=>void load(context,trail)}>Retry this page</button>}
    <button type="button" onClick={changeContext}>Clear evidence / change case</button>
   </div>
   {busy&&<p role="status">Checking case access and recording this read…</p>}
   {page&&<>
    <p role="status">{page.messages.length} messages loaded. {page.has_more?"Earlier history is available.":"Beginning of retained history reached."}</p>
    <p>Access record: <code>{page.audit_id}</code>. This is a read-only evidence view; it does not send messages or mark participant messages read.</p>
    <ol className={styles.messages} aria-label="Authorized message evidence">
     {[...page.messages].reverse().map(message=><li key={message.id}>
      <header><span>Sender: <code>{message.sender_id}</code></span><time dateTime={message.created_at}>{new Date(message.created_at).toLocaleString()}</time></header>
      <p>{message.body}</p>
      <small>{message.message_type} · moderation: {message.moderation_status}</small>
     </li>)}
    </ol>
   </>}
  </>}
 </section>;
}
