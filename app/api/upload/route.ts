import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getCurrentUserWithRole } from '@/lib/supabase-server'

// Prosty limiter per-IP (w pamięci procesu)
const rateMap = new Map<string, { count: number; ts: number }>()
const WINDOW_MS = 60_000
const LIMIT = 20 // 20 zapytań/min/IP

function checkRateLimit(req: NextRequest) {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ||
    req.ip ||
    'unknown'
  const now = Date.now()
  const rec = rateMap.get(ip)
  if (!rec || now - rec.ts > WINDOW_MS) {
    rateMap.set(ip, { count: 1, ts: now })
    return true
  }
  if (rec.count >= LIMIT) return false
  rec.count += 1
  return true
}

function sameOriginGuard(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) return true // brak origin (np. curl) — akceptuj
  try {
    const originHost = new URL(origin).host
    const reqHost = req.headers.get('host')
    return !!reqHost && originHost === reqHost
  } catch {
    return false
  }
}

function isAllowedExtension(name: string) {
  const lower = name.toLowerCase()
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].some(ext => lower.endsWith(ext))
}

function isAllowedImageMagic(buffer: Buffer) {
  // JPEG
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return true
  // PNG
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  )
    return true
  // GIF87a / GIF89a
  if (
    buffer[0] === 0x47 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x38 &&
    (buffer[4] === 0x37 || buffer[4] === 0x39) &&
    buffer[5] === 0x61
  )
    return true
  // WEBP: "RIFF"...."WEBP"
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  )
    return true
  return false
}

export async function POST(request: NextRequest) {
  try {
    // CSRF i rate-limit
    if (!sameOriginGuard(request)) {
      return NextResponse.json({ error: 'Origin niedozwolony' }, { status: 403 })
    }
    if (!checkRateLimit(request)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 })
    }

    // Autoryzacja użytkownika
    const { user } = await getCurrentUserWithRole()
    if (!user) {
      return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'Brak pliku do uploadowania' },
        { status: 400 }
      )
    }

    // Sprawdź rozmiar pliku (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json(
        { error: 'Plik jest za duży. Maksymalny rozmiar to 5MB' },
        { status: 400 }
      )
    }

    // Konwertuj plik na buffer do walidacji
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Weryfikacja rozszerzenia i sygnatury
    if (!isAllowedExtension(file.name)) {
      return NextResponse.json(
        { error: 'Niedozwolone rozszerzenie pliku (dozwolone: png, jpg, jpeg, webp, gif)' },
        { status: 400 }
      )
    }
    if (!isAllowedImageMagic(buffer)) {
      return NextResponse.json(
        { error: 'Nieprawidłowy format pliku (sygnatura)' },
        { status: 400 }
      )
    }

    // Stwórz unikalną nazwę pliku
    const timestamp = Date.now()
    const fileExtension = file.name.split('.').pop()
    const fileName = `mosir-${timestamp}.${fileExtension}`
    
    // Ścieżka do katalogu img
    const imgDir = join(process.cwd(), 'public', 'img')
    
    // Upewnij się, że katalog istnieje
    if (!existsSync(imgDir)) {
      await mkdir(imgDir, { recursive: true })
    }
    
    // Pełna ścieżka do pliku
    const filePath = join(imgDir, fileName)
    
    await writeFile(filePath, buffer)
    
    // Zwróć ścieżkę względną do public
    const relativePath = `/img/${fileName}`
    
    return NextResponse.json({
      success: true,
      filePath: relativePath,
      fileName: fileName,
      message: 'Plik został pomyślnie uploadowany'
    })
    
  } catch (error) {
    console.error('Błąd podczas uploadowania pliku:', error)
    return NextResponse.json(
      { error: 'Wystąpił błąd podczas uploadowania pliku' },
      { status: 500 }
    )
  }
}






