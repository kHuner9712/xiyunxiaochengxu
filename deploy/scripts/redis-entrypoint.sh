#!/bin/sh
set -eu

OVERCOMMIT_FILE=/proc/sys/vm/overcommit_memory
if [ ! -r "$OVERCOMMIT_FILE" ]; then
  echo "FATAL: cannot read $OVERCOMMIT_FILE; refusing to start production Redis without host memory-overcommit verification" >&2
  exit 1
fi

OVERCOMMIT_VALUE="$(cat "$OVERCOMMIT_FILE" | tr -d '[:space:]')"
if [ "$OVERCOMMIT_VALUE" != "1" ]; then
  echo "FATAL: Redis requires host vm.overcommit_memory=1 for reliable background save/AOF rewrite; current=$OVERCOMMIT_VALUE" >&2
  echo "Set it on the host with: sysctl vm.overcommit_memory=1 (and persist vm.overcommit_memory = 1 in /etc/sysctl.conf)" >&2
  exit 1
fi

THP_FILE=/sys/kernel/mm/transparent_hugepage/enabled
if [ -r "$THP_FILE" ] && ! grep -q '\[never\]' "$THP_FILE"; then
  echo "WARN: Transparent Huge Pages are enabled; Redis recommends disabling THP to avoid latency and memory-usage issues" >&2
fi

if [ -n "${REDIS_PASSWORD:-}" ]; then
  exec redis-server /etc/redis/redis.conf --requirepass "$REDIS_PASSWORD"
else
  exec redis-server /etc/redis/redis.conf
fi
