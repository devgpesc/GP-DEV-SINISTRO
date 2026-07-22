-- Limpa placeholders de cadastro rápido: mostra a placa no lugar do modelo fantasma
UPDATE vehicles
SET
  brand = CASE
    WHEN upper(trim(coalesce(brand, ''))) IN ('A DEFINIR', 'A DEFINIR.', 'INDEFINIDO', 'N/A', '-') THEN '—'
    ELSE brand
  END,
  model = CASE
    WHEN upper(trim(translate(coalesce(model, ''), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç', 'AAAAEEEIIIOOOOUUUCaaaaeeeiiioooouuuc')))
         IN ('CADASTRO RAPIDO', 'A DEFINIR', 'INDEFINIDO', 'N/A', '-')
      THEN upper(plate)
    ELSE model
  END
WHERE
  upper(trim(coalesce(brand, ''))) IN ('A DEFINIR', 'A DEFINIR.', 'INDEFINIDO', 'N/A', '-')
  OR upper(trim(translate(coalesce(model, ''), 'ÁÀÂÃÉÈÊÍÌÎÓÒÔÕÚÙÛÇáàâãéèêíìîóòôõúùûç', 'AAAAEEEIIIOOOOUUUCaaaaeeeiiioooouuuc')))
     IN ('CADASTRO RAPIDO', 'A DEFINIR', 'INDEFINIDO', 'N/A', '-');

SELECT plate, brand, model FROM vehicles ORDER BY created_at DESC NULLS LAST LIMIT 10;
