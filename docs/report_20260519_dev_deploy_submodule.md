# Dev Deploy Submodule Checkout

## 요청 요약

`dev-deploy.yml`에서 git submodule을 함께 불러오도록 수정한다.

## 구현 내용

파일: `.github/workflows/dev-deploy.yml`

- `actions/checkout@v4`에 `submodules: recursive` 옵션을 추가했다.
- self-hosted runner에서 submodule URL/상태가 꼬이는 상황을 줄이기 위해 별도 `Update submodules` step을 추가했다.

추가된 명령:

```bash
git submodule sync --recursive
git submodule update --init --recursive
```

## 효과

- dev 브랜치 배포 시 `rdkit` submodule이 checkout된다.
- `docker-compose.dev.yml`의 `./rdkit:/app` volume mount 대상이 배포 환경에서도 존재한다.
- submodule 경로나 URL이 변경되어도 sync 후 update가 수행된다.
