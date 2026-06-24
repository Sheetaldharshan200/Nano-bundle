FROM python:3.13.5-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app
COPY requirements.txt /app/requirements.txt
RUN python -m pip install --upgrade pip==25.1.1 \
    && python -m pip install -r /app/requirements.txt

COPY bootstrap.py /app/bootstrap.py
COPY samples/customer_events.ndjson /app/samples/customer_events.ndjson

USER nobody
ENTRYPOINT ["python", "/app/bootstrap.py"]
