#!/bin/bash

# 타겟 목록 조회 스크립트
# Usage: ./get_target_list.sh [owner_id]

OWNER_ID=${1:-"171"}
API_URL="http://172.16.1.210:10130/api"

echo "Fetching target list for Owner: $OWNER_ID..."

curl -X POST "$API_URL" \
  -F "operation=GET-TARGET-LIST" \
  -F "owner_id=$OWNER_ID"
