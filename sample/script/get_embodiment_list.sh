#!/bin/bash

# 특허 상세 데이터 조회 스크립트
# Usage: ./get_patent_data.sh [publication_number] [owner_id]

PUB_NUMBER=${1:-"WO2026090333A1"}
OWNER_ID=${2:-"171"}
API_URL="http://172.16.1.210:10130/api"

echo "Fetching patent data for $PUB_NUMBER (Owner: $OWNER_ID)..."

curl -X POST "$API_URL" \
  -F "operation=GET-EMBODIMENT-LIST" \
  -F "actionType=GET-EMBODIMENT-LIST" \
  -F "publication_number=$PUB_NUMBER" \
  -F "owner_id=$OWNER_ID" \
  -F "filter_dict={}" \
  -F "ligand_filter_dict=[]" \
  -F "order_dict=[]" \
  -F "filter_group_conjunction_list=[]" \
  -F "num-rows-per-page=10" \
  -F "page-no=1" \
  -F "whose=my"
