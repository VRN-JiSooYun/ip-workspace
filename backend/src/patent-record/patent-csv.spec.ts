import {
  PATENT_CSV_COLUMNS,
  buildPatentExportCsv,
  buildTemplateCsv,
  parseCsv,
  parseCsvDate,
  resolveHeaderField,
} from "./patent-csv";

describe("parseCsvDate", () => {
  const iso = (value: string) => parseCsvDate(value)?.toISOString().slice(0, 10);

  it("시트에서 실제로 나오는 표기를 모두 읽는다", () => {
    expect(iso("2024-09-30")).toBe("2024-09-30");
    expect(iso("2024.09.30")).toBe("2024-09-30");
    expect(iso("2024/09/30")).toBe("2024-09-30");
    expect(iso("20240930")).toBe("2024-09-30");
    // Sheets 한국 로캘: 구분자 뒤 공백과 끝 마침표가 붙는다.
    expect(iso("2024. 9. 30")).toBe("2024-09-30");
    expect(iso("2024. 9. 30.")).toBe("2024-09-30");
  });

  it("빈 값은 null, 날짜가 아니면 null을 준다", () => {
    // null이면 호출 쪽이 행 오류로 만든다. 문자열이 그대로 흘러가면 DateTime
    // 컬럼에 들어가면서 500이 된다.
    expect(parseCsvDate("")).toBeNull();
    expect(parseCsvDate("   ")).toBeNull();
    expect(parseCsvDate("미정")).toBeNull();
    expect(parseCsvDate("2024-13-01")).toBeNull();
  });
});

/**
 * PATENT_CSV_COLUMNS는 템플릿 생성과 import 헤더 인식을 동시에 담당한다.
 * 컬럼을 손볼 때 조용히 깨지기 쉬운 지점들을 여기서 잡는다.
 */
describe("patent CSV columns", () => {
  const normalize = (value: string) => value.replace(/\s+/g, "").toLowerCase();

  it("서로 다른 필드가 같은 헤더 표기를 쓰지 않는다", () => {
    // 겹치면 HEADER_LOOKUP에서 뒤 컬럼이 앞 컬럼을 덮어써 한쪽이 통째로 무시된다.
    const owner = new Map<string, string>();
    const collisions: string[] = [];

    for (const column of PATENT_CSV_COLUMNS) {
      for (const key of [column.header, ...column.aliases]) {
        const normalized = normalize(key);
        const previous = owner.get(normalized);
        if (previous && previous !== column.field) {
          collisions.push(`${key}: ${previous} vs ${column.field}`);
        } else {
          owner.set(normalized, column.field);
        }
      }
    }

    expect(collisions).toEqual([]);
  });

  it("템플릿이 선언 순서 그대로 나온다", () => {
    const [headerRow] = parseCsv(buildTemplateCsv());
    expect(headerRow).toEqual(PATENT_CSV_COLUMNS.map((column) => column.header));
  });

  it("템플릿 앞부분이 IP팀 운영 시트의 컬럼 순서를 따른다", () => {
    expect(PATENT_CSV_COLUMNS.slice(0, 23).map((column) => column.header)).toEqual([
      "Our Ref.",
      "Target",
      "대리인",
      "출원번호",
      "출원일",
      "출원국",
      "발명의 명칭",
      "출원인",
      "발명자",
      "현재 Status",
      "Status 설명",
      "To-do 마감일",
      "관계(분할/계속)",
      "관련특허",
      "공개일",
      "공개번호",
      "등록번호",
      "등록일",
      "실시권 계약",
      "기타",
      "권리관계 변경",
      "지분약정(지분율변경) 기존 출원인",
      "(예상) 만료일",
    ]);
  });

  it("시트에서 줄바꿈이 들어간 헤더도 그대로 인식한다", () => {
    // Sheets에서 복사하면 헤더 안에 개행이 남는다. 정규화가 공백을 지우므로 통과해야 한다.
    expect(resolveHeaderField("To-do \n마감일")).toBe("todoDueDate");
    expect(resolveHeaderField("관계\n(분할/계속)")).toBe("relationType");
    expect(resolveHeaderField("지분약정\n(지분율변경)\n기존 출원인")).toBe(
      "shareAgreement",
    );
    expect(resolveHeaderField("(예상)\n만료일")).toBe("expectedExpiryDate");
  });

  it("헤더 이름을 바꾸기 전에 받아 둔 CSV도 계속 읽힌다", () => {
    expect(resolveHeaderField("내부관리번호")).toBe("internalRef");
    expect(resolveHeaderField("국가")).toBe("country");
    expect(resolveHeaderField("국문명칭")).toBe("koreanTitle");
    expect(resolveHeaderField("원출원번호")).toBe("parentApplicationNumber");
    expect(resolveHeaderField("법적상태")).toBe("legalStatus");
  });

  it("시트 헤더가 의도한 필드로 간다", () => {
    expect(resolveHeaderField("Our Ref.")).toBe("internalRef");
    expect(resolveHeaderField("출원국")).toBe("country");
    expect(resolveHeaderField("발명의 명칭")).toBe("koreanTitle");
    expect(resolveHeaderField("현재 Status")).toBe("legalStatus");
    expect(resolveHeaderField("관련특허")).toBe("parentApplicationNumber");
  });

  it("쉼표가 든 헤더가 생겨도 템플릿이 깨지지 않는다", () => {
    const [headerRow] = parseCsv(buildTemplateCsv());
    expect(headerRow).toHaveLength(PATENT_CSV_COLUMNS.length);
  });
});

describe("buildPatentExportCsv", () => {
  it("업로드 템플릿 순서로 날짜·관계명·긴 문장을 내보낸다", () => {
    const csv = buildPatentExportCsv([{
      internalRef: "A26W001",
      target: "EGFR",
      attorneyNumber: 12,
      applicationNumber: "10-2026-0000001",
      applicationDate: new Date("2026-09-03T00:00:00.000Z"),
      koreanTitle: "쉼표, 포함 명칭",
      englishTitle: null,
      applicant: "VRN",
      inventorLinks: [
        { ordinal: 0, inventor: { inventor: "홍길동" } },
        { ordinal: 1, inventor: { inventor: "김보로" } },
      ],
      todoDueDate: null,
      relationType: null,
      parentApplicationNumber: null,
      publicationDate: null,
      publicationNumber: null,
      registrationNumber: null,
      registrationDate: null,
      licenseAgreement: null,
      note: "<p>첫 줄</p><p>둘째 줄</p>",
      rightsChange: null,
      shareAgreement: null,
      expectedExpiryDate: null,
      intApplicationNumber: null,
      intApplicationDate: null,
      intPublicationNumber: null,
      intPublicationDate: null,
      exam: true,
      examDate: null,
      country: { country: "KR" },
      attorney: { attorneyName: "가나다 특허법인" },
      legalStatus: { status: "출원" },
      examStatus: { status: "심사 중" },
    }]);

    const [headers, values] = parseCsv(csv);
    const byHeader = new Map(headers.map((header, index) => [header, values[index]]));
    expect(byHeader.get("Our Ref.")).toBe("A26W001");
    expect(byHeader.get("출원일")).toBe("2026-09-03");
    expect(byHeader.get("발명의 명칭")).toBe("쉼표, 포함 명칭");
    expect(byHeader.get("발명자")).toBe("홍길동, 김보로");
    expect(byHeader.get("기타")).toBe("첫 줄 둘째 줄");
    expect(byHeader.get("심사청구")).toBe("청구");
  });
});
