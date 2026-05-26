-- Adiciona campo apelido na tabela clientes
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS apelido TEXT;
