-- A tela de Usuarios oferece os perfis admin, operador, caixa e estoque
-- (src/data/config/business.json), mas o CHECK so aceitava
-- admin, operador e vendedor: escolher Caixa ou Estoque falhava ao salvar.
-- Amplia o CHECK mantendo 'vendedor' para nao invalidar linhas antigas.
alter table public.usuarios drop constraint if exists usuarios_perfil_check;
alter table public.usuarios
  add constraint usuarios_perfil_check
  check (perfil = any (array['admin','operador','vendedor','caixa','estoque']));
