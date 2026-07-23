-- Migration 037: Inserir dígito 9 em celulares com 10 dígitos (fixos que viraram móveis)
-- Afeta apenas números com exatamente 10 dígitos numéricos (DDD 2 dígitos + 8 dígitos)
-- Exemplo: 1681044706 → 16981044706

UPDATE clientes
SET celular = substring(celular FROM 1 FOR 2) || '9' || substring(celular FROM 3)
WHERE
  celular ~ '^[0-9]{10}$'
  AND substring(celular FROM 3 FOR 1) != '9';
