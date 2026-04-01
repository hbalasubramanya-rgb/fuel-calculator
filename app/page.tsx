import FuelCalculator from './fuel-calculator'

export default function Home() {
  return (
    <main className="relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.34),_transparent_52%),radial-gradient(circle_at_78%_18%,_rgba(16,185,129,0.2),_transparent_34%)]" />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-8 sm:px-8 lg:px-10 lg:py-10">
        <section className="rounded-[2.5rem] border border-white/45 bg-white/72 px-6 py-8 shadow-[0_40px_120px_-60px_rgba(15,23,42,0.8)] backdrop-blur xl:px-10 xl:py-10">
          <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
            <div className="max-w-3xl">
              <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.26em] text-amber-900">
                Fuel Calculator
              </span>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Plan the cost of any drive with live route distance and local fuel pricing.
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                Choose a vehicle, map an origin and destination, auto-detect a
                nearby fuel price, and see fuel usage, total spend, and
                cost-per-kilometer before you leave.
              </p>
            </div>

            <div className="grid gap-3 rounded-[2rem] bg-slate-950 p-5 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300">
                Quick formula
              </p>
              <p className="text-sm leading-6 text-slate-300">
                Fuel needed = route distance / efficiency
              </p>
              <p className="text-sm leading-6 text-slate-300">
                Total cost = fuel needed x local fuel price
              </p>
            </div>
          </div>

          <div className="mt-8">
            <FuelCalculator />
          </div>
        </section>
      </div>
    </main>
  )
}
