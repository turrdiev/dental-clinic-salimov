-- Performance indexes for DentAdmin
-- Speeds up patient search and attachment lookup by patient

CREATE INDEX IF NOT EXISTS "patients_full_name_idx" ON "patients"("full_name");
CREATE INDEX IF NOT EXISTS "attachments_patient_id_idx" ON "attachments"("patient_id");
