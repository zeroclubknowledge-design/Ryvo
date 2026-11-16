import Link from "next/link";
import { Artwork, Icon } from "@/components/collection-art";

export function SceneBanner({ title, text, theme="explorer", href, label }: {
  title:string; text:string; theme?:string; href?:string; label?:string;
}) {
  return <section className={`scene-banner scene-${theme}`}>
    <Artwork theme={theme}/><div className="scene-banner-shade"/>
    <div className="scene-banner-copy"><h2>{title}</h2><p>{text}</p>
      {href&&<Link href={href}>{label}<Icon name="arrow" size={18}/></Link>}
    </div>
  </section>;
}
