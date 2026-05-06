#!/bin/bash

# 화합물 검색 스크립트
# Usage: ./search_compound.sh [smiles] [type] [owner_id]

SMILES=${1:-"C1=CC=CC=C1"}
SEARCH_TYPE=${2:-"substructure"}
SIM=${3:-"70"}
OWNER_ID=${4:-"171"}
API_URL="http://172.16.1.210:10130/api"

echo "Searching compound (Type: $SEARCH_TYPE)..."

curl -X POST "$API_URL" \
  -F "operation=GET-ELASTIC-COMPOUND-LIST" \
  -F "smiles=$SMILES" \
  -F "type=$SEARCH_TYPE" \
  -F "sim=$SIM" \
  -F "page=1" \
  -F "size=10" \
  -F "owner_id=$OWNER_ID"
