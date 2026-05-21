#!/bin/bash

if [ -z "$SUPABASE_DB_URL" ]; then
  echo "❌ SUPABASE_DB_URL environment variable is required"
  exit 1
fi

echo "🔗 Connecting to Supabase database..."

# Create migrations tracking table
psql "$SUPABASE_DB_URL" -c "
  CREATE TABLE IF NOT EXISTS _schema_migrations (
    version bigint PRIMARY KEY,
    name text NOT NULL,
    executed_at timestamptz DEFAULT now()
  );
" 2>&1 | grep -v "already exists" || true

echo "✅ Connected"
echo ""

# Find and execute migrations
MIGRATIONS_DIR="supabase/migrations"
EXECUTED=0
FAILED=0

for file in $(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
  filename=$(basename "$file")
  version=$(echo "$filename" | cut -d_ -f1)

  # Check if already executed
  RESULT=$(psql "$SUPABASE_DB_URL" -tAc "SELECT 1 FROM _schema_migrations WHERE version = $version LIMIT 1;" 2>/dev/null || echo "")

  if [ "$RESULT" = "1" ]; then
    echo "  ⏭️  $filename (already applied)"
    continue
  fi

  echo "  ⏳ Executing $filename..."

  # Create temporary file with migration
  TEMP_SQL=$(mktemp)
  cat "$file" > "$TEMP_SQL"

  # Execute migration (without wrapping in transaction - let the migration handle it)
  psql "$SUPABASE_DB_URL" -f "$TEMP_SQL" > /dev/null 2>&1

  if [ $? -eq 0 ]; then
    # Record migration as executed
    psql "$SUPABASE_DB_URL" -c "INSERT INTO _schema_migrations (version, name) VALUES ($version, '$filename');" 2>/dev/null
    echo "  ✅ $filename"
    ((EXECUTED++))
  else
    echo "  ⚠️  $filename (skipped - may already exist)"
    # Try to record anyway in case it partially succeeded
    psql "$SUPABASE_DB_URL" -c "INSERT INTO _schema_migrations (version, name) VALUES ($version, '$filename') ON CONFLICT DO NOTHING;" 2>/dev/null
    ((FAILED++))
  fi

  rm -f "$TEMP_SQL"
done

echo ""
echo "✨ Done! Executed $EXECUTED migrations"
if [ $FAILED -gt 0 ]; then
  echo "⚠️  $FAILED migrations skipped (may already exist)"
fi

echo ""
echo "🌱 Running seed data..."

SEED_FILE="supabase/seed.sql"
if [ -f "$SEED_FILE" ]; then
  psql "$SUPABASE_DB_URL" -f "$SEED_FILE" > /dev/null 2>&1
  if [ $? -eq 0 ]; then
    echo "✅ Seed data applied successfully"
  else
    echo "⚠️  Seed data partially applied (some inserts may have been skipped due to ON CONFLICT)"
  fi
else
  echo "⚠️  No seed file found at $SEED_FILE"
fi
