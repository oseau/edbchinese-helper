SHELL := /usr/bin/env bash -o errexit -o pipefail -o nounset

MAKEFLAGS += --always-make

REPO_ROOT?=$(shell git rev-parse --show-toplevel)
IMAGE_UV?=ghcr.io/astral-sh/uv:python3.13-bookworm-slim

fetch-words: ## (re)fetch words from edbchinese
	@docker run --rm -it -v $(REPO_ROOT):/app -w /app $(IMAGE_UV) uv run fetch-words.py

.DEFAULT_GOAL := help
help:
	@grep -Eh '^[a-zA-Z_-]+:.*?##? .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?##? "}; {printf "\033[36m%-30s\033[0m %s\n", $$1, $$2}'
