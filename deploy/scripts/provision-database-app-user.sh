#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
PROJECT_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
ENV_FILE="${ENV_FILE:-$PROJECT_DIR/.env.production}"
COMPOSE=(docker compose --env-file "$ENV_FILE" -f "$DEPLOY_DIR/docker-compose.yml")

[ -r "$ENV_FILE" ] || { echo "database app-user provision failed: env file is not readable: $ENV_FILE" >&2; exit 1; }
"${COMPOSE[@]}" config --quiet

"${COMPOSE[@]}" exec -T mysql sh -lc '
  set -eu

  fail() {
    printf "database app-user provision failed: %s\n" "$1" >&2
    exit 1
  }

  case "${MYSQL_DATABASE:-}" in
    ""|*[!A-Za-z0-9_]*) fail "MYSQL_DATABASE must contain only letters, digits, and underscore" ;;
  esac
  case "${MYSQL_USER:-}" in
    ""|*[!A-Za-z0-9_]*) fail "MYSQL_USER must contain only letters, digits, and underscore" ;;
  esac
  [ "$MYSQL_USER" != root ] || fail "MYSQL_USER=root is forbidden for the application runtime"
  [ -n "${MYSQL_ROOT_PASSWORD:-}" ] || fail "MYSQL_ROOT_PASSWORD is empty"
  [ -n "${MYSQL_PASSWORD:-}" ] || fail "MYSQL_PASSWORD is empty"
  [ "$MYSQL_ROOT_PASSWORD" != "$MYSQL_PASSWORD" ] || fail "application DB password must differ from the MySQL root password"

  case "$MYSQL_ROOT_PASSWORD $MYSQL_PASSWORD" in
    *REPLACE_WITH_*|*CHANGE_ME*|*CHANGE_THIS*|*CHANGEME*) fail "database credentials still contain template placeholders" ;;
  esac

  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -NBe "SELECT 1" >/dev/null \
    || fail "cannot authenticate as MySQL root with DB_ROOT_PASSWORD"

  password_hex="$(printf "%s" "$MYSQL_PASSWORD" | od -An -tx1 | tr -d " \n")"
  [ -n "$password_hex" ] || fail "cannot encode application DB password"

  mysql -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
SET @app_password = CONVERT(0x${password_hex} USING utf8mb4);
SET @create_user_sql = CONCAT('CREATE USER IF NOT EXISTS ''${MYSQL_USER}''@''%'' IDENTIFIED BY ', QUOTE(@app_password));
PREPARE app_stmt FROM @create_user_sql;
EXECUTE app_stmt;
DEALLOCATE PREPARE app_stmt;
SET @alter_user_sql = CONCAT('ALTER USER ''${MYSQL_USER}''@''%'' IDENTIFIED BY ', QUOTE(@app_password));
PREPARE app_stmt FROM @alter_user_sql;
EXECUTE app_stmt;
DEALLOCATE PREPARE app_stmt;
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${MYSQL_USER}'@'%';
GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'%';
SQL

  result="$(mysql -h127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" "$MYSQL_DATABASE" -NBe "SELECT 1" 2>/dev/null || true)"
  [ "$result" = 1 ] || fail "application DB user cannot connect to the configured business database"

  if mysql -h127.0.0.1 -u"$MYSQL_USER" -p"$MYSQL_PASSWORD" -NBe "SELECT COUNT(*) FROM mysql.user" >/dev/null 2>&1; then
    fail "application DB user can read mysql.user; global/root-like privileges are forbidden"
  fi

  grants="$(mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -NBe "SHOW GRANTS FOR '\''${MYSQL_USER}'\''@'\''%'\''" 2>/dev/null)"
  printf "%s\n" "$grants" | grep -F "ON \`${MYSQL_DATABASE}\`.*" >/dev/null \
    || fail "application DB user is missing business-database privileges"
  if printf "%s\n" "$grants" | grep -F " ON *.* " | grep -v "GRANT USAGE ON *.*" >/dev/null; then
    fail "application DB user retains global privileges"
  fi
'

echo "[database-app-user-provision] PASS"
