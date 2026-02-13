# Fix: Multi-Department Task Creation

**Data:** 2026-02-13
**Typ:** Bugfix

## 🐛 Problem

Użytkownicy z wieloma przypisanymi działami (multi-department feature):
- ✅ Widzieli zadania ze wszystkich swoich działów
- ❌ Przy tworzeniu nowego zadania mogli wybrać tylko swój główny dział (`department_id`)
- ❌ Nie mogli tworzyć zadań dla pozostałych działów, do których mieli uprawnienia

## ✅ Rozwiązanie

Zaktualizowano formularz tworzenia zadania (`/dashboard/tasks/add-task`) aby:

1. **Używał hooka `useUserDepartments`** do pobrania wszystkich działów użytkownika z tabeli `user_departments`
2. **Pokazywał wszystkie działy użytkownika** w dropdownie wyboru działu
3. **Wyświetlał badge'e ze wszystkimi działami** w nagłówku formularza
4. **Ustawiał domyślny dział** na pierwszy z listy (primary department)

### Zmienione pliki:

#### `/app/dashboard/tasks/add-task/page.tsx`

**Przed:**
```typescript
// Pokazywało tylko główny dział użytkownika
if (profile.role === 'kierownik' && profile.department_id) {
  departmentsQuery = departmentsQuery.eq('id', profile.department_id)
}
```

**Po:**
```typescript
// Pokazuje wszystkie działy z user_departments
const { data: userDepts } = await supabase
  .from('user_departments')
  .select('department_id')
  .eq('user_id', user.id)

const userDepartmentIds = userDepts?.map(d => d.department_id) || []

if (profile.role !== 'dyrektor' && profile.role !== 'superadmin') {
  if (userDepartmentIds.length > 0) {
    departmentsQuery = departmentsQuery.in('id', userDepartmentIds)
  }
}
```

## 🎯 Zachowanie według roli:

### Pracownik / Kierownik:
- Widzi dropdown ze **wszystkimi swoimi działami** (z tabeli `user_departments`)
- Może tworzyć zadania dla **każdego ze swoich działów**
- Domyślnie wybrany jest pierwszy dział (primary)

### Dyrektor / Super Admin:
- Widzi **wszystkie działy** w systemie
- Może tworzyć zadania dla dowolnego działu

## 📋 Badge'e działów w formularzu:

```tsx
// Pokazuje wszystkie działy użytkownika
{departmentIds.map(deptId => {
  const dept = departments.find(d => d.id === deptId)
  return dept ? (
    <Badge key={deptId} variant="outline" className="text-xs">
      {dept.name}
    </Badge>
  ) : null
})}
```

## 🧪 Testowanie:

1. Zaloguj się jako użytkownik z wieloma działami
2. Przejdź do `/dashboard/tasks/add-task`
3. Sprawdź czy:
   - W nagłówku widoczne są badge'e ze wszystkimi działami
   - W dropdownie "Dział" widoczne są wszystkie działy użytkownika
   - Można stworzyć zadanie dla każdego z działów
   - Komunikat "Dostępne działy: X" pojawia się gdy użytkownik ma więcej niż 1 dział

## ✨ Dodatkowe ulepszenia:

- Dodano komunikat "Dostępne działy: X" pod dropdownem gdy użytkownik ma więcej niż 1 dział
- Badge'e działów w nagłówku używają `flex-wrap` dla lepszego wyświetlania
- Domyślny dział ustawiany jest inteligentnie (pierwszy z listy lub fallback do głównego)

## 🔗 Powiązane:

- Hook: `/hooks/useUserDepartments.ts`
- Tabela: `user_departments`
- Feature: Multi-department user assignment (ADR-0002)
- Migracja: `SQL/migration-user-departments.sql`
