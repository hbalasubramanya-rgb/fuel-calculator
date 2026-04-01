import type { NextRequest } from 'next/server'

type FuelType = 'gasoline' | 'premium' | 'diesel'

type ReverseGeocodeResponse = {
  address?: {
    city?: string
    town?: string
    village?: string
    state?: string
    country?: string
    country_code?: string
    'ISO3166-2-lvl4'?: string
  }
  display_name?: string
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'fuel-calculator/1.0',
}

const GALLON_TO_LITER = 3.78541

const FALLBACK_PRICES: Record<
  string,
  { gasoline: number; premium: number; diesel: number }
> = {
  IN: { gasoline: 1.24, premium: 1.32, diesel: 1.08 },
  CA: { gasoline: 1.36, premium: 1.47, diesel: 1.28 },
  GB: { gasoline: 1.95, premium: 2.06, diesel: 2.02 },
  AU: { gasoline: 1.18, premium: 1.28, diesel: 1.24 },
  DE: { gasoline: 1.92, premium: 2.02, diesel: 1.78 },
  FR: { gasoline: 1.94, premium: 2.06, diesel: 1.82 },
  IT: { gasoline: 2.01, premium: 2.14, diesel: 1.9 },
  ES: { gasoline: 1.72, premium: 1.83, diesel: 1.61 },
  MX: { gasoline: 1.3, premium: 1.39, diesel: 1.37 },
  BR: { gasoline: 1.1, premium: 1.18, diesel: 1.03 },
  JP: { gasoline: 1.22, premium: 1.32, diesel: 1.08 },
  ZA: { gasoline: 1.28, premium: 1.35, diesel: 1.25 },
  AE: { gasoline: 0.83, premium: 0.92, diesel: 0.87 },
}

const US_STATE_TO_REGION: Record<string, string> = {
  CT: 'New England (PADD1A)',
  ME: 'New England (PADD1A)',
  MA: 'New England (PADD1A)',
  NH: 'New England (PADD1A)',
  RI: 'New England (PADD1A)',
  VT: 'New England (PADD1A)',
  DE: 'Central Atlantic (PADD1B)',
  DC: 'Central Atlantic (PADD1B)',
  MD: 'Central Atlantic (PADD1B)',
  NJ: 'Central Atlantic (PADD1B)',
  NY: 'Central Atlantic (PADD1B)',
  PA: 'Central Atlantic (PADD1B)',
  FL: 'Lower Atlantic (PADD1C)',
  GA: 'Lower Atlantic (PADD1C)',
  NC: 'Lower Atlantic (PADD1C)',
  SC: 'Lower Atlantic (PADD1C)',
  VA: 'Lower Atlantic (PADD1C)',
  WV: 'Lower Atlantic (PADD1C)',
  IL: 'Midwest (PADD2)',
  IN: 'Midwest (PADD2)',
  IA: 'Midwest (PADD2)',
  KS: 'Midwest (PADD2)',
  KY: 'Midwest (PADD2)',
  MI: 'Midwest (PADD2)',
  MN: 'Midwest (PADD2)',
  MO: 'Midwest (PADD2)',
  NE: 'Midwest (PADD2)',
  ND: 'Midwest (PADD2)',
  OH: 'Midwest (PADD2)',
  OK: 'Midwest (PADD2)',
  SD: 'Midwest (PADD2)',
  TN: 'Midwest (PADD2)',
  WI: 'Midwest (PADD2)',
  AL: 'Gulf Coast (PADD3)',
  AR: 'Gulf Coast (PADD3)',
  LA: 'Gulf Coast (PADD3)',
  MS: 'Gulf Coast (PADD3)',
  NM: 'Gulf Coast (PADD3)',
  TX: 'Gulf Coast (PADD3)',
  CO: 'Rocky Mountain (PADD4)',
  ID: 'Rocky Mountain (PADD4)',
  MT: 'Rocky Mountain (PADD4)',
  UT: 'Rocky Mountain (PADD4)',
  WY: 'Rocky Mountain (PADD4)',
  AK: 'West Coast (PADD5)',
  AZ: 'West Coast (PADD5)',
  CA: 'West Coast (PADD5)',
  HI: 'West Coast (PADD5)',
  NV: 'West Coast (PADD5)',
  OR: 'West Coast (PADD5)',
  WA: 'West Coast (PADD5)',
}

export async function GET(request: NextRequest) {
  const latitude = Number(request.nextUrl.searchParams.get('lat'))
  const longitude = Number(request.nextUrl.searchParams.get('lon'))
  const fuelTypeParam = request.nextUrl.searchParams.get('fuelType')
  const fuelType = normalizeFuelType(fuelTypeParam)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !fuelType) {
    return Response.json(
      { error: 'Valid lat, lon, and fuelType are required.' },
      { status: 400 }
    )
  }

  try {
    const reverse = await reverseGeocode(latitude, longitude)
    const address = reverse.address

    if (!address?.country_code) {
      throw new Error('Unable to determine your location.')
    }

    const countryCode = address.country_code.toUpperCase()
    const city =
      address.city || address.town || address.village || address.state || 'Your area'
    const stateCode = address['ISO3166-2-lvl4']?.split('-')[1]
    const locationLabel = [city, address.state, address.country]
      .filter(Boolean)
      .join(', ')

    if (countryCode === 'US' && stateCode) {
      const regionalPrice = await getLatestUsRegionalPrice(stateCode, fuelType)

      return Response.json({
        locationLabel,
        fuelType,
        pricePerLiter: roundTo(regionalPrice.usdPerGallon / GALLON_TO_LITER, 2),
        sourceLabel: regionalPrice.sourceLabel,
        releaseDate: regionalPrice.releaseDate,
        estimated: regionalPrice.estimated,
      })
    }

    const fallback = FALLBACK_PRICES[countryCode]

    if (!fallback) {
      throw new Error(
        'Automatic fuel pricing is not available for this region yet. Enter the fuel price manually.'
      )
    }

    return Response.json({
      locationLabel,
      fuelType,
      pricePerLiter: fallback[fuelType],
      sourceLabel: `Built-in ${address.country} fuel estimate`,
      releaseDate: null,
      estimated: true,
    })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to detect a local fuel price.',
      },
      { status: 500 }
    )
  }
}

async function reverseGeocode(latitude: number, longitude: number) {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('lat', latitude.toString())
  url.searchParams.set('lon', longitude.toString())
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('addressdetails', '1')

  const response = await fetch(url, {
    headers: NOMINATIM_HEADERS,
  })

  if (!response.ok) {
    throw new Error('Unable to reverse geocode this location.')
  }

  return (await response.json()) as ReverseGeocodeResponse
}

async function getLatestUsRegionalPrice(stateCode: string, fuelType: FuelType) {
  const htmlResponse = await fetch('https://www.eia.gov/petroleum/gasdiesel/', {
    headers: NOMINATIM_HEADERS,
  })

  if (!htmlResponse.ok) {
    throw new Error('Unable to load U.S. fuel price data.')
  }

  const html = await htmlResponse.text()
  const section =
    fuelType === 'diesel'
      ? extractTableSection(html, 'U.S. On-Highway Diesel Fuel Prices')
      : extractTableSection(html, 'U.S. Regular Gasoline Prices')

  const releaseDate = extractLatestDate(section)
  const priceByRegion = extractRegionalPrices(section)
  const targetRegion = US_STATE_TO_REGION[stateCode]

  if (!targetRegion || !priceByRegion[targetRegion]) {
    throw new Error('Unable to match your state to a fuel price region.')
  }

  const basePrice = priceByRegion[targetRegion]
  const isPremium = fuelType === 'premium'

  return {
    usdPerGallon: isPremium ? roundTo(basePrice * 1.15, 3) : basePrice,
    sourceLabel: isPremium
      ? `EIA ${targetRegion} regular gasoline average with premium uplift`
      : `EIA ${targetRegion} average`,
    releaseDate,
    estimated: isPremium,
  }
}

function extractTableSection(html: string, title: string) {
  const startIndex = html.indexOf(title)

  if (startIndex === -1) {
    throw new Error('Fuel price source format has changed.')
  }

  const endIndex = html.indexOf('</tbody>', startIndex)

  if (endIndex === -1) {
    throw new Error('Fuel price source format has changed.')
  }

  return html.slice(startIndex, endIndex)
}

function extractLatestDate(section: string) {
  const matches = [...section.matchAll(/<th>(\d{2}\/\d{2}\/\d{2})<\/th>/g)]
  return matches.at(-1)?.[1] ?? null
}

function extractRegionalPrices(section: string) {
  const rows = [...section.matchAll(/<tr>([\s\S]*?)<\/tr>/g)]
  const prices: Record<string, number> = {}

  for (const row of rows) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/g)].map(
      (match) => cleanHtml(match[1])
    )

    if (cells.length < 4) continue

    const region = cells[0]
    const latestValue = Number(cells[3])

    if (region && Number.isFinite(latestValue)) {
      prices[region] = latestValue
    }
  }

  return prices
}

function cleanHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeFuelType(value: string | null): FuelType | null {
  if (value === 'gasoline' || value === 'premium' || value === 'diesel') {
    return value
  }

  return null
}

function roundTo(value: number, decimals: number) {
  return Number(value.toFixed(decimals))
}
