-- 특허 단위 문서(명세서·공보 등)의 원본 URL.
--
-- OA DB의 `patent.document_path`를 그대로 옮겨 담는 자리다. 이 로컬 스키마는 OA 스키마를
-- 미러링하고 있는데(admin·office_action·response), patent만 이 컬럼이 빠져 있어서
-- 문서 연결이 OA에 매달린 문서밖에 가져오지 못했다.
--
-- OA에 매이지 않은 문서라 admin → office_action을 거치지 않는다. 문서 뷰어는 이 값을
-- 통지서가 없는 항목 하나로 받아 그린다(patent-record-documents.ts).
ALTER TABLE "patent" ADD COLUMN "document_path" TEXT;
