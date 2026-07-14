# 작업 보고서

완료된 구현과 검증 결과를 연/월 단위로 보관한다.

## 경로

```text
reports/YYYY/MM/report_YYYYMMDD_<topic>.md
```

요일별·일자별 하위 폴더는 만들지 않는다. 날짜는 파일명으로 정렬하고, 기능명은 `<topic>`으로 검색한다.

```bash
rg -n "검색어" docs/reports
rg --files docs/reports/2026/07 | sort
```
