#!/bin/bash

# 특허 목록 조회 스크립트
# Usage: ./get_patent_list.sh [page_no] [num_rows] [owner_id]

PAGE_NO=${1:-"1"}
NUM_ROWS=${2:-"10"}
OWNER_ID=${3:-"171"}
API_URL="http://172.16.1.210:10130/api"

echo "Fetching patent list (Page: $PAGE_NO, Rows: $NUM_ROWS, Owner: $OWNER_ID)..."

curl -X POST "$API_URL" \
  -F "operation=GET-PATENT-LIST" \
  -F "owner_id=$OWNER_ID" \
  -F "filter_dict={}" \
  -F "order_dict=[]" \
  -F "filter_group_conjunction_list=[]" \
  -F "num-rows-per-page=$NUM_ROWS" \
  -F "page-no=$PAGE_NO"
