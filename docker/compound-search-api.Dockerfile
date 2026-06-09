FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    libxrender1 \
    libxext6 \
    libsm6 \
    libexpat1 \
  && rm -rf /var/lib/apt/lists/*

COPY compound_search/requirement.txt /tmp/requirement.txt
RUN pip install --no-cache-dir -r /tmp/requirement.txt
RUN pip install --no-cache-dir \
  networkx==3.6.1 \
  matplotlib==3.10.8

COPY compound_search/ /app/
COPY sample/patent_analysis_helper_api/analyzer/ /analyzer/

EXPOSE 8080

CMD ["uvicorn", "search_api:app", "--host", "0.0.0.0", "--port", "8080"]
