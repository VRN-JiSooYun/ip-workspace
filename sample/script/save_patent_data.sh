#!/bin/bash

# 특허 상세 데이터 조회 및 JSON 저장 스크립트
# Usage: ./save_patent_data.sh [publication_number] [owner_id]

PUB_NUMBER=${1:-"WO2026090333A1"}
OWNER_ID=${2:-"171"}
API_URL="http://172.16.1.210:10130/api"
OUTPUT_FILE="${PUB_NUMBER}.json"

echo "📡 API 호출 중: $PUB_NUMBER (Owner: $OWNER_ID)..."

# API 호출 및 결과를 파일로 저장 (-s 옵션으로 진행바 숨김)
curl -s -X POST "$API_URL" \
  -F "operation=GET-PATENT-DATA" \
  -F "publication_number=$PUB_NUMBER" \
  -F "owner_id=$OWNER_ID" > "$OUTPUT_FILE"

# 파일 저장 성공 여부 확인
if [ $? -eq 0 ] && [ -s "$OUTPUT_FILE" ]; then
    echo "--------------------------------------------------"
    echo "✅ 저장 완료: $OUTPUT_FILE"
    echo "📂 파일 크기: $(du -h "$OUTPUT_FILE" | cut -f1)"
    echo "--------------------------------------------------"
else
    echo "❌ 에러: 데이터 수신에 실패했거나 파일이 비어 있습니다."
    exit 1
fi
