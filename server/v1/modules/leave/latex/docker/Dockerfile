# XeLaTeX for Hostel/05 station leave (polyglossia, tabularx, marvosym, dashrule, TeX Gyre Termes, FreeSerif).
# Build:  docker build -t iitg-station-leave-latex:local .
# (from this directory: server/v1/modules/leave/latex/docker)

FROM debian:bookworm-slim
ENV DEBIAN_FRONTEND=noninteractive
RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
    --mount=type=cache,target=/var/lib/apt/lists,sharing=locked \
    apt-get update \
    && apt-get install -y --no-install-recommends \
      ca-certificates \
      texlive-xetex \
      texlive-lang-english \
      texlive-lang-other \
      texlive-fonts-recommended \
      texlive-fonts-extra \
      texlive-latex-extra \
      fonts-texgyre \
      fonts-freefont-ttf \
      fonts-noto-core \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /work
