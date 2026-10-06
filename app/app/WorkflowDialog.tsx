"use client";

import { useEffect, useRef, type ReactNode } from "react";

export function WorkflowDialog({children,className,onClose}: {children:ReactNode;className?:string;onClose:()=>void}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog=ref.current;
    if (!dialog) return;
    const opener=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialog.showModal();
    return () => { dialog.close(); if(opener?.isConnected)opener.focus({preventScroll:true}); };
  }, []);
  // Native modal dialog owns backdrop dismissal and keyboard focus containment.
  // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
  return <dialog ref={ref} className={className} aria-label="Nanas workflow dialog" onCancel={event=>{event.preventDefault();onClose();}} onClick={event=>{if(event.target===event.currentTarget)onClose();}} onKeyDown={event=>{
    if(event.key!=="Tab")return;
    const controls=Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])')).filter(element=>element.getClientRects().length>0);
    const first=controls[0],last=controls.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }}>{children}</dialog>;
}
