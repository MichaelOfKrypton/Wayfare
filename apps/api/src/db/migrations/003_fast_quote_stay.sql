-- Same results as before (parity-tested against packages/shared/src/pricing.ts),
-- but counts weekend nights arithmetically instead of generating one row per
-- night. Search prices every eligible offer, so this runs thousands of times
-- per query.
--
-- Weekend nights are Friday (isodow 5) and Saturday (isodow 6). A stay of N
-- nights starting on isodow s has 2 per full week, plus a Friday or Saturday in
-- the remaining N % 7 nights when its offset from s is below that remainder.
CREATE OR REPLACE FUNCTION quote_stay(
  p_nightly_cents  integer,
  p_weekend_cents  integer,
  p_fee_cents      integer,
  p_tax_bps        integer,
  p_includes_tax   boolean,
  p_check_in       date,
  p_check_out      date
) RETURNS TABLE (
  nights              integer,
  weekend_nights      integer,
  room_subtotal_cents bigint,
  fees_cents          bigint,
  tax_cents           bigint,
  total_cents         bigint
)
LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT n.nights, n.weekend_nights, s.subtotal, p_fee_cents::bigint, t.tax,
         CASE WHEN p_includes_tax THEN s.subtotal + p_fee_cents ELSE s.subtotal + p_fee_cents + t.tax END
  FROM (
    SELECT (p_check_out - p_check_in) AS nights,
           2 * ((p_check_out - p_check_in) / 7)
           + CASE WHEN (12 - extract(isodow FROM p_check_in)::int) % 7 < (p_check_out - p_check_in) % 7 THEN 1 ELSE 0 END
           + CASE WHEN (13 - extract(isodow FROM p_check_in)::int) % 7 < (p_check_out - p_check_in) % 7 THEN 1 ELSE 0 END
             AS weekend_nights
  ) n
  CROSS JOIN LATERAL (
    SELECT (n.nights - n.weekend_nights)::bigint * p_nightly_cents
           + n.weekend_nights::bigint * coalesce(p_weekend_cents, p_nightly_cents) AS subtotal
  ) s
  CROSS JOIN LATERAL (
    SELECT CASE WHEN p_includes_tax
             THEN round((s.subtotal + p_fee_cents)::numeric * p_tax_bps / (10000 + p_tax_bps))
             ELSE round((s.subtotal + p_fee_cents)::numeric * p_tax_bps / 10000)
           END::bigint AS tax
  ) t
  WHERE n.nights >= 1;
$$;
