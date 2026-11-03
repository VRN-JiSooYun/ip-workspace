# Groupware 로그인 진입점 `GET /api/auth/login`

## 작업 목적

Groupware가 사용자를 `user_id`와 `login_token` 쿼리 파라미터가 달린 주소로 직접 보내면,
서버가 그 자리에서 Token을 검증하고 세션 쿠키를 발급한 뒤 앱으로 redirect한다.
vora(`vrn-vora-back/auth/voraPlugin.ts`)의 `/login`과 같은 방식이다.

기존 `AuthGate`의 `?id=&token=` 자동 로그인은 브라우저 JS가 URL에서 Token을 읽어 `exchange`를
호출하는 구조였다. 새 진입점은 Token이 JS와 주소창을 거치지 않는다.

## 호출 방법

```
GET /ip-workspace/api/auth/login?user_id=<email>&login_token=<token>[&next=<앱 경로>]
```

| 파라미터 | 필수 | 설명 |
|---|---|---|
| `user_id` | O | Groupware 사용자 email. 서버가 Token으로 확인한 email과 대조한다. |
| `login_token` | O | Groupware login Token (base64). |
| `next` | X | 로그인 뒤 이동할 앱 경로. 허용되지 않으면 앱 첫 화면. |

- 성공: 세션 쿠키를 내리고 `next`(없으면 앱 첫 화면 `APP_BASE_PATH`)로 302.
- 실패(파라미터 누락, Token 무효, `user_id` 불일치, 비활성 사용자, 알림 수신자 미연결 등):
  앱 첫 화면으로 302. 원인은 URL로 알리지 않는다. 앱의 `AuthGate`가 세션이 없음을 보고
  "Groupware 인증 확인" 화면을 띄운다. 원인은 서버 로그와 `auth_audit_log`에서 본다.

## 변경 내용

| 파일 | 내용 |
|---|---|
| `backend/src/auth/groupware-sso.plugin.ts` | `/groupware/exchange` 핸들러 본문을 `exchangeGroupwareToken`으로 분리하고, 같은 함수를 쓰는 `GET /login`(`groupwareLogin`) 추가 |
| `backend/src/auth/groupware-login-redirect.ts` | `normalizeLoginToken`, `resolveSafeNext` (순수 함수) |
| `backend/src/auth/groupware-login-redirect.spec.ts` | 위 두 함수의 단위 테스트 |
| `backend/src/auth/auth-config.ts` | `appBasePath` 추가 (`APP_BASE_PATH`) |
| `docker-compose.yml` | backend에 `APP_BASE_PATH=${BASE_PATH:-/ip-workspace/}` 추가 |

`/groupware/exchange`의 동작은 바꾸지 않았다. 핸들러 본문을 그대로 함수로 옮겼고
요청·응답 형태가 같다. 검증, 계정 연결, 사용자 상태 확인, 알림 수신자 동기화, 세션 발급,
audit 기록이 두 경로에서 똑같이 일어난다.

## 설계 결정

- **`+` 처리**: Groupware 링크의 base64 Token에는 `+`가 인코딩되지 않은 채 실려 오고
  쿼리 파서가 이를 공백으로 바꾼다. `normalizeLoginToken`이 공백을 `+`로 되돌린다.
  base64에는 공백이 없으므로 안전하다. 프런트의 수동 쿼리 파싱(`readGroupwareQueryAuth`)과
  같은 문제를 푸는 방식이다.
- **`user_id`는 신뢰하지 않는다**: 서버가 Token으로 확인한 email과 대조하는 `expectedEmail`로만
  쓴다. 다르면 `GROUPWARE_ID_MISMATCH`로 실패하고 세션을 만들지 않는다.
- **`next` 검증 (`resolveSafeNext`)**: open redirect를 막는다. 다음은 모두 앱 첫 화면으로 돌린다.
  - 외부 주소(`https://evil.com`), scheme-relative(`//evil.com`), 역슬래시(`/\evil.com`)
  - 앱 prefix 밖 경로, `..`로 prefix를 벗어나는 경로(인코딩된 `%2e%2e` 포함)
  - 앱 prefix 아래의 `api/` 경로
  브라우저와 같은 규칙으로 `new URL`로 정규화한 뒤 판단하고, 정규화된 경로를 돌려준다.
- **앱 prefix를 서버가 알아야 한다**: 서버는 브라우저가 자신을 어떤 주소로 부르는지 모르고
  앞단 nginx가 `/ip-workspace/`를 붙인다. redirect 주소를 만들려면 prefix가 필요해서
  `APP_BASE_PATH`를 추가했다. 기본값은 `/`이며, 프런트의 `BASE_PATH`와 같은 값이어야 한다.
- **응답 헤더**: Token이 URL에 있으므로 `Cache-Control: no-store`, `Referrer-Policy: no-referrer`를 건다.
- **인터셉터**: `GroupwareSessionInterceptor`는 `/api/auth` 경로를 건너뛰므로 로그인 전의 이 요청이
  막히지 않는다.

## 배포 시 확인

1. Groupware의 링크를 `/ip-workspace/api/auth/login?user_id=…&login_token=…`로 바꾼다.
   frontend의 `nginx.conf`는 `/api/`를 backend로 프록시하므로 추가 설정은 없다.
2. backend 컨테이너에 `APP_BASE_PATH`가 배포 환경의 `BASE_PATH`와 같은 값으로 들어가는지 본다.
3. nginx access log에 query string(Token)이 남는지 확인한다. Token이 일회용인지 만료 시간이
   얼마인지는 Groupware 정책이라 이 작업에서 확인하지 못했다.

## 기존 경로와의 관계

`AuthGate`의 `?id=&token=` 처리와 `POST /groupware/exchange`는 그대로 둔다. 팝업 로그인
(`postMessage`)과 기존 링크가 계속 동작한다. 프런트는 이번 작업에서 수정하지 않았다.

## 검증

- `tsc --noEmit`: 통과.
- `jest src/auth/`: 2 suites, 18 tests 통과 (`groupware-login-check.spec.ts`, `groupware-login-redirect.spec.ts`).
- 전체 `jest`에서는 `authorization/*`, `patent-analysis/*`, `patent-analysis-admin/*`,
  `app.controller` 스펙 5개가 로드 단계에서 실패한다(`generated/prisma/client.ts`의
  `import.meta`). 이번 변경 파일을 import하지 않는 스펙이고 테스트 케이스는 모두 통과(206/206)한다.
  이번 변경 전의 상태와 비교해 보지는 않았다.
- **실제 Groupware Token으로 `/login`을 호출한 end-to-end 검증은 하지 못했다.**
  로컬 dev는 Groupware 로그인에 막혀 있고 유효한 Token이 필요하다.
  `ctx.redirect`를 던질 때 `setSessionCookie`의 `Set-Cookie`가 응답에 실리는지는 better-auth의
  표준 패턴(OAuth callback)을 따랐지만 직접 확인하지 않았다.

## DB 변경

없음. `schema.prisma`, migration, `docs/auth_database_schema.md`의 ERD는 바꾸지 않았다.
