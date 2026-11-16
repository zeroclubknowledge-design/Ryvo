import { useId } from "react";
import { getImageProps } from "next/image";

/** Pure CSS feedback: Suspense can replace it immediately, at any point in the cycle. */
export function RyvoLoadingScreen({label="Loading your next move"}:{label?:string}) {
 const id=useId().replaceAll(":","");
 const {props:logo}=getImageProps({src:"/ryvo-logo.png",alt:"",width:192,height:192});
 // The three clips follow the exposed edges of the original, overlapping logo shapes.
 const top="M0 0H1600V510H1120L1080 520L800 640L775 590L730 568L0 710Z";
 const green="M0 1220L385 1110L495 825L550 805L1075 1005L1100 1050L1070 1095L1600 1310V1600H0Z";
 const middle="M0 710L730 568L775 590L800 640L1080 520L1120 510H1600V1310L1070 1095L1100 1050L1075 1005L550 805L495 825L385 1110L0 1220Z";
 return <div className="ryvo-loader" role="status" aria-live="polite" aria-label={label}>
  <span className="ryvo-loader-label">{label}</span>
  <div className="ryvo-loader-center" aria-hidden="true">
   <svg className="ryvo-loader-logo" viewBox="160 170 1240 1340" focusable="false">
    <defs><clipPath id={`${id}-top`}><path d={top}/></clipPath><clipPath id={`${id}-middle`}><path d={middle}/></clipPath><clipPath id={`${id}-green`}><path d={green}/></clipPath></defs>
    <image className="ryvo-loader-outline" href={logo.src} width="1600" height="1600"/>
    <g clipPath={`url(#${id}-top)`}><image className="ryvo-loader-ink ryvo-loader-top" href={logo.src} width="1600" height="1600"/></g>
    <g clipPath={`url(#${id}-middle)`}><image className="ryvo-loader-ink ryvo-loader-middle" href={logo.src} width="1600" height="1600"/></g>
    <g clipPath={`url(#${id}-green)`}><image className="ryvo-loader-ink ryvo-loader-green" href={logo.src} width="1600" height="1600"/></g>
   </svg>
   <span className="ryvo-loader-wordmark">Ryvo</span>
  </div>
 </div>;
}
