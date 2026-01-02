-- FAZA 1: Dodavanje UNIQUE constraint na tx_hash (bez brisanja - bezbednije)
-- Prvo samo dodaj constraint, duplikate ćemo rešiti ručno ako postoje

-- Ako constraint već postoji, ignoriši
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'game_tickets_tx_hash_unique'
  ) THEN
    -- Prvo pronađi i označi duplikate tako da samo jedan ostane sa pravim tx_hash
    -- Ostali dobiju NULL tx_hash
    WITH duplicates AS (
      SELECT id, tx_hash,
        ROW_NUMBER() OVER (PARTITION BY tx_hash ORDER BY created_at ASC) as rn
      FROM game_tickets 
      WHERE tx_hash IS NOT NULL
    )
    UPDATE game_tickets 
    SET tx_hash = NULL 
    WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
    
    -- Sada dodaj UNIQUE constraint
    ALTER TABLE game_tickets ADD CONSTRAINT game_tickets_tx_hash_unique UNIQUE (tx_hash);
  END IF;
END $$;