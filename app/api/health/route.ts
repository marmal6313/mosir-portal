import { NextResponse } from 'next/server'

export const dynamic = 'force-static'

export async function GET() {
  // Prosty healthcheck: potwierdza, że proces działa i SSR odpowiada
  return NextResponse.json({ status: 'ok' })
}

