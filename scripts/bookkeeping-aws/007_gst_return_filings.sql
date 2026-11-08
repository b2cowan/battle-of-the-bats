-- GST/HST Stage 4b Session C: "Mark as filed". One row per filing, append-only (the app may SELECT and INSERT, never change one).
-- filing_no counts every filing one after another, so two filings saved at once collide on the key and the second is refused.
-- Marking the same dates again is an amended return: a new row with period_revision + 1 and a required reason. The latest shows.
-- Lines are cents (101 also as its whole dollars). A line that was "Not available" is refused by the app, so none is NULL.
-- sources is the JSON the app writes and reads whole (lib/gst-return-filing.ts FiledSources, with its own format version), kept as text.
-- One row keeps a filing inside the 3,000-rows-per-transaction limit however many invoices and expenses stand behind it.
CREATE TABLE IF NOT EXISTS bookkeeping.gst_return_filings (
  filing_no integer NOT NULL CHECK (filing_no > 0),
  period_from date NOT NULL,
  period_to date NOT NULL,
  period_revision integer NOT NULL CHECK (period_revision > 0),
  filed_on date NOT NULL,
  registration_date date NOT NULL,
  line_101_dollars bigint NOT NULL,
  line_101_cents bigint NOT NULL,
  line_103_cents bigint NOT NULL,
  line_104_cents bigint NOT NULL,
  line_105_cents bigint NOT NULL,
  line_106_cents bigint NOT NULL,
  line_107_cents bigint NOT NULL,
  line_108_cents bigint NOT NULL,
  line_109_cents bigint NOT NULL,
  partial boolean NOT NULL,
  open_items integer NOT NULL CHECK (open_items >= 0),
  sources text NOT NULL CHECK (octet_length(sources) BETWEEN 2 AND 1000000),
  reason text CHECK (reason IS NULL OR length(btrim(reason)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL,
  PRIMARY KEY (filing_no),
  CHECK (period_from <= period_to),
  CHECK (filed_on > period_to),
  CHECK (period_revision = 1 OR reason IS NOT NULL)
);
REVOKE ALL ON bookkeeping.gst_return_filings FROM PUBLIC;
GRANT SELECT, INSERT ON bookkeeping.gst_return_filings TO bookkeeping_app;
