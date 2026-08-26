-- 상태 메모(status_note)를 설명(note)으로 합친다.
--
-- 두 컬럼 모두 IP팀 운영 시트의 자유 서술이었다. status_note는 '현재 Status' 옆 설명,
-- note는 '기타'다. 화면에서 둘을 따로 보여 주니 "어느 칸에 적어야 하나"가 매번 생겼고,
-- 상세 모달이 note를 편집 가능한 '설명'으로 열면서 status_note만 읽기 전용으로 남았다.
-- 자리를 하나로 합친다.
--
-- **status_note가 있으면 note를 덮어쓴다.** 이어 붙이지 않는다 — 운영 데이터에서 실제
-- 내용은 status_note 쪽에 있고 note는 대부분 비어 있거나 부스러기다.
--
-- 컬럼은 지우지 않는다. 합친 결과가 이상하면 원본과 대조할 수 있어야 한다.
-- 확인이 끝나면 별도 마이그레이션으로 DROP한다.
--
-- 옮기는 값은 평문이므로 HTML로 감싼다. 편집기(Quill)와 화면의 거름망이 HTML을 다루고,
-- 감싸지 않으면 `<`가 들어간 옛 메모가 그리는 순간 태그로 읽힌다.
UPDATE "patent"
SET "note" =
  '<p>'
  || replace(
       regexp_replace(
         replace(
           replace(
             replace(btrim("status_note"), '&', '&amp;'),
             '<', '&lt;'
           ),
           '>', '&gt;'
         ),
         -- 시트에서 붙여 넣은 값은 개행이 \r\n일 수도, \r만일 수도 있다.
         E'\r\n?', E'\n', 'g'
       ),
       E'\n', '</p><p>'
     )
  || '</p>'
WHERE "status_note" IS NOT NULL
  AND btrim("status_note") <> '';
