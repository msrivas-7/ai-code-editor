# M-5 (bucket 7): parameterized base image so CI can pin by digest. Default
# is the rolling tag so a local `docker compose build` still works offline;
# prod CI should resolve the digest once per refresh and pass it in:
#   docker pull debian:bookworm-slim
#   DIGEST=$(docker inspect --format '{{index .RepoDigests 0}}' debian:bookworm-slim)
#   docker build --build-arg DEBIAN_BASE="$DIGEST" ...
# Refreshing deliberately (vs every build pulling :slim) is the point —
# a Debian point-release that silently swaps gcc or nodejs majors should
# surface as a PR, not as mystery lesson failures after an overnight apt.
ARG DEBIAN_BASE=debian:bookworm-slim
FROM ${DEBIAN_BASE}

# M-5: pin tsx major.minor. tsx is a user-facing runtime for the backend's
# ts-exec lesson script (test harness + coach nudges), so a breaking 5.x
# would surface as mysterious lesson failures days after a rebuild. Lock
# to 4.19.x; bump deliberately alongside a lesson-harness smoke test.
ARG TSX_VERSION=4.19.2

# Phase 22F2A: pytest is needed for the upcoming `testing-basics` lesson.
# Same pin-deliberately stance as tsx — a major bump might quietly change
# fixture lookup or test-collection behavior. Bookworm's PEP 668 marker
# requires --break-system-packages, which is fine here: the runner is a
# single-purpose container with no system Python users to contaminate.
ARG PYTEST_VERSION=8.3.5

ENV DEBIAN_FRONTEND=noninteractive \
    LANG=C.UTF-8 \
    PATH="/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        passwd \
        adduser \
        python3 \
        python3-minimal \
        python3-pip \
        nodejs \
        npm \
        gcc \
        g++ \
        default-jdk-headless \
        golang-go \
        rustc \
        ruby \
        make \
        coreutils \
        bash \
    && pip3 install --break-system-packages --no-cache-dir "pytest==${PYTEST_VERSION}" \
    && npm install -g --no-audit --no-fund tsx@${TSX_VERSION} \
    && npm cache clean --force \
    && rm -rf /var/lib/apt/lists/* /root/.cache

# Non-root runtime user. UID/GID 1100 is unlikely to collide with host users.
RUN groupadd --system --gid 1100 runner \
    && useradd --system --uid 1100 --gid 1100 --home /home/runner --create-home --shell /bin/bash runner \
    && mkdir -p /workspace \
    && chown -R runner:runner /workspace

WORKDIR /workspace
USER runner

# Container stays alive for the session; backend drives execution via `docker exec`.
CMD ["sleep", "infinity"]
