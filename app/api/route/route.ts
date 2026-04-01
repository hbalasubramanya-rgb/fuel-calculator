import type { NextRequest } from 'next/server'

type GeocodeResult = {
  lat: string
  lon: string
  display_name: string
}

type OsrmResponse = {
  code: string
  routes?: Array<{
    distance: number
    duration: number
  }>
}

const NOMINATIM_HEADERS = {
  'User-Agent': 'fuel-calculator/1.0',
}

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.searchParams.get('origin')?.trim()
  const destination = request.nextUrl.searchParams.get('destination')?.trim()

  if (!origin || !destination) {
    return Response.json(
      { error: 'Origin and destination are required.' },
      { status: 400 }
    )
  }

  try {
    const [originPoint, destinationPoint] = await Promise.all([
      geocodePlace(origin),
      geocodePlace(destination),
    ])

    const routeUrl = new URL(
      `https://router.project-osrm.org/route/v1/driving/${originPoint.lon},${originPoint.lat};${destinationPoint.lon},${destinationPoint.lat}`
    )
    routeUrl.searchParams.set('overview', 'false')
    routeUrl.searchParams.set('alternatives', 'true')
    routeUrl.searchParams.set('steps', 'false')

    const routeResponse = await fetch(routeUrl, {
      headers: NOMINATIM_HEADERS,
    })

    if (!routeResponse.ok) {
      throw new Error('Route service is unavailable.')
    }

    const routePayload = (await routeResponse.json()) as OsrmResponse
    const routes = routePayload.routes
    const route = routes?.[0]

    if (routePayload.code !== 'Ok' || !route) {
      throw new Error('No drivable route was found for this trip.')
    }

    const alternatives = routes.map((candidate, index) => ({
      id: `route-${index + 1}`,
      label: index === 0 ? 'Primary route' : `Alternative ${index}`,
      distanceKm: roundTo(candidate.distance / 1000, 1),
      durationMinutes: roundTo(candidate.duration / 60, 0),
    }))

    return Response.json({
      distanceKm: roundTo(route.distance / 1000, 1),
      durationMinutes: roundTo(route.duration / 60, 0),
      originLabel: originPoint.display_name,
      destinationLabel: destinationPoint.display_name,
      alternatives,
    })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to calculate the route.',
      },
      { status: 500 }
    )
  }
}

async function geocodePlace(query: string) {
  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('q', query)
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('limit', '1')
  url.searchParams.set('addressdetails', '1')

  const response = await fetch(url, {
    headers: NOMINATIM_HEADERS,
  })

  if (!response.ok) {
    throw new Error(`Unable to find "${query}".`)
  }

  const payload = (await response.json()) as GeocodeResult[]
  const result = payload[0]

  if (!result) {
    throw new Error(`Unable to find "${query}".`)
  }

  return result
}

function roundTo(value: number, decimals: number) {
  return Number(value.toFixed(decimals))
}
