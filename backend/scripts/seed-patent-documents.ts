/**
 * 관리 특허에 붙는 문서(통지서·제출 서류) 목업 데이터.
 *
 * Why this exists
 * ---------------
 * `admin` / `office_action` / `response` 테이블은 ERD에도 Prisma schema에도 이미 있지만
 * 아직 채워 주는 경로가 없다(IP팀 운영 데이터가 들어오기 전이다). 그래서 특허 관리 화면의
 * 문서 뷰어를 만들거나 손볼 때 붙잡고 볼 데이터가 없다.
 *
 * 이 스크립트는 화면 작업용 표본을 넣는다. 조회는 실제 경로
 * (`GET /api/patent-records/:id/documents` → patent → admin → office_action → response)를
 * 그대로 타므로, 나중에 진짜 데이터가 들어오면 이 seed만 지우면 된다.
 *
 * 주의
 * ----
 * - 운영 DB에서 돌리지 말 것. `--force` 없이는 NODE_ENV=production에서 멈춘다.
 * - `--clear`는 이 스크립트가 넣은 표시(actionNumber prefix)가 붙은 행만 지운다.
 *   사람이 넣은 행은 건드리지 않는다.
 * - document_path는 실재하지 않는 예시 URL이다. '문서 전문'(PDF) 탭을 열면 PDF pane이
 *   `Failed to fetch`를 그대로 보여 준다(뷰어가 본문 탭으로 되돌려 주지는 않는다).
 *   파일명·'새 창' 버튼·탭 배선까지는 확인되고, 실제 문서 경로가 들어오면 그대로 렌더된다.
 *   PDF까지 눈으로 보려면 접근 가능한 URL로 바꿔서 넣을 것.
 *
 * Usage (from backend/):
 *   bun run scripts/seed-patent-documents.ts             # 적용
 *   bun run scripts/seed-patent-documents.ts --dry-run   # 무엇이 들어갈지만 출력
 *   bun run scripts/seed-patent-documents.ts --clear     # seed가 넣은 것만 제거
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

/** 이 스크립트가 만든 행임을 알아보기 위한 표시. --clear가 이걸로 찾는다. */
const SEED_TAG = "SEED";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const clear = args.includes("--clear");
const force = args.includes("--force");

/** 통지서 본문 표본. 외부 API가 주는 평문 형태(머리글 + 【항목】)를 흉내 낸다. */
const officeActionBody = (applicationNumber: string, date: string) => `# 의견제출통지서

【출원번호】 ${applicationNumber}
【통지일자】 ${date}

【거절이유】
이 출원의 청구항 1 내지 5에 기재된 발명은 그 출원 전에 국내에서 반포된 간행물에
게재된 발명(인용발명 1)에 의하여 통상의 기술자가 쉽게 발명할 수 있는 것이므로
특허법 제29조 제2항의 규정에 의하여 특허를 받을 수 없습니다.

【인용발명】
1. 한국공개특허 제10-2019-0123456호

【의견제출기한】
이 통지서를 받은 날부터 2개월 이내에 의견서를 제출하시기 바랍니다.
`;

const responseBody = (applicationNumber: string) => `# 의견서

【출원번호】 ${applicationNumber}

【의견의 요지】
인용발명 1은 화합물의 치환기 R1에 대하여 아무런 개시나 시사를 하고 있지 않습니다.
본원 발명은 해당 위치에 특정 헤테로아릴기를 도입함으로써 인용발명 대비 현저한
대사 안정성 개선 효과를 나타내며, 이는 명세서 실시예 3의 데이터로 뒷받침됩니다.

【결론】
따라서 본원 발명은 진보성이 인정되어야 할 것입니다.
`;

/** 뷰어 '정보' 탭의 심사관 칸을 채우기 위한 표본. 이름은 가상이다. */
const EXAMINERS = [
  { office: "특허청", bureau: "화학생명기술심사국", department: "약품화학심사과", name: "김심사" },
  { office: "특허청", bureau: "화학생명기술심사국", department: "정밀화학심사과", name: "이심사" },
];

/** 거절이유가 가리키는 조문. 실제로 자주 쓰이는 조합만 넣는다. */
const STATUTES = [
  { lawType: 1, article: 29, paragraph: 2, subParagraph: null }, // 진보성
  { lawType: 1, article: 29, paragraph: 1, subParagraph: 2 }, // 신규성
  { lawType: 1, article: 42, paragraph: 4, subParagraph: 2 }, // 기재불비
];

/** 특허 한 건에 붙일 문서 묶음. 상태에 따라 개수를 달리해 목록이 단조롭지 않게 한다. */
const PLANS = [
  { action: "의견제출통지서", withResponse: true, responseType: 1 },
  { action: "의견제출통지서", withResponse: false, responseType: null },
  { action: "등록결정서", withResponse: false, responseType: null },
];

const main = async () => {
  if (process.env.NODE_ENV === "production" && !force) {
    throw new Error("운영 환경에서는 --force 없이 실행하지 않는다.");
  }

  if (clear) {
    // admin을 지우면 office_action·response가 onDelete: Cascade로 함께 지워진다.
    const target = { actionNumber: { startsWith: `${SEED_TAG}-` } };
    const found = await prisma.patentAdmin.count({ where: target });
    if (dryRun) {
      console.log(`[dry-run] seed가 넣은 admin ${found}건과 그 하위 문서를 지운다.`);
      return;
    }
    const { count } = await prisma.patentAdmin.deleteMany({ where: target });
    console.log(`seed admin ${count}건 제거(하위 office_action·response 포함).`);
    return;
  }

  const patents = await prisma.patent.findMany({
    select: { id: true, applicationNumber: true, internalRef: true },
    orderBy: { id: "asc" },
  });
  if (patents.length === 0) {
    console.log("patent 테이블이 비어 있다. 특허를 먼저 넣어야 문서를 붙일 수 있다.");
    return;
  }

  const existing = await prisma.patentAdmin.count({
    where: { actionNumber: { startsWith: `${SEED_TAG}-` } },
  });
  if (existing > 0) {
    console.log(`이미 seed된 admin이 ${existing}건 있다. --clear 후 다시 실행할 것.`);
    return;
  }

  // 심사관·조문은 공용 코드성 데이터다. 이미 있으면 그대로 쓴다.
  const examinerIds: number[] = [];
  for (const examiner of EXAMINERS) {
    const found = await prisma.examiner.findFirst({ where: { name: examiner.name } });
    examinerIds.push(found?.id ?? (await prisma.examiner.create({ data: examiner })).id);
  }
  const statuteIds: number[] = [];
  for (const statute of STATUTES) {
    const found = await prisma.legalStatute.findFirst({ where: statute });
    statuteIds.push(found?.id ?? (await prisma.legalStatute.create({ data: statute })).id);
  }

  let planned = 0;
  for (const [index, patent] of patents.entries()) {
    // 특허마다 0~3건. 일부는 문서가 없어야 '문서 없음' 상태도 화면에서 확인할 수 있다.
    const count = index % 4;
    for (let n = 0; n < count; n += 1) {
      const plan = PLANS[n % PLANS.length];
      const actionDate = new Date(Date.UTC(2025, 3 + n * 2, 14));
      const dateText = actionDate.toISOString().slice(0, 10);
      const actionNumber = `${SEED_TAG}-${patent.id}-${n + 1}`;
      planned += 1;

      if (dryRun) {
        console.log(
          `[dry-run] ${patent.internalRef ?? patent.applicationNumber}: ` +
            `${plan.action} (${dateText})${plan.withResponse ? " + 의견서" : ""}`,
        );
        continue;
      }

      await prisma.patentAdmin.create({
        data: {
          patentId: patent.id,
          actionDate,
          action: plan.action,
          actionNumber,
          officeActions: {
            create: {
              content: officeActionBody(patent.applicationNumber, dateText),
              documentPath: `https://example.invalid/oa/${patent.applicationNumber}_${plan.action}_${dateText}.pdf`,
              // 통지서에는 심사관 1명과 거절이유 1~2건을 붙인다(뷰어 '정보' 탭 확인용).
              oaExaminers: {
                create: [{ examinerId: examinerIds[n % examinerIds.length] }],
              },
              rejections: {
                create: [
                  { claim: "1-5", statuteId: statuteIds[n % statuteIds.length] },
                  ...(plan.withResponse
                    ? [{ claim: "6", statuteId: statuteIds[(n + 1) % statuteIds.length] }]
                    : []),
                ],
              },
              ...(plan.withResponse
                ? {
                    responses: {
                      create: {
                        type: plan.responseType,
                        content: responseBody(patent.applicationNumber),
                        documentPath: `https://example.invalid/res/${patent.applicationNumber}_의견서_${dateText}.pdf`,
                      },
                    },
                  }
                : {}),
            },
          },
        },
      });
    }
  }

  console.log(
    dryRun
      ? `[dry-run] 특허 ${patents.length}건에 admin ${planned}건을 넣을 예정.`
      : `특허 ${patents.length}건에 admin ${planned}건과 하위 문서를 넣었다.`,
  );
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
