#!/bin/bash
# ================================================
# DentAdmin — Push optimized files to GitHub
# Run this from inside your cloned repo folder:
#   cd dental-clinic-salimov
#   bash push-to-github.sh
# ================================================
set -e

echo "🦷 DentAdmin — applying optimizations..."

# Helper to download a file from the zip we'll unzip locally
FIXED_DIR="$(dirname "$0")/dental-clinic-fixed"

if [ ! -d "$FIXED_DIR" ]; then
  echo "❌ Run this script from the same folder where dental-clinic-fixed/ lives"
  exit 1
fi

FILES=(
  "src/App.tsx"
  "src/types.ts"
  "src/utils/api.ts"
  "src/components/Dashboard.tsx"
  "src/components/CalendarSystem.tsx"
  "src/components/PatientManagement.tsx"
  "src/components/DoctorManagement.tsx"
  "src/components/FinancialAnalytics.tsx"
  "src/components/Header.tsx"
  "server.ts"
  "server/routes/appointments.ts"
  "server/routes/other.ts"
  "vite.config.ts"
  "package.json"
)

REPO_DIR="$(pwd)"

for f in "${FILES[@]}"; do
  src="$FIXED_DIR/$f"
  dst="$REPO_DIR/$f"
  if [ -f "$src" ]; then
    mkdir -p "$(dirname "$dst")"
    cp "$src" "$dst"
    echo "✅ $f"
  else
    echo "⚠️  Not found: $src"
  fi
done

# New migration
mkdir -p "$REPO_DIR/prisma/migrations/20260627000000_perf_indexes"
cp "$FIXED_DIR/prisma/migrations/20260627000000_perf_indexes/migration.sql" \
   "$REPO_DIR/prisma/migrations/20260627000000_perf_indexes/migration.sql"
echo "✅ prisma/migrations/20260627000000_perf_indexes/migration.sql"

echo ""
echo "📦 Committing and pushing..."
git add -A
git commit -m "perf: optimistic updates, lazy loading, React.memo, fix dates, gzip, vite chunks

- Remove fetchAllTables() after every mutation → optimistic local state updates
- Fix all hardcoded '2026-05-30' dates → dynamic new Date()
- Add React.lazy() for 6 heavy tab components (code splitting)
- Wrap all handlers with useCallback (stable references)
- Wrap all components with React.memo (prevent re-renders)
- Add gzip compression to server
- Vite: manualChunks for react/recharts/lucide/motion
- /api/init: role-based data, select only needed fields
- Exclude base64 url from attachment list, add /download endpoint
- Parallel conflict checks with Promise.all
- Add DB indexes: patients(full_name), attachments(patient_id)
- Background notifications polling every 30s"

git push origin main
echo ""
echo "🚀 Done! Vercel will auto-deploy in ~30 seconds."
