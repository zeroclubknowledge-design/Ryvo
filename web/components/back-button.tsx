import Link from "next/link";
import { Icon } from "@/components/collection-art";

type BackProps={label?:string;ariaLabel:string;className?:string};
export function BackLink({href,label="Back",ariaLabel,className=""}:BackProps&{href:string}){
 return <Link href={href} prefetch className={`back-pill ${className}`} aria-label={ariaLabel}><Icon name="arrow" size={17}/><span>{label}</span></Link>;
}
export function BackButton({onClick,label="Back",ariaLabel,className=""}:BackProps&{onClick:()=>void}){
 return <button type="button" className={`back-pill ${className}`} aria-label={ariaLabel} onClick={onClick}><Icon name="arrow" size={17}/><span>{label}</span></button>;
}
