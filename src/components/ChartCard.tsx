import { ReactNode } from "react";

const ChartCard = ({ title, children }: { title: string; children: ReactNode }) => (
  <div className="rounded-xl border border-[#244163] bg-[#0c1529] p-4">
    <h3 className="mb-3 text-sm font-semibold tracking-wide text-[#8eefff]">{title}</h3>
    {children}
  </div>
);

export default ChartCard;
