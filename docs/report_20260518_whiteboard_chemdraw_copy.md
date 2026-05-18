# MyBoard Whiteboard ChemDraw Copy

## 작업 범위
- `WhiteboardEditor`에서 ChemDraw 버튼으로 추가한 구조 SVG 객체에 원본 화학 데이터를 함께 저장하도록 변경했습니다.
- 캔버스에서 구조 객체를 선택하면 `Copy` 버튼과 `Cmd/Ctrl+C`로 다른 ChemDraw JS 에디터에서 사용할 수 있는 구조 텍스트를 복사할 수 있게 했습니다.
- `ChemDrawModal`은 기존 `SMILES`, `SVG` 외에 `CDXML`, `MOLFILE`, `MOLV2000`, `MOLV3000` 추출을 시도합니다.
- `ChemDrawModal` 초기 로드 입력에 `initialCdxml`을 추가해 다른 ChemDraw JS 에디터 구현에서 CDXML 로드가 가능하도록 했습니다.

## 복사 우선순위
1. `CDXML`
2. `MOLV2000`
3. `MOLFILE`
4. `MOLV3000`
5. `SMILES`

## 구현 메모
- 현재 포함된 ChemDraw JS 번들은 `getData()` 외에도 `getCDXML()`, `getMOL(callback)`, `getMOLV3000(callback)`, `getSMILES(callback)`, `getSVG()` 전용 API를 노출하므로, 구조 데이터 추출 fallback에 이 API들을 사용합니다.
- Clipboard API는 `chemical/x-cdxml`, `chemical/x-mdl-molfile` 같은 커스텀 MIME 쓰기를 브라우저별로 제한하므로, 복사는 `text/plain`으로만 수행합니다.
- 외부 도메인의 ChemDraw JS 에디터는 클립보드 텍스트를 읽어 `setData(DataFormats.CDXML, text)` 또는 `setData(DataFormats.MOLV2000, text)`로 로드하는 방식으로 연동할 수 있습니다.
- Ant Design 메시지는 정적 `message` 함수 대신 `App.useApp()` 컨텍스트 메시지를 사용합니다.
- ChemDraw SVG가 큰 흰 배경 객체를 포함하면 캔버스에서 다른 객체 선택을 방해할 수 있어, SVG 로드 시 배경 객체를 제거하고 실제 구조 도형 기준으로 Fabric 그룹을 생성합니다. `perPixelTargetFind`는 브라우저 `getImageData` 경고를 유발해 사용하지 않습니다.
- 다크 모드에서는 검색 SVG와 ChemDraw 구조 SVG 로드 시 검정 계열 `stroke/fill`을 테마 텍스트 색상으로 치환해 어두운 캔버스에서도 구조 선과 라벨이 보이도록 했습니다.
- ChemDraw JS 내부 canvas에서 반복적인 `getImageData()` 호출로 발생하는 Chrome `willReadFrequently` 성능 경고를 줄이기 위해, ChemDraw 모달이 열려 있는 동안 생성되는 2D canvas context에 `willReadFrequently: true`를 기본 적용합니다.
- 캔버스 붙여넣기에서 `CDXML`, `MOL V2000/V3000`, 보수적으로 감지한 `SMILES`는 긴 텍스트 객체로 만들지 않고 ChemDraw 모달에 먼저 로드합니다. 사용자가 ChemDraw 캔버스에서 구조를 확인/수정한 뒤 `캔버스에 추가` 버튼을 눌러야 부모 whiteboard 캔버스에 추가됩니다.
- ChemDraw 모달이 열려 있는 동안에는 whiteboard 전역 paste 핸들러가 동작하지 않도록 해, ChemDraw 에디터 자체 paste 동작을 방해하지 않습니다.
- 구조 데이터가 아닌 5000자 초과 일반 텍스트는 Fabric 텍스트 객체 생성으로 인한 멈춤을 피하기 위해 붙여넣지 않습니다.
- 이미지 삽입 버튼은 파일 선택창을 열고, 선택한 이미지 파일을 data URL로 읽어 현재 whiteboard viewport 중앙에 추가합니다. 클립보드 이미지 붙여넣기도 같은 이미지 추가 로직을 사용합니다.
- 캔버스 객체 선택 후 `Delete` 또는 `Backspace`를 누르거나 toolbar의 선택 삭제 버튼을 클릭하면 공통 삭제 확인 모달을 띄우고, 확인 시 선택 객체를 삭제합니다.
- toolbar의 전체 삭제 버튼도 같은 삭제 확인 모달 흐름을 사용하며, 확인 시 캔버스의 모든 객체를 삭제합니다.
- 선택 모드와 이동 모드는 실제 canvas 동작 차이가 없어 toolbar에서 제거했습니다. 객체 선택과 이동은 Fabric canvas 기본 interaction으로 유지됩니다.

## 제한 사항
- 브라우저 보안 정책상 다른 도메인 에디터가 클립보드를 자동으로 읽을 수는 없습니다. 사용자 paste 동작 또는 명시적인 불러오기 버튼이 필요합니다.
- 데스크톱 ChemDraw native paste 호환성은 브라우저/앱 버전에 따라 다르므로 별도 실기기 테스트가 필요합니다.
