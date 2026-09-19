import { PRInputForm } from "@/components/landing/PRInputForm";
import { HowItWorks } from "@/components/landing/HowItWorks";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center px-8 py-16 sm:py-24">
      <main className="flex flex-col items-center text-center gap-8 max-w-3xl">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] bg-clip-text text-transparent">
            PRism
          </span>
        </h1>
        <p className="text-lg text-[#94A3B8] max-w-xl">
          Understand the architectural impact of any pull request before you
          merge.
        </p>
        <PRInputForm />
        <HowItWorks />
      </main>
    </div>
  );
}
