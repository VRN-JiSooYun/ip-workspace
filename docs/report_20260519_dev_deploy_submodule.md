# Dev Deploy Submodule Checkout

## 요청 요약

`dev-deploy.yml`에서 git submodule을 함께 불러오도록 수정한다.

## 구현 내용

파일: `.github/workflows/dev-deploy.yml`

- `actions/checkout@v4`에 `submodules: recursive` 옵션을 추가했다.
- 외부 private submodule 저장소 접근을 위해 `RDKIT_SUBMODULE_TOKEN` secret을 checkout token으로 사용하도록 설정했다.

필요한 GitHub Actions secret:

```text
RDKIT_SUBMODULE_TOKEN
```

이 token은 `voronoi-dev-team/rdkit_drawing` 저장소를 읽을 수 있어야 한다.

## 효과

- dev 브랜치 배포 시 `rdkit` submodule이 checkout된다.
- `docker-compose.dev.yml`의 `./rdkit:/app` volume mount 대상이 배포 환경에서도 존재한다.
- `taehoon-m/myWorkspace` 기본 `GITHUB_TOKEN`으로 접근할 수 없는 외부 private submodule도 checkout할 수 있다.

## 장애 대응 기록

GitHub Actions에서 다음 에러가 발생했다.

```text
remote: Repository not found.
fatal: repository 'https://github.com/voronoi-dev-team/rdkit_drawing.git/' not found
```

원인은 저장소가 없어서가 아니라, `actions/checkout`의 기본 token이 외부 private 저장소인 `voronoi-dev-team/rdkit_drawing`에 접근할 권한이 없기 때문이다. 따라서 해당 저장소 read 권한이 있는 PAT를 repository/environment secret으로 등록하고 checkout에 전달하도록 수정했다.
