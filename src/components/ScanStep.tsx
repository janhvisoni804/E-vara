const ScanStep = ({ label, active, complete }: { label: string; active: boolean; complete: boolean }) => (
  <div className={`rounded-md border px-3 py-2 font-mono text-xs transition-all ${active ? "border-[#00e5ff] bg-[#00e5ff1a] text-[#9ff6ff] shadow-[0_0_14px_#00e5ff66]" : complete ? "border-[#00e5ff55] text-[#86d8e8]" : "border-[#22344f] text-[#5f7a9c]"}`}>
    {label}
  </div>
);

export default ScanStep;
