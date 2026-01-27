
-- Migration: Enforce Vehicle and Associate Links on Events Table

-- 1. Adicionar colunas se não existirem (Safe)
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS "vehicleId" UUID,
ADD COLUMN IF NOT EXISTS "associateId" UUID;

-- 2. Atualizar registros antigos (Opcional - definir um default ou deletar órfãos)
-- DELETE FROM events WHERE "vehicleId" IS NULL OR "associateId" IS NULL;

-- 3. Impor Constraint NOT NULL
ALTER TABLE events 
ALTER COLUMN "vehicleId" SET NOT NULL,
ALTER COLUMN "associateId" SET NOT NULL;

-- 4. Criar Foreign Keys para Integridade
ALTER TABLE events
ADD CONSTRAINT fk_event_vehicle
FOREIGN KEY ("vehicleId") 
REFERENCES vehicles(id)
ON DELETE RESTRICT; -- Não pode deletar veículo se houver sinistro

ALTER TABLE events
ADD CONSTRAINT fk_event_associate
FOREIGN KEY ("associateId") 
REFERENCES associates(id)
ON DELETE RESTRICT;

-- 5. Criar Índices para Performance de Busca
CREATE INDEX IF NOT EXISTS idx_events_vehicle ON events("vehicleId");
CREATE INDEX IF NOT EXISTS idx_events_associate ON events("associateId");

-- 6. Opcional: Trigger para validar se Vehicle pertence ao Associate no banco
-- (Isso garante consistência mesmo se inserido via SQL direto)
CREATE OR REPLACE FUNCTION check_vehicle_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM vehicles 
    WHERE id = NEW."vehicleId" 
    AND "associateId" = NEW."associateId"
  ) THEN
    RAISE EXCEPTION 'O veículo informado não pertence ao associado vinculado.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_event_consistency
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW
EXECUTE FUNCTION check_vehicle_owner();
