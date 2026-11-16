"use client";
import { useRef, useState } from "react";
import { Select } from "@base-ui/react/select";
import { Icon } from "@/components/collection-art";

type Option={value:string;label:string};
type Props={value:string;onValueChange:(value:string)=>void;options:Option[];label:string;compact?:boolean;disabled?:boolean;name?:string};
/** Shared branded select for player, merchant and administration surfaces. */
export function RyvoSelect({value,onValueChange,options,label,compact=false,disabled=false,name}:Props){
 const trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),[container,setContainer]=useState<HTMLElement|undefined>(undefined);
 return <Select.Root value={value} items={options} disabled={disabled} name={name} open={open} onOpenChange={next=>{if(next)setContainer(trigger.current?.closest("dialog")??undefined);setOpen(next)}} onValueChange={next=>{if(next!==null)onValueChange(next)}}>
  <Select.Trigger ref={trigger} aria-label={label} className={`ryvo-select-trigger ${compact?"ryvo-select-compact":""}`}><Select.Value/><Select.Icon className="ryvo-select-chevron"><svg width="16" height="16" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m5 7.5 5 5 5-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg></Select.Icon></Select.Trigger>
  <Select.Portal container={container}><Select.Positioner className="ryvo-select-positioner" sideOffset={8} align="start" alignItemWithTrigger={false} collisionPadding={16}><Select.Popup className="ryvo-select-popup"><Select.List className="ryvo-select-list">{options.map(option=><Select.Item key={option.value} value={option.value} className="ryvo-select-option"><Select.ItemText>{option.label}</Select.ItemText><Select.ItemIndicator className="ryvo-select-check"><Icon name="check" size={16}/></Select.ItemIndicator></Select.Item>)}</Select.List></Select.Popup></Select.Positioner></Select.Portal>
 </Select.Root>;
}
