-- 진행 현황(진행 단계) 코드를 DB에 정본으로 둔다.
--
-- 진행 현황 카드의 집계·필터가 이 코드와 join되어야 하고, EESR/OPT-OUT처럼 국가별로
-- 늘어나는 단계를 코드 배포 없이 추가해야 하므로 상수가 아니라 테이블로 둔다.
-- 초기 14개 단계는 IP팀이 정리한 정의를 그대로 넣는다(정의 근거는
-- docs/patent_stage_definitions.md).

-- 파이프라인에 그려지는 대분류. 상세 단계 14개를 한 줄에 늘어놓을 수 없어
-- 표시용 상위 묶음을 따로 둔다.
CREATE TABLE "patent_stage_group" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,

    CONSTRAINT "patent_stage_group_pkey" PRIMARY KEY ("code")
);

CREATE TABLE "patent_stage" (
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "ordinal" INTEGER NOT NULL,
    "group_code" TEXT NOT NULL,
    -- 이 단계가 의미를 갖는 국가/제도. country.country 코드를 콤마로 나열하며
    -- NULL은 공통이다. KR 특허 화면에 EESR 단계가 0건으로 남는 것을 막는 표시 힌트다.
    "scope" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "patent_stage_pkey" PRIMARY KEY ("code")
);

-- ordinal은 10칸씩 띄워 나중에 중간 단계를 끼워 넣을 수 있게 한다.
INSERT INTO "patent_stage_group" ("code", "label", "ordinal") VALUES
    ('PREP',     '출원 준비', 10),
    ('FILED',    '출원',      20),
    ('EXAM',     '심사',      30),
    ('RESPONSE', '대응',      40),
    ('REG',      '등록',      50),
    ('CLOSED',   '종결',      60),
    ('ETC',      '기타 절차', 70);

INSERT INTO "patent_stage"
    ("code", "label", "description", "ordinal", "group_code", "scope") VALUES
    ('FILING_PREP', '출원 준비', '명세서 작성, 번역, 발명자 검토 등 특허청 제출 전 준비 단계', 10, 'PREP', NULL),
    ('FILED', '출원', '관할 특허청(KIPO, USPTO, EPO 등)에 출원서 제출 완료', 20, 'FILED', NULL),
    ('EXAM_REQUEST', '심사 청구', '특허청에 실체심사를 요청하는 단계 (한국/일본 등 심사청구주의 국가 대상)', 30, 'EXAM', 'KR,JP'),
    ('EXAM_DEFER', '심사 유예', '출원인의 사정이나 전략적 이유로 심사 착수를 일정 기간 미뤄둔 상태', 40, 'EXAM', 'KR'),
    ('EXAM', '심사', '특허청 심사관이 등록 가능 여부를 본격적으로 검토 중인 단계', 50, 'EXAM', NULL),
    ('EESR_ISSUED', 'EESR 발행', '유럽특허청(EPO) 발행 확정 전 조사의견서(Extended European Search Report) 수신 상태', 60, 'RESPONSE', 'EP'),
    ('EESR_RESPONSE', 'EESR 제출', 'EESR에 대한 출원인의 의견서/보정서(Response)를 EPO에 제출하는 단계', 70, 'RESPONSE', 'EP'),
    ('OA_ISSUED', 'OA 통지', '심사관이 거절이유를 담은 의견제출통지서(Office Action)를 발송한 상태', 80, 'RESPONSE', NULL),
    ('OA_RESPONSE', 'OA 대응', '거절이유 해소를 위해 특허청에 의견서 및 보정서를 작성·제출하는 단계', 90, 'RESPONSE', NULL),
    ('ALLOWANCE', '등록 결정', '심사관이 거절이유가 없음을 확인하고 특허 등록 결정을 내린 상태', 100, 'REG', NULL),
    ('REGISTERED', '등록', '등록 설정 등록료를 납부하여 특허권이 정식 발효된 상태', 110, 'REG', NULL),
    ('EXPIRED', '만료', '존속기간(출원일로부터 보통 20년)이 다하여 권리가 자연 소멸한 상태', 120, 'CLOSED', NULL),
    ('CLOSED', '종결', '거절확정, 포기, 무효, 연차료 미납 등으로 관리가 완전 종료된 상태', 130, 'CLOSED', NULL),
    ('OPT_OUT', 'OPT-OUT', '유럽통합특허법원(UPC) 관할에서 제외하고 각 개별국 법원 관할을 유지하도록 신청하는 단계', 140, 'ETC', 'EP');

CREATE INDEX "patent_stage_group_code_idx" ON "patent_stage"("group_code");

ALTER TABLE "patent_stage"
ADD CONSTRAINT "patent_stage_group_code_fkey"
FOREIGN KEY ("group_code") REFERENCES "patent_stage_group"("code")
ON DELETE RESTRICT ON UPDATE CASCADE;

-- 운영 시트의 "현재 Status"(legal_status)를 진행 단계에 연결한다. 값이 자유 서술이라
-- 매핑은 사람이 채우고, 비어 있는 코드는 쿼리로 바로 찾을 수 있게 NULL로 남긴다.
ALTER TABLE "legal_status" ADD COLUMN "stage_code" TEXT;

CREATE INDEX "legal_status_stage_code_idx" ON "legal_status"("stage_code");

ALTER TABLE "legal_status"
ADD CONSTRAINT "legal_status_stage_code_fkey"
FOREIGN KEY ("stage_code") REFERENCES "patent_stage"("code")
ON DELETE SET NULL ON UPDATE CASCADE;
