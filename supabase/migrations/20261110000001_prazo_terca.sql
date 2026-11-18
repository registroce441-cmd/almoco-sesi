create or replace function public.motivo_bloqueio_marcacao(p_data date)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  cfg    public.configuracoes;
  agora  timestamp := now() at time zone 'America/Sao_Paulo';
  limite timestamp;
begin
  select * into cfg from public.configuracoes where id = 1;
  if not found then
    return 'As marcações estão indisponíveis no momento.';
  end if;

  if extract(isodow from p_data) not between 1 and 5 then
    return 'Esse dia não tem almoço.';
  end if;
  if p_data = any (cfg.dias_bloqueados) then
    return 'Não haverá almoço nesse dia.';
  end if;
  if p_data < agora::date then
    return 'Esse dia já passou.';
  end if;

  limite := (p_data - (extract(isodow from p_data)::int - 1) + 1) + cfg.prazo_limite;
  if agora > limite then
    return 'O prazo para marcar essa semana já encerrou (era até terça).';
  end if;
  return null;
end;
$$;
