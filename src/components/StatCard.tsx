const StatCard = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-[#244163] bg-[#0c1529] p-3">
    <p className="text-[11px] uppercase tracking-wider text-[#6ea8c9]">{label}</p>
    <p className="mt-1 font-mono text-lg text-[#d8f8ff]">{value}</p>
  </div>
);

export default StatCard;
