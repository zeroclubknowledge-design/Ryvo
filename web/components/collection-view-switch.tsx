import Link from "next/link";
import { Icon } from "@/components/collection-art";

export function CollectionViewSwitch({id,view}:{id:string;view:"collectible"|"board"}) {
 return <nav className="collection-view-switch" aria-label="Collection view">
  <Link href={`/collection/${id}`} aria-current={view==="collectible"?"page":undefined}><Icon name="spark" size={14}/><span>Collectible</span></Link>
  <Link href={`/board/${id}`} aria-current={view==="board"?"page":undefined}><Icon name="boards" size={14}/><span>My board</span></Link>
 </nav>;
}
