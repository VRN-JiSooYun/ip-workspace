# Card View 공통 컴포넌트 리팩토링 분석

## 📋 현황 분석

### 1. 카드 뷰가 사용되는 위치

`PatentAnalysisDetail.tsx`의 **3개 탭**에서 카드 뷰가 반복됩니다:

#### **Raw Data 탭** (lines 1200-1280)
```tsx
<Row gutter={[16, 16]}>
  {compounds.map(comp => (
    <Col span={24} md={12} lg={8}>
      <Card size="small" hoverable>
        {/* 구조 이미지 */}
        {/* 페이지 네비게이션 */}
        {/* R Groups 태그 */}
        {/* SMILES */}
      </Card>
    </Col>
  ))}
</Row>
```

#### **Summary 탭** (lines 960-1000)
```tsx
<div style={{ display: 'flex', overflowX: 'auto', gap: 16 }}>
  {compounds.slice(0, 10).map(comp => (
    <Card key={comp.id} size="small">
      {/* 구조 이미지 */}
      {/* 페이지 네비게이션 */}
    </Card>
  ))}
</div>
```

#### **Tables 탭** (lines 1300-1380)
```tsx
<Row gutter={[16, 16]}>
  {resultTables.map(table => (
    <Col span={24} md={12} lg={8}>
      <Card size="small" hoverable>
        {/* 테이블 이미지 */}
        {/* 페이지 정보 */}
        {/* 페이지 네비게이션 */}
      </Card>
    </Col>
  ))}
</Row>
```

---

## 🎯 공통 컴포넌트화 가능한 부분

### **공통점:**
1. **구조**: Card 내부에 일관된 레이아웃
   - 헤더 영역 (메타데이터, 태그)
   - 이미지/SVG 렌더링 영역
   - 푸터 영역 (페이지 네비게이션, 추가 정보)

2. **상호작용**:
   - 클릭 시 PDF/이미지 미리보기 표시
   - 페이지 네비게이션 (이전/다음)
   - 액티브 상태 표시 (선택된 카드 강조)

3. **메타데이터**:
   - 태그 (색상 코드, 상태)
   - 텍스트 정보
   - 페이지 정보

### **차이점:**

| 항목 | Raw Data | Summary | Tables |
|------|----------|---------|--------|
| 레이아웃 | Grid (Col span) | Horizontal Scroll | Grid (Col span) |
| 이미지 종류 | SVG (compound_svg) | SVG (compound_svg) | Base64 PNG (table_base64) |
| 헤더 데이터 | compound_id, ranking | ranking, key icon | table_group, has_compound |
| 추가 정보 | R Groups 태그 | 없음 | 이미지 수, 페이지 배열 |
| 높이 | 130px | 150px | 150px |

---

## 💡 리팩토링 전략

### **Option A: 범용 CardItem 컴포넌트 (권장)**

#### 장점:
- ✅ 최소 코드 중복 제거
- ✅ 각 탭의 고유 데이터 구조 유지
- ✅ 유연한 커스터마이징

#### 구현 구조:
```
src/components/
├── common/
│   └── DataCardItem.tsx          // 공통 카드 컴포넌트
└── patent-analysis/
    └── RawDataCard.tsx           // Raw Data 전용 래퍼
    └── SummaryCard.tsx           // Summary 전용 래퍼
    └── ResultTableCard.tsx       // Tables 전용 래퍼
```

---

### **Option B: 고급 제네릭 컴포넌트**

#### 장점:
- ✅ 최고 수준의 재사용성
- ✅ 향후 새로운 카드 타입 추가 용이

#### 단점:
- ❌ Props 인터페이스 복잡
- ❌ TypeScript 제네릭 학습 필요

---

## 🛠 추천 구현 계획

### **1단계: DataCardItem 컴포넌트 생성**

```tsx
// src/components/patent-analysis/DataCardItem.tsx

interface DataCardItemProps {
  // 헤더
  header?: React.ReactNode;
  tags?: Array<{ label: string; color?: string }>;
  icon?: React.ReactNode;
  
  // 콘텐츠
  imageUrl: string;
  imageType: 'svg' | 'base64';
  onImageClick?: () => void;
  
  // 푸터
  footer?: React.ReactNode;
  navigation?: {
    currentPage: number;
    totalPages: number;
    onPrev: () => void;
    onNext: () => void;
  };
  
  // 상태
  isActive?: boolean;
  onClick?: () => void;
}
```

### **2단계: 각 탭별 맞춤 래퍼 생성**

```tsx
// 예: Raw Data용
const RawDataCompoundCard: React.FC<{ compound: any; ... }> = ({ compound }) => {
  return (
    <DataCardItem
      header={<Text strong>{compound.compound_id}</Text>}
      tags={[...]}
      imageUrl={compound.compound_svg}
      imageType="svg"
      footer={
        <div>{compound.r_groups && ...}</div>
      }
      navigation={{...}}
    />
  );
};
```

### **3단계: PatentAnalysisDetail.tsx 리팩토링**

각 탭의 반복 코드를 간결하게 정리.

---

## 📊 예상 효과

| 지표 | 현재 | 리팩토링 후 |
|------|------|-----------|
| Card 렌더링 코드 | ~120줄 | ~30줄 |
| 로직 중복도 | 높음 | 낮음 |
| 수정 영향도 | 3곳 | 1곳 (컴포넌트) |
| 테스트 용이성 | 낮음 | 높음 |

---

## 🎬 다음 단계

1. **DataCardItem 컴포넌트 생성** 
2. **각 탭별 맞춤 래퍼 생성**
3. **PatentAnalysisDetail에 적용 및 테스트**
4. **추가 카드 뷰 필요 시 재사용**

---

## 📝 구현 시 주의사항

- SVG와 이미지 렌더링 로직 통일
- 페이지 인덱스 상태 관리 방식
- 액티브 상태 스타일 일관성
- 성능: 대량 카드 렌더링 시 가상화 고려

