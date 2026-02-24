/**
 * API Endpoint: Przychody dzienne z Fitnet
 *
 * GET /api/fitnet/revenue/daily?date=2026-02-24
 *
 * Tylko dla superadmin (na razie)
 *
 * UWAGA: To jest szablon! Wymaga uzupełnienia po poznaniu struktury bazy Fitnet.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase-server';
import { queryFitnet } from '@/lib/fitnet-db';

export async function GET(request: NextRequest) {
  try {
    // 1. Weryfikacja użytkownika
    const supabase = createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Sprawdź uprawnienia (na razie tylko superadmin)
    const { data: userProfile } = await supabase
      .from('users')
      .select('role, organization_id')
      .eq('id', user.id)
      .single();

    if (!userProfile || userProfile.role !== 'superadmin') {
      return NextResponse.json(
        { error: 'Forbidden - tylko superadmin' },
        { status: 403 }
      );
    }

    // 3. Pobierz parametry
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get('date');

    // Domyślnie: dzisiaj
    const date = dateParam || new Date().toISOString().split('T')[0];

    // 4. Walidacja daty
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: 'Invalid date format. Use YYYY-MM-DD' },
        { status: 400 }
      );
    }

    // 5. Pobierz dane z Fitnet
    // UWAGA: To jest SZABLON zapytania
    // Po poznaniu struktury bazy Fitnet, zastąp tym właściwym zapytaniem
    //
    // const revenue = await queryFitnet(`
    //   SELECT
    //     CAST([date_column] AS DATE) as sale_date,
    //     [category_column] as category,
    //     SUM([amount_column]) as amount,
    //     COUNT(*) as transactions
    //   FROM [sales_table]
    //   WHERE CAST([date_column] AS DATE) = @date
    //   GROUP BY CAST([date_column] AS DATE), [category_column]
    // `, { date });

    // TYMCZASOWO: Zwróć mock data
    const mockRevenue = [
      {
        category: 'Basen',
        amount: 8500.0,
        transactions: 127,
      },
      {
        category: 'Fitness',
        amount: 6920.5,
        transactions: 89,
      },
      {
        category: 'Inne',
        amount: 1200.0,
        transactions: 15,
      },
    ];

    const totalAmount = mockRevenue.reduce((sum, r) => sum + r.amount, 0);
    const totalTransactions = mockRevenue.reduce((sum, r) => sum + r.transactions, 0);

    return NextResponse.json({
      date,
      totalAmount,
      totalTransactions,
      categories: mockRevenue,
      _note: 'To są dane mock. Po poznaniu struktury bazy Fitnet, uzupełnij właściwe zapytanie SQL.',
    });
  } catch (error: any) {
    console.error('❌ Błąd pobierania przychodów:', error);

    return NextResponse.json(
      {
        error: error.message || 'Unknown error',
      },
      { status: 500 }
    );
  }
}
