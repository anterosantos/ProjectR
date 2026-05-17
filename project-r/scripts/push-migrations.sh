#!/bin/bash
set -e

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

  # Execute migration with transaction
  SQL_CONTENT=$(cat "$file")
  psql "$SUPABASE_DB_URL" << EOF
BEGIN;
$SQL_CONTENT
INSERT INTO _schema_migrations (version, name) VALUES ($version, '$filename');
COMMIT;
EOF

  if [ $? -eq 0 ]; then
    echo "  ✅ $filename"
    ((EXECUTED++))
  else
    echo "  ❌ $filename failed"
    exit 1
  fi
done

echo ""
echo "✨ Done! Executed $EXECUTED new migrations"
