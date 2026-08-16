"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import { useCrm } from "@/components/crm-provider";
import { CommercialTimeline } from "./commercial-timeline";

export default function ProspectLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  const { opportunities } = useCrm();
  const opportunity = opportunities.find((item) => item.accountId === id);

  return <>
    {children}
    {opportunity?.id && <CommercialTimeline opportunityId={opportunity.id} />}
  </>;
}
