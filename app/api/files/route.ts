import { NextRequest, NextResponse } from 'next/server'
import { readdir, stat, unlink } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { getCurrentUserWithRole } from '@/lib/supabase-server'

function sameOriginGuard(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    const originHost = new URL(origin).host
    const reqHost = req.headers.get('host')
    return !!reqHost && originHost === reqHost
  } catch {
    return false
  }
}

// GET - Lista plików
export async function GET() {
  try {
    // Autoryzacja (wystarczy dowolny zalogowany użytkownik)
    const { user } = await getCurrentUserWithRole()
    if (!user) {
      return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
    }

    const imgDir = join(process.cwd(), 'public', 'img')
    
    if (!existsSync(imgDir)) {
      return NextResponse.json({ files: [] })
    }

    const files = await readdir(imgDir)
    const fileDetails = []

    for (const fileName of files) {
      if (fileName.startsWith('.')) continue // Pomijaj ukryte pliki
      
      const filePath = join(imgDir, fileName)
      const stats = await stat(filePath)
      
      // Wyciągnij datę z nazwy pliku (mosir-timestamp.ext)
      const timestampMatch = fileName.match(/mosir-(\d+)\./)
      let uploadedDate = 'Nieznana data'
      
      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1])
        uploadedDate = new Date(timestamp).toLocaleDateString('pl-PL')
      }

      fileDetails.push({
        name: fileName,
        path: `/img/${fileName}`,
        size: formatFileSize(stats.size),
        uploaded: uploadedDate,
        modified: stats.mtime.toLocaleDateString('pl-PL')
      })
    }

    // Sortuj po dacie modyfikacji (najnowsze pierwsze)
    fileDetails.sort((a, b) => {
      const dateA = new Date(a.modified.split('.').reverse().join('-'))
      const dateB = new Date(b.modified.split('.').reverse().join('-'))
      return dateB.getTime() - dateA.getTime()
    })

    return NextResponse.json({ files: fileDetails })
    
  } catch (error) {
    console.error('Błąd podczas listowania plików:', error)
    return NextResponse.json(
      { error: 'Nie udało się pobrać listy plików' },
      { status: 500 }
    )
  }
}

// DELETE - Usuń plik
export async function DELETE(request: NextRequest) {
  try {
    if (!sameOriginGuard(request)) {
      return NextResponse.json({ error: 'Origin niedozwolony' }, { status: 403 })
    }

    // Tylko superadmin/dyrektor mogą usuwać pliki
    const { user, profile } = await getCurrentUserWithRole()
    if (!user) {
      return NextResponse.json({ error: 'Nieautoryzowany' }, { status: 401 })
    }
    if (!profile || !profile.role) {
      return NextResponse.json({ error: 'Brak profilu użytkownika' }, { status: 403 })
    }
    const role = profile.role
    if (!(role === 'superadmin' || role === 'dyrektor')) {
      return NextResponse.json({ error: 'Brak uprawnień do usuwania' }, { status: 403 })
    }

    const { fileName } = await request.json()
    
    if (!fileName) {
      return NextResponse.json(
        { error: 'Brak nazwy pliku do usunięcia' },
        { status: 400 }
      )
    }

    const imgDir = join(process.cwd(), 'public', 'img')
    const filePath = join(imgDir, fileName)
    
    if (!existsSync(filePath)) {
      return NextResponse.json(
        { error: 'Plik nie istnieje' },
        { status: 404 }
      )
    }

    // Sprawdź czy plik jest w katalogu img (bezpieczeństwo)
    if (!filePath.startsWith(imgDir)) {
      return NextResponse.json(
        { error: 'Nieprawidłowa ścieżka pliku' },
        { status: 400 }
      )
    }

    await unlink(filePath)
    
    return NextResponse.json({
      success: true,
      message: `Plik ${fileName} został usunięty`
    })
    
  } catch (error) {
    console.error('Błąd podczas usuwania pliku:', error)
    return NextResponse.json(
      { error: 'Nie udało się usunąć pliku' },
      { status: 500 }
    )
  }
}

// Funkcja pomocnicza do formatowania rozmiaru pliku
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}




