'use client'

import { useEffect, useEffectEvent, useState } from 'react'

const numberFormat = new Intl.NumberFormat('en-IN', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
})

const currencyFormat = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
})

type FuelType = 'gasoline' | 'premium' | 'diesel'

type VehiclePreset = {
  id: string
  name: string
  fuelType: FuelType
  efficiency: string
  note: string
}

type RouteAlternative = {
  id: string
  label: string
  distanceKm: number
  durationMinutes: number
}

type RouteResult = {
  distanceKm: number
  durationMinutes: number
  originLabel: string
  destinationLabel: string
  alternatives: RouteAlternative[]
}

type FuelLookupResult = {
  locationLabel: string
  pricePerLiter: number
  fuelType: FuelType
  sourceLabel: string
  releaseDate: string | null
  estimated: boolean
}

const vehiclePresets: VehiclePreset[] = [
  {
    id: 'compact-petrol',
    name: 'Compact car',
    fuelType: 'gasoline',
    efficiency: '17.8',
    note: 'Good for city driving and short road trips.',
  },
  {
    id: 'family-sedan',
    name: 'Family sedan',
    fuelType: 'gasoline',
    efficiency: '14.5',
    note: 'Balanced comfort and fuel economy.',
  },
  {
    id: 'hybrid',
    name: 'Hybrid',
    fuelType: 'gasoline',
    efficiency: '23.5',
    note: 'Lower fuel use for frequent commuting.',
  },
  {
    id: 'suv',
    name: 'SUV',
    fuelType: 'premium',
    efficiency: '10.4',
    note: 'Higher fuel use with premium fuel.',
  },
  {
    id: 'pickup-diesel',
    name: 'Pickup truck',
    fuelType: 'diesel',
    efficiency: '9.1',
    note: 'Diesel preset for heavier loads.',
  },
  {
    id: 'motorcycle',
    name: 'Motorcycle',
    fuelType: 'gasoline',
    efficiency: '34.0',
    note: 'Best efficiency for solo travel.',
  },
]

export default function FuelCalculator() {
  const [selectedVehicleId, setSelectedVehicleId] = useState(
    vehiclePresets[1].id
  )
  const [origin, setOrigin] = useState('')
  const [destination, setDestination] = useState('')
  const [distance, setDistance] = useState('240')
  const [efficiency, setEfficiency] = useState(vehiclePresets[1].efficiency)
  const [price, setPrice] = useState('102.50')
  const [fuelType, setFuelType] = useState<FuelType>(vehiclePresets[1].fuelType)
  const [includeReturn, setIncludeReturn] = useState(false)
  const [routeStatus, setRouteStatus] = useState<string | null>(null)
  const [routeLoading, setRouteLoading] = useState(false)
  const [routeSummary, setRouteSummary] = useState<RouteResult | null>(null)
  const [fuelStatus, setFuelStatus] = useState<string | null>(null)
  const [fuelLoading, setFuelLoading] = useState(false)
  const [fuelLookup, setFuelLookup] = useState<FuelLookupResult | null>(null)
  const [currentCoords, setCurrentCoords] = useState<{
    latitude: number
    longitude: number
  } | null>(null)

  const tripDistance = parseNumber(distance) * (includeReturn ? 2 : 1)
  const fuelEfficiency = parseNumber(efficiency)
  const fuelPrice = parseNumber(price)

  const litersNeeded =
    tripDistance > 0 && fuelEfficiency > 0 ? tripDistance / fuelEfficiency : 0
  const totalCost = litersNeeded * fuelPrice
  const costPerKm = tripDistance > 0 ? totalCost / tripDistance : 0

  const detectFuelPrice = useEffectEvent(
    async (latitude: number, longitude: number) => {
      setFuelLoading(true)
      setFuelStatus('Finding a local fuel price...')

      try {
        const params = new URLSearchParams({
          lat: latitude.toString(),
          lon: longitude.toString(),
          fuelType,
        })
        const response = await fetch(`/api/location-fuel?${params.toString()}`)
        const payload = (await response.json()) as
          | { error: string }
          | FuelLookupResult

        if ('error' in payload) {
          throw new Error(payload.error || 'Unable to detect a fuel price.')
        }

        setPrice(payload.pricePerLiter.toFixed(2))
        setFuelLookup(payload)
        setOrigin((currentOrigin) =>
          currentOrigin.trim() ? currentOrigin : payload.locationLabel
        )

        const sourceSuffix = payload.releaseDate
          ? ` Updated ${payload.releaseDate}.`
          : ''
        setFuelStatus(
          `Fuel price detected for ${payload.locationLabel}.${sourceSuffix}`
        )
      } catch (error) {
        setFuelLookup(null)
        setFuelStatus(
          error instanceof Error
            ? error.message
            : 'Unable to detect a fuel price.'
        )
      } finally {
        setFuelLoading(false)
      }
    }
  )

  useEffect(() => {
    if (!currentCoords) return

    void detectFuelPrice(currentCoords.latitude, currentCoords.longitude)
  }, [currentCoords, fuelType])

  async function handleRouteCalculation() {
    if (!origin.trim() || !destination.trim()) {
      setRouteStatus('Enter both an origin and a destination.')
      return
    }

    setRouteLoading(true)
    setRouteStatus(null)

    try {
      const params = new URLSearchParams({
        origin: origin.trim(),
        destination: destination.trim(),
      })

      const response = await fetch(`/api/route?${params.toString()}`)
      const payload = (await response.json()) as
        | { error: string }
        | RouteResult

      if ('error' in payload) {
        throw new Error(payload.error || 'Unable to calculate this route.')
      }

      const cheapestAlternative = getCheapestAlternative(
        payload.alternatives,
        fuelEfficiency,
        fuelPrice,
        includeReturn
      )

      setDistance(cheapestAlternative.distanceKm.toFixed(1))
      setRouteSummary(payload)
      setRouteStatus(
        `Route ready: ${payload.originLabel} to ${payload.destinationLabel}. Cheapest route selected by default.`
      )
    } catch (error) {
      setRouteSummary(null)
      setRouteStatus(
        error instanceof Error
          ? error.message
          : 'Unable to calculate this route right now.'
      )
    } finally {
      setRouteLoading(false)
    }
  }

  async function detectCurrentLocation() {
    if (!navigator.geolocation) {
      setFuelStatus('Geolocation is not available in this browser.')
      return
    }

    setFuelLoading(true)
    setFuelStatus('Locating your device...')

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentCoords({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        })
      },
      (error) => {
        setFuelLoading(false)
        setFuelStatus(
          error.code === error.PERMISSION_DENIED
            ? 'Location access was denied. You can still enter fuel price manually.'
            : 'Unable to read your current location.'
        )
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  function handleVehicleSelection(vehicleId: string) {
    const vehicle = vehiclePresets.find((preset) => preset.id === vehicleId)
    if (!vehicle) return

    setSelectedVehicleId(vehicle.id)
    setEfficiency(vehicle.efficiency)
    setFuelType(vehicle.fuelType)
  }

  const selectedVehicle =
    vehiclePresets.find((vehicle) => vehicle.id === selectedVehicleId) ??
    vehiclePresets[0]

  const cheapestAlternative = routeSummary
    ? getCheapestAlternative(
        routeSummary.alternatives,
        fuelEfficiency,
        fuelPrice,
        includeReturn
      )
    : null

  const fastestAlternative = routeSummary
    ? getFastestAlternative(routeSummary.alternatives)
    : null

  const smartSuggestions = getSmartSuggestions({
    tripDistance,
    litersNeeded,
    totalCost,
    fuelEfficiency,
    fuelType,
    includeReturn,
    cheapestAlternative,
    fastestAlternative,
  })

  return (
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
      <div className="rounded-[2rem] border border-white/40 bg-white/85 p-6 shadow-[0_30px_90px_-50px_rgba(15,23,42,0.7)] backdrop-blur xl:p-8">
        <div className="flex flex-col gap-3 border-b border-slate-200 pb-5">
          <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-900">
            Smart trip planner
          </span>
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950">
            Choose a vehicle, map the route, and auto-fill fuel price from your
            location.
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-slate-600">
            Route distance can be calculated from origin and destination, then
            adjusted manually. Fuel pricing is shown in Indian rupees per liter
            and can always be overridden.
          </p>
        </div>

        <div className="mt-6 grid gap-4">
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Vehicle selection
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  Presets update fuel type and average efficiency.
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {selectedVehicle.note}
              </span>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {vehiclePresets.map((vehicle) => {
                const active = vehicle.id === selectedVehicleId

                return (
                  <button
                    key={vehicle.id}
                    className={`rounded-[1.25rem] border px-4 py-4 text-left transition ${
                      active
                        ? 'border-emerald-400 bg-emerald-50 shadow-[0_20px_40px_-28px_rgba(16,185,129,0.65)]'
                        : 'border-slate-200 bg-white hover:border-emerald-200'
                    }`}
                    type="button"
                    onClick={() => handleVehicleSelection(vehicle.id)}
                  >
                    <div className="text-sm font-semibold text-slate-950">
                      {vehicle.name}
                    </div>
                    <div className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {vehicle.fuelType} - {vehicle.efficiency} km/L
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4">
            <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">
                  Route-based distance
                </p>
                <p className="text-xs leading-5 text-slate-500">
                  Search a route to fill the trip distance automatically.
                </p>
              </div>
              <button
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
                type="button"
                onClick={detectCurrentLocation}
              >
                {fuelLoading ? 'Detecting location...' : 'Use my location'}
              </button>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <InputField
                help="Starting point for the drive."
                label="Origin"
                placeholder="Delhi"
                value={origin}
                onChange={setOrigin}
              />
              <InputField
                help="Destination to map against the route."
                label="Destination"
                placeholder="Jaipur"
                value={destination}
                onChange={setDestination}
              />
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                disabled={routeLoading}
                type="button"
                onClick={handleRouteCalculation}
              >
                {routeLoading ? 'Calculating route...' : 'Calculate route'}
              </button>
              {routeStatus ? (
                <p className="text-sm text-slate-600">{routeStatus}</p>
              ) : null}
            </div>

            {routeSummary ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <InfoCard
                  label="Cheapest route distance"
                  value={`${numberFormat.format(cheapestAlternative?.distanceKm ?? routeSummary.distanceKm)} km`}
                />
                <InfoCard
                  label="Fastest route duration"
                  value={`${numberFormat.format(fastestAlternative?.durationMinutes ?? routeSummary.durationMinutes)} min`}
                />
              </div>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              help="Filled from the route planner or editable by hand."
              label="Trip distance"
              step="0.1"
              suffix="km"
              value={distance}
              onChange={setDistance}
            />
            <label className="flex flex-col gap-2 rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4">
              <span className="text-sm font-semibold text-slate-900">
                Fuel type
              </span>
              <select
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-950 outline-none"
                value={fuelType}
                onChange={(event) =>
                  setFuelType(event.target.value as FuelType)
                }
              >
                <option value="gasoline">Gasoline</option>
                <option value="premium">Premium gasoline</option>
                <option value="diesel">Diesel</option>
              </select>
              <span className="text-xs leading-5 text-slate-500">
                Auto pricing follows the selected fuel type.
              </span>
            </label>
            <NumberField
              help="Updated by the vehicle preset or editable for your exact average."
              label="Fuel efficiency"
              step="0.1"
              suffix="km/L"
              value={efficiency}
              onChange={setEfficiency}
            />
            <NumberField
              help="Auto-detected from your location when available."
              label="Fuel price"
              step="0.01"
              suffix="INR/L"
              value={price}
              onChange={setPrice}
            />
          </div>

          <label className="flex items-center justify-between gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-950 px-5 py-4 text-white">
            <div>
              <div className="text-sm font-semibold">Include return trip</div>
              <div className="text-xs leading-5 text-slate-300">
                Doubles the route distance for a round-trip estimate.
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

          {fuelStatus || fuelLookup ? (
            <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/80 p-4">
              <p className="text-sm font-semibold text-emerald-950">
                Fuel price detection
              </p>
              {fuelStatus ? (
                <p className="mt-2 text-sm leading-6 text-emerald-900/80">
                  {fuelStatus}
                </p>
              ) : null}
              {fuelLookup ? (
                <div className="mt-3 grid gap-2 text-sm text-emerald-950">
                  <span>
                    Source: {fuelLookup.sourceLabel}
                    {fuelLookup.estimated ? ' (estimated)' : ''}
                  </span>
                  <span>
                    Current value: {currencyFormat.format(fuelLookup.pricePerLiter)}{' '}
                    per liter
                  </span>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <aside className="flex flex-col gap-4 rounded-[2rem] bg-slate-950 p-6 text-white shadow-[0_30px_90px_-50px_rgba(15,23,42,0.95)] xl:p-8">
        <div className="border-b border-white/10 pb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300">
            Estimated totals
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Results update as route distance, fuel price, and vehicle preset
            change.
          </p>
        </div>

        <MetricCard
          label="Selected vehicle"
          tone="amber"
          value={selectedVehicle.name}
        />
        <MetricCard
          label="Trip distance"
          tone="amber"
          value={`${numberFormat.format(tripDistance)} km`}
        />
        <MetricCard
          label="Fuel needed"
          tone="emerald"
          value={`${numberFormat.format(litersNeeded)} L`}
        />
        <MetricCard
          label="Total fuel cost"
          tone="sky"
          value={currencyFormat.format(totalCost)}
        />
        <MetricCard
          label="Cost per kilometer"
          tone="rose"
          value={currencyFormat.format(costPerKm)}
        />

        <div className="rounded-[1.5rem] border border-white/10 bg-white/5 px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-300">
            Smart suggestions
          </p>
          <div className="mt-3 grid gap-3">
            {smartSuggestions.map((suggestion) => (
              <div
                key={suggestion.title}
                className="rounded-[1rem] border border-white/10 bg-white/5 px-4 py-3"
              >
                <p className="text-sm font-semibold text-white">
                  {suggestion.title}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {suggestion.description}
                </p>
              </div>
            ))}
          </div>
        </div>
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

function NumberField({
  label,
  suffix,
  step,
  help,
  value,
  onChange,
}: {
  label: string
  suffix: string
  step: string
  help: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-2 rounded-[1.5rem] border border-slate-200 bg-slate-50/90 p-4">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <input
          className="w-full border-none bg-transparent text-lg font-medium text-slate-950 outline-none placeholder:text-slate-400"
          inputMode="decimal"
          min="0"
          placeholder="0"
          step={step}
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="shrink-0 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
          {suffix}
        </span>
      </div>
      <span className="text-xs leading-5 text-slate-500">{help}</span>
    </label>
  )
}

function InputField({
  label,
  help,
  placeholder,
  value,
  onChange,
}: {
  label: string
  help: string
  placeholder: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="flex flex-col gap-2 rounded-[1.5rem] border border-slate-200 bg-white p-4">
      <span className="text-sm font-semibold text-slate-900">{label}</span>
      <input
        className="rounded-2xl border border-slate-200 px-4 py-3 text-base font-medium text-slate-950 outline-none placeholder:text-slate-400"
        placeholder={placeholder}
        type="text"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      <span className="text-xs leading-5 text-slate-500">{help}</span>
    </label>
  )
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[1.25rem] border border-slate-200 bg-white px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
        {value}
      </p>
    </div>
  )
}

function parseNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0
}

function getCheapestAlternative(
  alternatives: RouteAlternative[],
  efficiency: number,
  fuelPrice: number,
  includeReturn: boolean
) {
  return [...alternatives].sort((left, right) => {
    return (
      estimateAlternativeCost(left, efficiency, fuelPrice, includeReturn) -
      estimateAlternativeCost(right, efficiency, fuelPrice, includeReturn)
    )
  })[0]
}

function getFastestAlternative(alternatives: RouteAlternative[]) {
  return [...alternatives].sort(
    (left, right) => left.durationMinutes - right.durationMinutes
  )[0]
}

function estimateAlternativeCost(
  alternative: RouteAlternative,
  efficiency: number,
  fuelPrice: number,
  includeReturn: boolean
) {
  const adjustedDistance = alternative.distanceKm * (includeReturn ? 2 : 1)
  if (!efficiency || !fuelPrice) return adjustedDistance

  return (adjustedDistance / efficiency) * fuelPrice
}

function getSmartSuggestions({
  tripDistance,
  litersNeeded,
  totalCost,
  fuelEfficiency,
  fuelType,
  includeReturn,
  cheapestAlternative,
  fastestAlternative,
}: {
  tripDistance: number
  litersNeeded: number
  totalCost: number
  fuelEfficiency: number
  fuelType: FuelType
  includeReturn: boolean
  cheapestAlternative: RouteAlternative | null
  fastestAlternative: RouteAlternative | null
}) {
  const suggestions = [
    {
      title: 'Cheapest route',
      description: cheapestAlternative
        ? `${cheapestAlternative.label} is the lowest-cost option at about ${currencyFormat.format(
            estimateAlternativeCost(
              cheapestAlternative,
              fuelEfficiency,
              totalCost && litersNeeded ? totalCost / litersNeeded : 0,
              includeReturn
            )
          )} in fuel for this trip.`
        : 'Calculate a route to compare alternate paths by fuel cost.',
    },
    {
      title: 'Fastest route',
      description: fastestAlternative
        ? `${fastestAlternative.label} is the quickest option at around ${numberFormat.format(
            fastestAlternative.durationMinutes
          )} minutes.`
        : 'Fastest-route guidance appears after route calculation.',
    },
  ]

  if (fuelEfficiency < 12) {
    suggestions.push({
      title: 'Fuel-saving tip',
      description:
        'Your selected vehicle is on the heavier side for fuel use. Steady speeds, lower AC load, and avoiding hard acceleration will make the biggest difference.',
    })
  } else if (tripDistance > 250) {
    suggestions.push({
      title: 'Fuel-saving tip',
      description:
        'For longer drives, keeping tyre pressure correct and cruising at a steady highway speed usually saves more fuel than route micro-optimisation.',
    })
  } else if (fuelType === 'premium') {
    suggestions.push({
      title: 'Fuel-saving tip',
      description:
        'Premium fuel trips are costlier per kilometer. If your vehicle allows it, confirm whether regular petrol is acceptable for non-performance driving.',
    })
  } else {
    suggestions.push({
      title: 'Fuel-saving tip',
      description:
        'Smooth throttle inputs, fewer rapid stops, and combining errands into one drive are the simplest ways to cut fuel spend.',
    })
  }

  return suggestions
}
