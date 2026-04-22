# Frontend Dockerfile
FROM oven/bun:latest

WORKDIR /app

# 기본 패키지 설치를 위한 파일 복사 (없을 경우 빈 파일 생성 방지)
COPY package.json bun.lockb* ./

# 의존성 설치
RUN bun install

COPY . .

# Vite 개발 서버 실행 (Docker 내부에서 Bun 사용)
EXPOSE 5173
CMD ["bun", "run", "dev", "--host"]
