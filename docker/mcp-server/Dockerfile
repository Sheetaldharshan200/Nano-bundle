FROM python:3.13.5-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip==25.1.1 \
    && python -m pip install -r /app/requirements.txt

COPY scripts/entrypoint.sh /app/entrypoint.sh
COPY scripts/run_http.py /app/run_http.py
RUN sed -i 's/\r$//' /app/entrypoint.sh && chmod +x /app/entrypoint.sh

EXPOSE 7766
USER nobody
ENTRYPOINT ["/app/entrypoint.sh"]
