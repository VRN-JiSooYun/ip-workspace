---
trigger: always_on
---

# Agent Instructions
- 로컬환경에서는 npm, bun등 install이나 build 하지 않습니다.
- 모든 실행 작업은 docker container 안에서 합니다.
- 라이브러리/프레임워크 관련 질의는 답변 전에 Context7 MCP 문서를 먼저 조회합니다.
- sequential thinking MCP를 사용해서 답변을 구성합니다.
- antigravity에서 만드는 모든 관리 문서는 docs에 저장합니다.
- 모든 문서는 '한국어'로 작성합니다.
- node, python, python3 빌드 환경은 로컬에서 실해하지말고 docker를 통해 실행합니다.
- UI/UX 페이지 디자인 할때는 frontend 전체적인 통일성을 유지합니다.
- compound_search/, rdkit/은 수정하지마.