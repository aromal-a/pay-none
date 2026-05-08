ALTER TABLE public.token_transactions
ADD COLUMN IF NOT EXISTS amount_paid_inr numeric(10,2) NOT NULL DEFAULT 0;

UPDATE public.token_transactions
SET amount_paid_inr = ROUND(amount_cents::numeric / 100.0, 2)
WHERE currency = 'inr' AND amount_paid_inr = 0 AND status = 'completed' AND tokens_credited > 0;

COMMENT ON COLUMN public.token_transactions.amount_paid_inr IS
'Actual INR amount paid by the user into the merchant account for this purchase. 0 for token spends (forms, comments, sending spaces).';