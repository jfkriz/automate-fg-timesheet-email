# Docker Hub Publish GitHub Action Design

**Date:** 2026-05-08
**Status:** Approved

## Overview

Add a GitHub Actions workflow that runs tests and publishes the Docker image to Docker Hub whenever a release is published from the default branch (`main`).

## File

```
.github/workflows/publish.yml
```

## Trigger

```yaml
on:
  release:
    types: [published]
```

Job-level condition restricts execution to releases targeting the default branch:

```yaml
if: github.event.release.target_commitish == github.event.repository.default_branch
```

Releases published from other branches (e.g., hotfix branches or pre-release branches) are silently skipped.

## Job: build-and-push

Runs on `ubuntu-latest`.

### Steps

1. **Checkout** — `actions/checkout@v4`

2. **Set up Node.js** — `actions/setup-node@v4` with `node-version: '20'`

3. **Run tests** — install dependencies and run the test suite:
   ```bash
   yarn install --frozen-lockfile
   yarn test
   ```
   Workflow fails here if any test fails; nothing is pushed to Docker Hub.

4. **Login to Docker Hub** — `docker/login-action@v3` using secrets:
   - `DOCKERHUB_USERNAME`
   - `DOCKERHUB_TOKEN`

5. **Extract metadata** — `docker/metadata-action@v5` targeting image `jfkriz3/automate-fg-timesheet-email` with these tags:
   - `type=raw,value=${{ github.ref_name }}` — the release tag as-is (e.g., `v1.2.3`)
   - `type=raw,value=latest`
   - `type=sha,format=short` — short git SHA (e.g., `sha-5368a8a`)

6. **Build and push** — `docker/build-push-action@v6` using the existing `Dockerfile`, with `push: true` and tags/labels from the metadata step.

## Required GitHub Secrets

Add these in **GitHub repo → Settings → Secrets and variables → Actions:**

| Secret | Value |
|--------|-------|
| `DOCKERHUB_USERNAME` | `jfkriz3` |
| `DOCKERHUB_TOKEN` | A Docker Hub access token (read/write scope) — generated at hub.docker.com → Account Settings → Security → Access Tokens |

## Resulting Docker Hub Tags per Release

For a release tagged `v1.2.3` on commit `5368a8a`:

| Tag | Value |
|-----|-------|
| Version | `jfkriz3/automate-fg-timesheet-email:v1.2.3` |
| Latest | `jfkriz3/automate-fg-timesheet-email:latest` |
| SHA | `jfkriz3/automate-fg-timesheet-email:sha-5368a8a` |
