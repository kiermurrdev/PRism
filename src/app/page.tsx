export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center">
      <main className="flex flex-col items-center justify-center gap-8 py-32 px-8 max-w-3xl text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          <span className="bg-gradient-to-r from-[#8B5CF6] to-[#22D3EE] bg-clip-text text-transparent">
            PRism
          </span>
        </h1>
        <p className="text-lg text-[#94A3B8]">
          Pull Request Impact Analysis
        </p>
      </main>
    </div>
  );
}
