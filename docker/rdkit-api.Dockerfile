FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    libxrender1 \
    libxext6 \
    libsm6 \
    libexpat1 \
  && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir \
  rdkit==2026.3.2 \
  fastapi \
  uvicorn \
  pandas \
  tqdm \
  mapply \
  requests

COPY rdkit/ /app/

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
