import { Suspense } from "react";
import AnalyzeContent from "./AnalyzeContent";

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col flex-1 items-center justify-center">
          <div className="text-[#94A3B8] text-sm">Loading...</div>
        </div>
      }
    >
      <AnalyzeContent />
    </Suspense>
  );
}
