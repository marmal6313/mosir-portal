/**
 * Fitnet Database Queries
 *
 * Wszystkie zapytania SQL do bazy Fitnet
 * WAŻNE: Te zapytania będą uzupełnione po poznaniu struktury bazy
 */

export interface FitnetRevenue {
  date: string;
  category: string;
  amount: number;
  quantity: number;
  productName?: string;
}

export interface FitnetDailySummary {
  date: string;
  totalAmount: number;
  totalTransactions: number;
  categories: Array<{
    name: string;
    amount: number;
    transactions: number;
  }>;
}

/**
 * SZABLON: Zapytanie o przychody dzienne
 *
 * UWAGA: To jest szablon! Nazwy tabel i kolumn muszą być uzupełnione
 * po uruchomieniu scripts/inspect-fitnet-db.js
 *
 * Przykładowa struktura zapytania:
 */
export const getDailyRevenueQuery = `
  -- TO DO: Uzupełnić po poznaniu struktury bazy
  -- Możliwe nazwy tabel: Sprzedaz, Transakcje, Platnosci, Bilety, itp.

  SELECT
    -- TO DO: data transakcji (może być: data_sprzedazy, data_transakcji, created_at, itp.)
    CAST([data_column] AS DATE) as sale_date,

    -- TO DO: kategoria produktu (może być w osobnej tabeli Products/Produkty)
    [category_column] as category,

    -- TO DO: kwota (może być: kwota, amount, cena, wartosc, itp.)
    [amount_column] as amount,

    -- TO DO: nazwa produktu
    [product_name_column] as product_name,

    COUNT(*) as quantity

  FROM [table_name] -- TO DO: nazwa tabeli

  WHERE
    -- Filtr daty
    CAST([date_column] AS DATE) = @date

  GROUP BY
    CAST([date_column] AS DATE),
    [category_column],
    [product_name_column]

  ORDER BY
    amount DESC
`;

/**
 * SZABLON: Zapytanie o przychody w zakresie dat
 */
export const getRevenueRangeQuery = `
  -- TO DO: Uzupełnić po poznaniu struktury bazy

  SELECT
    CAST([date_column] AS DATE) as sale_date,
    [category_column] as category,
    SUM([amount_column]) as total_amount,
    COUNT(*) as total_transactions

  FROM [table_name]

  WHERE
    CAST([date_column] AS DATE) BETWEEN @startDate AND @endDate

  GROUP BY
    CAST([date_column] AS DATE),
    [category_column]

  ORDER BY
    sale_date DESC,
    total_amount DESC
`;

/**
 * SZABLON: Zapytanie o kategorie produktów
 */
export const getCategoriesQuery = `
  -- TO DO: Uzupełnić po poznaniu struktury bazy

  SELECT DISTINCT
    [category_column] as category_name,
    COUNT(*) as product_count

  FROM [products_table] -- lub [sales_table] jeśli kategorie są w transakcjach

  GROUP BY [category_column]

  ORDER BY category_name
`;

/**
 * SZABLON: Zapytanie o top produkty
 */
export const getTopProductsQuery = `
  -- TO DO: Uzupełnić po poznaniu struktury bazy

  SELECT TOP 10
    [product_name_column] as product_name,
    [category_column] as category,
    SUM([amount_column]) as total_revenue,
    COUNT(*) as total_sales

  FROM [table_name]

  WHERE
    CAST([date_column] AS DATE) BETWEEN @startDate AND @endDate

  GROUP BY
    [product_name_column],
    [category_column]

  ORDER BY
    total_revenue DESC
`;

/**
 * Helper: Sprawdź dostępne tabele w bazie
 */
export const listTablesQuery = `
  SELECT
    TABLE_SCHEMA,
    TABLE_NAME,
    TABLE_TYPE
  FROM INFORMATION_SCHEMA.TABLES
  WHERE TABLE_TYPE = 'BASE TABLE'
  ORDER BY TABLE_NAME
`;

/**
 * Helper: Sprawdź strukturę tabeli
 */
export const describeTableQuery = `
  SELECT
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE,
    COLUMN_DEFAULT
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_NAME = @tableName
  ORDER BY ORDINAL_POSITION
`;

// ========================================
// INSTRUKCJE DLA DEVELOPERA
// ========================================
/*

Po uruchomieniu scripts/inspect-fitnet-db.js otrzymasz strukturę bazy.

Przykład jak uzupełnić zapytania:

JEŚLI ZNAJDZIESZ TABELE:
- SprzedazPozycje (data_sprzedazy, kwota, produkt_id)
- Produkty (id, nazwa, kategoria_id)
- Kategorie (id, nazwa)

TO ZAPYTANIE MOŻE WYGLĄDAĆ TAK:

export const getDailyRevenueQuery = `
  SELECT
    CAST(sp.data_sprzedazy AS DATE) as sale_date,
    k.nazwa as category,
    SUM(sp.kwota) as amount,
    p.nazwa as product_name,
    COUNT(*) as quantity

  FROM SprzedazPozycje sp
  INNER JOIN Produkty p ON p.id = sp.produkt_id
  INNER JOIN Kategorie k ON k.id = p.kategoria_id

  WHERE CAST(sp.data_sprzedazy AS DATE) = @date

  GROUP BY
    CAST(sp.data_sprzedazy AS DATE),
    k.nazwa,
    p.nazwa

  ORDER BY amount DESC
`;

MAPOWANIE KATEGORII:

Jeśli w bazie Fitnet są kategorie jak:
- "Wejściówka basen"
- "Karnet basen"
→ Mapuj na: "Basen"

- "Wejściówka siłownia"
- "Karnet fitness"
→ Mapuj na: "Fitness"

*/
