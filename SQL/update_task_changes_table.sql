-- Dodaj kolumny dla terminu do tabeli task_changes
ALTER TABLE task_changes 
ADD COLUMN old_due_date timestamp with time zone,
ADD COLUMN new_due_date timestamp with time zone;

-- Opcjonalnie: dodaj komentarz do kolumn
COMMENT ON COLUMN task_changes.old_due_date IS 'Stary termin zadania';
COMMENT ON COLUMN task_changes.new_due_date IS 'Nowy termin zadania'; 