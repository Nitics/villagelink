-- Staff and super users see hidden listings too, so they can review and show them again.
create policy "Staff see all listings" on public.listings
  for select to authenticated using ((select private.is_staff()));
