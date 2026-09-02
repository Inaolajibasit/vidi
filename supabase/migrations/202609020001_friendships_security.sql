-- Restrict friendship state transitions to the intended mutual-friend flow.
-- The requester creates `pending`; only the addressee may accept it. Blocked
-- relationships are reserved for a later moderation flow and cannot be changed
-- through the ordinary friendship policies.
drop policy if exists "friendship participants can update friendships"
  on public.friendships;
drop policy if exists "friendship participants can delete friendships"
  on public.friendships;

create policy "addressees can accept pending friendships"
  on public.friendships for update to authenticated
  using (
    addressee_id = (select auth.uid())
    and status = 'pending'
  )
  with check (
    addressee_id = (select auth.uid())
    and status = 'accepted'
  );

create policy "participants can decline or remove friendships"
  on public.friendships for delete to authenticated
  using (
    (select auth.uid()) in (requester_id, addressee_id)
    and (
      status = 'accepted'
      or (status = 'pending' and addressee_id = (select auth.uid()))
    )
  );
