UPDATE services
SET currency = 'TOMAN'
WHERE currency IS NULL OR currency = '' OR currency = 'IRR';
