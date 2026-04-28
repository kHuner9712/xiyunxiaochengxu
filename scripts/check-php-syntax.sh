#!/usr/bin/env bash
set -euo pipefail

if ! command -v php &>/dev/null; then
  echo "ERROR: php command not found. Install PHP CLI >= 8.1 and add to PATH."
  echo "  Windows: https://windows.php.net/download/"
  echo "  macOS:   brew install php@8.1"
  echo "  Ubuntu:  sudo apt install php8.1-cli"
  exit 1
fi

PHP_VERSION=$(php -r "echo PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION;")
echo "PHP version: ${PHP_VERSION}"

if php -r "exit version_compare(PHP_VERSION, '8.1.0', '<') ? 1 : 0;"; then
  echo "WARNING: PHP version ${PHP_VERSION} is below 8.1. Some syntax may not be checked correctly."
fi

FILES=(
  shopxo-backend/app/admin/controller/Activity.php
  shopxo-backend/app/admin/controller/Article.php
  shopxo-backend/app/api/controller/Buy.php
  shopxo-backend/app/api/controller/Cashier.php
  shopxo-backend/app/api/controller/Common.php
  shopxo-backend/app/api/controller/Order.php
  shopxo-backend/app/api/controller/Paylog.php
  shopxo-backend/app/module/LayoutModule.php
  shopxo-backend/app/service/ActivityService.php
  shopxo-backend/app/service/AppCenterNavService.php
  shopxo-backend/app/service/AppHomeNavService.php
  shopxo-backend/app/service/DiyApiService.php
  shopxo-backend/app/service/MuyingComplianceService.php
  shopxo-backend/app/service/MuyingContentComplianceService.php
  shopxo-backend/app/service/PluginsService.php
  shopxo-backend/app/service/QuickNavService.php
  shopxo-backend/app/service/SystemBaseService.php
)

PASS=0
FAIL=0
SKIP=0

for f in "${FILES[@]}"; do
  if [ ! -f "$f" ]; then
    echo "SKIP  $f (file not found)"
    SKIP=$((SKIP + 1))
    continue
  fi
  if php -l "$f" 2>&1 | grep -q "No syntax errors detected"; then
    echo "PASS  $f"
    PASS=$((PASS + 1))
  else
    echo "FAIL  $f"
    php -l "$f" 2>&1
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "=== Summary ==="
echo "PASS: ${PASS}  FAIL: ${FAIL}  SKIP: ${SKIP}  Total: ${#FILES[@]}"

if [ "${FAIL}" -gt 0 ]; then
  echo "RESULT: FAIL — syntax errors detected"
  exit 1
else
  echo "RESULT: PASS — no syntax errors detected"
  exit 0
fi
