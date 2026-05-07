# PatentAnalysisDetail.tsx에 DataCardItem 적용 가이드

## 🔧 적용 방법

### 1단계: Import 추가

`PatentAnalysisDetail.tsx` 최상단의 import 섹션에 다음을 추가:

```tsx
// 기존 import들...
import PageHeaderBreadcrumb from '../components/common/PageHeaderBreadcrumb';

// 👇 새로 추가할 부분
import { CompoundCard } from '../components/patent-analysis/CompoundCard';
import { ResultTableCard } from '../components/patent-analysis/ResultTableCard';
import DataCardItem from '../components/patent-analysis/DataCardItem';
```

---

## 2단계: Raw Data 탭 리팩토링

### 📍 변경 위치: ~1200-1280 줄

**Before (기존 코드):**
```tsx
rawDataView === 'table' ? (
  // ... Table 로직
) : (
  <Row gutter={[16, 16]}>
    {((patentResultRaw as any)?.result?.patent_compound ?? []).map((comp: any) => {
      const compKey = String(comp.id);
      const pageArr: number[] = Array.isArray(comp.page) ? comp.page : [];
      const bboxArr: any[] = Array.isArray(comp.bbox) ? comp.bbox : [];
      const curIdx = pageIndices[compKey] ?? 0;
      const rEntries = Object.entries(comp.r_groups ?? {}) as [string, string][];
      return (
        <Col span={24} md={12} lg={8} key={comp.id}>
          <Card size="small" hoverable style={{
            height: '100%',
            border: activeCompId === compKey ? '2px solid red' : undefined
          }}>
            {/* 120줄 이상의 카드 렌더링 코드... */}
          </Card>
        </Col>
      );
    })}
  </Row>
)
```

**After (리팩토링된 코드):**
```tsx
rawDataView === 'table' ? (
  // ... Table 로직 (변경 없음)
) : (
  <Row gutter={[16, 16]}>
    {((patentResultRaw as any)?.result?.patent_compound ?? []).map((comp: any) => (
      <Col span={24} md={12} lg={8} key={comp.id}>
        <CompoundCard
          compound={comp}
          pageIndices={pageIndices}
          activeCompId={activeCompId}
          onCardClick={(c) => {
            setActiveCompId(String(c.id));
            const pageArr = Array.isArray(c.page) ? c.page : [];
            const bboxArr = Array.isArray(c.bbox) ? c.bbox : [];
            if (pageArr.length > 0) {
              handleGoToPdf(pageArr[0], bboxArr[0]);
            }
          }}
          onPreview={(svg, title) => openSvgPreview(svg, title)}
          onPageChange={(compId, direction) => handlePageChange(compId, direction, 
            Array.isArray(comp.page) ? comp.page : [],
            Array.isArray(comp.bbox) ? comp.bbox : []
          )}
        />
      </Col>
    ))}
  </Row>
)
```

---

## 3단계: Summary 탭 리팩토링 (Horizontal Scroll)

### 📍 변경 위치: ~960-1000 줄

**Before:**
```tsx
<div style={{ display: 'flex', overflowX: 'auto', gap: 16, paddingBottom: 8 }}>
  {((patentResultRaw as any)?.result?.patent_compound ?? []).slice(0, 10).map((comp: any) => {
    const compKey = String(comp.id);
    const pageArr: number[] = Array.isArray(comp.page) ? comp.page : [];
    const bboxArr: any[] = Array.isArray(comp.bbox) ? comp.bbox : [];
    return (
      <Card key={comp.id} size="small" style={{ 
        minWidth: 220, 
        flexShrink: 0, 
        position: 'relative',
        cursor: 'pointer',
        border: activeCompId === compKey ? '2px solid red' : undefined
      }} onClick={() => handleCompoundCardClick(comp, comp.ranking)}>
        {/* 복잡한 카드 렌더링 코드 */}
      </Card>
    );
  })}
</div>
```

**After:**
```tsx
<div style={{ display: 'flex', overflowX: 'auto', gap: 16, paddingBottom: 8 }}>
  {((patentResultRaw as any)?.result?.patent_compound ?? []).slice(0, 10).map((comp: any) => (
    <div key={comp.id} style={{ minWidth: 220, flexShrink: 0 }}>
      <CompoundCard
        compound={comp}
        pageIndices={pageIndices}
        activeCompId={activeCompId}
        onCardClick={(c) => handleCompoundCardClick(c, c.ranking)}
        onPreview={(svg, title) => openSvgPreview(svg, title)}
        onPageChange={(compId, direction) => 
          handlePageChange(compId, direction, 
            Array.isArray(comp.page) ? comp.page : [],
            Array.isArray(comp.bbox) ? comp.bbox : []
          )
        }
      />
    </div>
  ))}
</div>
```

---

## 4단계: Tables 탭 리팩토링

### 📍 변경 위치: ~1300-1380 줄

**Before:**
```tsx
<Row gutter={[16, 16]}>
  {resultTables.map((tableItem: any, i: number) => {
    const base64List = Array.isArray(tableItem?.table_base64) ? tableItem.table_base64 : [];
    const firstImage = typeof base64List[0] === 'string'
        ? (base64List[0].startsWith('data:') ? base64List[0] : `data:image/png;base64,${base64List[0]}`)
        : null;
    const pageArray = Array.isArray(tableItem?.page) ? tableItem.page : [];
    const bboxArray = Array.isArray(tableItem?.bbox) ? tableItem.bbox : [];
    const cardKey = `table-${tableItem?.table_num ?? i}-${i}`;
    const tableCurrentIndex = pageIndices[cardKey] ?? 0;

    return (
      <Col span={24} md={12} lg={8} key={`table-${tableItem?.table_num ?? i}-${i}`}>
        <Card size="small" hoverable style={{ height: '100%', ... }}>
          {/* 복잡한 카드 렌더링 코드 */}
        </Card>
      </Col>
    );
  })}
</Row>
```

**After:**
```tsx
<Row gutter={[16, 16]}>
  {resultTables.map((tableItem: any, i: number) => {
    const cardKey = `table-${tableItem?.table_num ?? i}-${i}`;
    return (
      <Col span={24} md={12} lg={8} key={cardKey}>
        <ResultTableCard
          tableItem={tableItem}
          pageIndices={pageIndices}
          tableKey={cardKey}
          activeCompId={activeCompId}
          onCardClick={() => handleTableCardClick(tableItem, i)}
          onPreview={(image, title) => openImagePreview(image, title)}
          onPageChange={(key, direction) => handleTablePageChange(tableItem, i, direction)}
        />
      </Col>
    );
  })}
</Row>
```

---

## 📊 변경 효과

| 항목 | Before | After |
|------|--------|-------|
| Raw Data 카드 코드 | ~80줄 | ~20줄 |
| Tables 탭 카드 코드 | ~90줄 | ~20줄 |
| 총 감소 줄 수 | - | ~130줄 |
| 중복 제거율 | 높음 | 낮음 |

---

## ✅ 적용 체크리스트

- [ ] `DataCardItem.tsx` 생성
- [ ] `CompoundCard.tsx` 생성
- [ ] `ResultTableCard.tsx` 생성
- [ ] PatentAnalysisDetail.tsx import 추가
- [ ] Raw Data 탭 카드 뷰 리팩토링
- [ ] Summary 탭 카드 뷰 리팩토링
- [ ] Tables 탭 카드 뷰 리팩토링
- [ ] 테스트: 모든 탭에서 카드 렌더링 확인
- [ ] 테스트: 클릭, 미리보기, 페이지 네비게이션 동작 확인
- [ ] 테스트: 액티브 상태 표시 확인

---

## 🔗 참조

- 분석 문서: `/docs/card_view_refactoring_analysis.md`
- DataCardItem Props: `DataCardItem.tsx` 주석 참조
- 기존 PatentAnalysisDetail: line 950-1380

