'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'

const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 2,
})

type FieldConfig = {
  id: 'distance' | 'efficiency' | 'price'
  label: string
  suffix: string
  step: string
  help: string
}

const fields: FieldConfig[] = [
  {
    id: 'distance',
    label: 'Trip distance',
    suffix: 'km',
    step: '0.1',
    help: 'How far you are driving.',
  },
  {
    id: 'efficiency',
    label: 'Fuel efficiency',
    suffix: 'km/L',
    step: '0.1',
    help: 'Average distance your vehicle covers per liter.',
  },
  {
    id: 'price',
    label: 'Fuel price',
    suffix: 'per L',
    step: '0.01',
    help: 'Current fuel cost in your area.',
  },
]

export default function FuelCalculator() {
  const [distance, setDistance] = useState('240')
  const [efficiency, setEfficiency] = useState('14.5')
  const [price, setPrice] = useState('1.42')
  const [includeReturn, setIncludeReturn] = useState(false)

  const tripDistance = parseNumber(distance) * (includeReturn ? 2 : 1)
  const fuelEfficiency = parseNumber(efficiency)
  const fuelPrice = parseNumber(price)

  const litersNeeded =
    tripDistance > 0 && fuelEfficiency > 0 ? tripDistance / fuelEfficiency : 0
  const totalCost = litersNeeded * fuelPrice
  const costPerKm = tripDistance > 0 ? totalCost / tripDistance : 0

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(18rem,0.85fr)]">
      <div className="rounded-[2rem] border border-white/40 bg-white/85 p-6 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.7)] backdrop-blur xl:p-8">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5">
          <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-900">
            Interactive tool
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            Estimate fuel, total cost, and cost per kilometer.
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Enter your route distance, your vehicle efficiency, and the current
            pump price to get an instant trip estimate.
          </p>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {fields.map((field) => (
            <label
              key={field.id}
              className={`flex flex-col gap-2 rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4 ${
                field.id === 'distance' ? 'sm:col-span-2' : ''
              }`}
            >
              <span className="text-sm font-semibold text-slate-900">
                {field.label}
              </span>
              <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <input
                  className="w-full border-none bg-transparent text-lg font-medium text-slate-950 outline-none placeholder:text-slate-400"
                  inputMode="decimal"
                  min="0"
                  placeholder="0"
                  step={field.step}
                  type="number"
                  value={getValue(field.id, { distance, efficiency, price })}
                  onChange={(event) =>
                    updateValue(field.id, event.target.value, {
                      setDistance,
                      setEfficiency,
                      setPrice,
                    })
                  }
                />
                <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                  {field.suffix}
                </span>
              </div>
              <span className="text-xs leading-5 text-slate-500">
                {field.help}
              </span>
            </label>
          ))}
        </div>

        <label className="mt-5 flex items-center justify-between gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-950 px-5 py-4 text-white">
          <div>
            <div className="text-sm font-semibold">Include return trip</div>
            <div className="text-xs leading-5 text-slate-300">
              Doubles the distance for round-trip planning.
            </div>
          </div>
          <button
            aria-pressed={includeReturn}
            className={`relative h-8 w-14 rounded-full transition ${
              includeReturn ? 'bg-emerald-400' : 'bg-white/20'
            }`}
            type="button"
            onClick={() => setIncludeReturn((current) => !current)}
          >
            <span
              className={`absolute top-1 h-6 w-6 rounded-full bg-white transition ${
                includeReturn ? 'left-7' : 'left-1'
              }`}
            />
            <span className="sr-only">Toggle return trip</span>
          </button>
        </label>
      </div>

      <aside className="flex flex-col gap-4 rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_30px_90px_-50px_rgba(15,23,42,0.95)] xl:p-8">
        <div className="border-b border-white/10 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">
            Estimated totals
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Results update as you type. Set any field to zero to reset the
            estimate.
          </p>
        </div>

        <MetricCard
          label="Trip distance"
          value={`${numberFormat.format(tripDistance)} km`}
          tone="amber"
        />
        <MetricCard
          label="Fuel needed"
          value={`${numberFormat.format(litersNeeded)} L`}
          tone="emerald"
        />
        <MetricCard
          label="Total fuel cost"
          value={currencyFormat.format(totalCost)}
          tone="sky"
        />
        <MetricCard
          label="Cost per kilometer"
          value={currencyFormat.format(costPerKm)}
          tone="rose"
        />
      </aside>
    </section>
  )
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone: 'amber' | 'emerald' | 'sky' | 'rose'
}) {
  const toneClass = {
    amber: 'from-amber-300/20 to-amber-500/5 text-amber-100',
    emerald: 'from-emerald-300/20 to-emerald-500/5 text-emerald-100',
    sky: 'from-sky-300/20 to-sky-500/5 text-sky-100',
    rose: 'from-rose-300/20 to-rose-500/5 text-rose-100',
  }[tone]

  return (
    <div
      className={`rounded-[1.5rem] border border-white/10 bg-gradient-to-br ${toneClass} px-5 py-4`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/55">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-white">
        {value}
      </p>
    </div>
  )
}

function parseNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function getValue(
  fieldId: FieldConfig['id'],
  values: { distance: string; efficiency: string; price: string }
) {
  if (fieldId === 'distance') return values.distance
  if (fieldId === 'efficiency') return values.efficiency
  return values.price
}

function updateValue(
  fieldId: FieldConfig['id'],
  nextValue: string,
  setters: {
    setDistance: Dispatch<SetStateAction<string>>
    setEfficiency: Dispatch<SetStateAction<string>>
    setPrice: Dispatch<SetStateAction<string>>
  }
) {
  if (fieldId === 'distance') {
    setters.setDistance(nextValue)
    return
  }

  if (fieldId === 'efficiency') {
    setters.setEfficiency(nextValue)
    return
  }

  setters.setPrice(nextValue)
}
