const steps = [
  {
    number: "1",
    title: "Paste a PR",
    description: "Share a GitHub pull request URL",
  },
  {
    number: "2",
    title: "PRism maps its impact",
    description: "We analyze the architectural impact",
  },
  {
    number: "3",
    title: "Review the visual report",
    description: "See affected components at a glance",
  },
];

export function HowItWorks() {
  return (
    <section aria-label="How PRism works" className="w-full max-w-3xl mx-auto">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-[#94A3B8] mb-6">
        How it works
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        {steps.map((step) => (
          <div
            key={step.number}
            className="rounded-xl border border-[#273449] bg-[#111827] px-5 py-4"
          >
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#182235] text-sm font-semibold text-[#8B5CF6]">
                {step.number}
              </span>
              <h3 className="font-semibold text-[#F8FAFC]">{step.title}</h3>
            </div>
            <p className="text-sm text-[#94A3B8]">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
