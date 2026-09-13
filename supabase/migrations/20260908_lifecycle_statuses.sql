-- Adds the post-expiry lifecycle decisions used by the MOU tracker.
alter type public.mou_status add value if not exists 'expected_renewal';
alter type public.mou_status add value if not exists 'closed';
