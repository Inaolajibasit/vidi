create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    case
      when new.raw_user_meta_data ->> 'username' ~ '^[A-Za-z0-9_]{3,24}$'
        then (new.raw_user_meta_data ->> 'username')::extensions.citext
      else null
    end,
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
        'Player'
      ),
      50
    ),
    left(
      coalesce(
        nullif(btrim(new.raw_user_meta_data ->> 'avatar_url'), ''),
        nullif(btrim(new.raw_user_meta_data ->> 'picture'), '')
      ),
      2048
    )
  );
  return new;
end;
$$;

update public.profiles as profile
set avatar_url = left(
  coalesce(
    nullif(btrim(account.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'picture'), '')
  ),
  2048
)
from auth.users as account
where account.id = profile.id
  and profile.avatar_url is null
  and coalesce(
    nullif(btrim(account.raw_user_meta_data ->> 'avatar_url'), ''),
    nullif(btrim(account.raw_user_meta_data ->> 'picture'), '')
  ) is not null;
