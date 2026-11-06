-- An Idempotency-Key names one call: this user, this tool, these arguments. The hash is of the
-- canonical JSON of { name, arguments }; a replay with different arguments is a caller bug,
-- never a free replay of somebody else's (or a different) result.
ALTER TABLE mcp_call ADD COLUMN args_hash TEXT NOT NULL DEFAULT '';
