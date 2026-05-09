# Docker Hub Publish GitHub Action Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions workflow that runs tests and publishes the Docker image to `jfkriz3/automate-fg-timesheet-email` on Docker Hub whenever a release is published from the default branch.

**Architecture:** A single workflow file triggered by `release: published` events, restricted to the default branch via a job condition. It runs the existing Jest test suite first, then uses the official Docker GitHub Actions (`login-action`, `metadata-action`, `build-push-action`) to build and push three tags: release tag, `latest`, and short SHA.

**Tech Stack:** GitHub Actions, docker/login-action@v3, docker/metadata-action@v5, docker/build-push-action@v6, actions/checkout@v4, actions/setup-node@v4

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `.github/workflows/publish.yml` | Full CI/CD workflow |

---

### Task 1: Create the GitHub Actions publish workflow

**Files:**
- Create: `.github/workflows/publish.yml`

There are no unit-testable artifacts here — the workflow file is validated by checking its YAML syntax locally, then verified by GitHub when triggered. The steps below reflect that.

- [ ] **Step 1: Create the workflow directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Create `.github/workflows/publish.yml`**

```yaml
name: Publish Docker Image

on:
  release:
    types: [published]

jobs:
  build-and-push:
    runs-on: ubuntu-latest
    if: github.event.release.target_commitish == github.event.repository.default_branch

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'yarn'

      - name: Install dependencies and run tests
        run: |
          yarn install --frozen-lockfile
          yarn test

      - name: Log in to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: Extract metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: jfkriz3/automate-fg-timesheet-email
          tags: |
            type=raw,value=${{ github.ref_name }}
            type=raw,value=latest
            type=sha,format=short

      - name: Build and push
        uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

- [ ] **Step 3: Validate YAML syntax**

```bash
python3 -c "import yaml, sys; yaml.safe_load(open('.github/workflows/publish.yml'))" && echo "YAML valid"
```

Expected: `YAML valid`

If `python3` is unavailable:
```bash
node -e "const fs=require('fs'); JSON.stringify(require('js-yaml').load(fs.readFileSync('.github/workflows/publish.yml','utf8'))); console.log('YAML valid')" 2>/dev/null || echo "install js-yaml to validate, or skip"
```

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/publish.yml
git commit -m "ci: add Docker Hub publish workflow on release"
```

- [ ] **Step 5: Add required secrets in GitHub**

Navigate to: **GitHub repo → Settings → Secrets and variables → Actions → New repository secret**

Add these two secrets:

| Name | Value |
|------|-------|
| `DOCKERHUB_USERNAME` | `jfkriz3` |
| `DOCKERHUB_TOKEN` | A Docker Hub access token — generate one at hub.docker.com → your avatar → Account Settings → Security → Access Tokens → Generate new token (Read & Write scope) |

This step is manual and cannot be automated here. The workflow will fail with an authentication error until both secrets are set.

- [ ] **Step 6: Push and verify**

```bash
git push origin main
```

Then verify on GitHub: **repo → Actions tab** — the workflow should appear in the list (it won't run until a release is published, but it should be visible and its YAML should parse without errors shown in the Actions UI).
