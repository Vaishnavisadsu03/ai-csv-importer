import { CsvImporter } from "@/components/CsvImporter";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          {/* GrowEasy Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
                <path
                  d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"
                  fill="currentColor"
                  stroke="currentColor"
                  strokeWidth="1"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-lg font-bold leading-none text-primary">GrowEasy</h1>
              <p className="text-[10px] text-muted-foreground font-medium tracking-wide uppercase">AI CSV Importer</p>
            </div>
          </div>
          <ThemeToggle />
        </div>
      </header>

      {/* Hero banner — GrowEasy teal */}
      <div className="groweasy-gradient text-white py-10 px-4">
        <div className="container mx-auto max-w-5xl text-center">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
            AI-Powered CSV Importer
          </h2>
          <p className="mt-3 text-white/80 text-base sm:text-lg max-w-2xl mx-auto">
            Upload any CSV — Facebook exports, Google Ads, manual sheets — and our AI
            intelligently maps every column to your GrowEasy CRM fields.
          </p>

          {/* Feature pills */}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {[
              "🧠 AI Field Mapping",
              "📂 Any CSV Format",
              "⚡ Batch Processing",
              "🔄 Retry on Failure",
              "📥 Export JSON & CSV",
            ].map((feat) => (
              <span
                key={feat}
                className="rounded-full bg-white/15 border border-white/25 px-3 py-1 text-xs font-medium"
              >
                {feat}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Main content */}
      <main className="container py-8">
        <div className="mx-auto max-w-5xl">
          <CsvImporter />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 py-6">
        <div className="container text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} GrowEasy · AI CSV Importer · Built for GrowEasy CRM
        </div>
      </footer>
    </div>
  );
}
