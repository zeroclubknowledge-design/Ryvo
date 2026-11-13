"use client";

import { useLinkStatus } from "next/link";

export function NavigationFeedback({active}:{active:boolean}) {
 const {pending}=useLinkStatus();
 return <span aria-hidden className={`nav-link-feedback ${pending?"is-pending":active?"is-active":""}`}/>;
}
