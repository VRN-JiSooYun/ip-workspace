# 특허 설명 이미지 업로드 구현 계획

## 목표

`PatentRecordDetailModal`의 Quill 설명 편집기에서 드래그 앤 드롭, 클립보드 붙여넣기,
파일 선택으로 이미지를 추가하고 SeaweedFS에 영구 저장한다.

## 계획

1. 기존 Quill·특허 API·환경설정 구조와 SeaweedFS Filer REST 계약을 확인한다.
2. SeaweedFS 경로 구성 및 이미지 업로드·조회·삭제 Backend API를 구현한다.
3. Quill에 로컬 미리보기, 업로드 상태, 드롭 UI와 붙여넣기 처리를 추가한다.
4. 취소 및 본문 이미지 제거 시 신규 업로드 정리 흐름을 연결한다.
5. 환경변수와 운영 계약을 문서화하고 정적 검증한다.

## 비목표

- 이미지를 base64로 `patent.note`에 저장하지 않는다.
- SeaweedFS 파일 목록 UI나 범용 첨부 파일 관리 기능은 이번 범위에 포함하지 않는다.
- PostgreSQL에 이미지 메타데이터 table을 추가하지 않는다.
