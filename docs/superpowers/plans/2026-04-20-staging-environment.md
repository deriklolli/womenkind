# Staging Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a full staging environment (Supabase staging project + Vercel staging deployment + `staging` git branch) so that all changes are tested on staging before reaching production.

**Architecture:** A dedicated `womenkind-staging` Supabase project holds a schema-identical copy of production (no real patient data). The `staging` git branch auto-deploys to Vercel's Preview environment with branch-specific env vars pointing at this staging Supabase. The dev workflow becomes: feature branch → PR into `staging` → verify on staging URL → PR into `main` → production.

**Tech Stack:** Supabase (Postgres + Auth), Vercel (Next.js hosting, Preview environments, branch env vars), GitHub Actions CI

---

## File Map

- **No new source files** — this is infrastructure configuration only.
- Modify: `.github/workflows/ci.yml` — add a `deploy-staging` job that comments the staging URL on PRs
- Create: `docs/STAGING.md` — developer workflow reference (optional, create only if user wants it)

---

### Task 1: Create Supabase Staging Project

**Goal:** Spin up a new Supabase project called `womenkind-staging` in us-west-1 (same region as prod).

- [ ] **Step 1: Create the Supabase project via MCP**

  Use the Supabase MCP tool `create_project` with:
  ```
  name: "womenkind-staging"
  organization_id: "bpdoazpqqwdyltlzzqpj"
  region: "us-west-1"
  ```

  Wait for `status: ACTIVE_HEALTHY` (poll `get_project` until ready — typically 2 minutes).

- [ ] **Step 2: Record staging credentials**

  From the project response, note:
  - Project ref/ID (e.g. `abcdefghijklmnop`)
  - From `get_project_url`: `NEXT_PUBLIC_SUPABASE_URL`
  - From `get_publishable_keys`: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - From Supabase dashboard Settings → API: `SUPABASE_SERVICE_ROLE_KEY`

  Do NOT commit these to the repo. They will be set as Vercel env vars in Task 3.

- [ ] **Step 3: Run all migrations against staging**

  Apply each migration in order using `apply_migration` MCP tool on the staging project ref:

  ```
  supabase/migrations/20260407_checkin.sql
  supabase/migrations/20260408_appointment_reminder_sent.sql
  supabase/migrations/20260408_in_person_clinics.sql
  supabase/migrations/20260408_phi_access_log.sql
  supabase/migrations/20260411_rls_core_tables.sql
  supabase/migrations/20260413_encounter_notes.sql
  ```

  Apply them one at a time. If any fails, read the error before continuing.

- [ ] **Step 4: Verify schema via MCP**

  Run `list_tables` on the staging project and confirm the same tables exist as in production.

---

### Task 2: Create the `staging` Git Branch

- [ ] **Step 1: Create and push `staging` branch from current `main`**

  ```bash
  git checkout main
  git pull origin main
  git checkout -b staging
  git push -u origin staging
  ```

  Expected output: `Branch 'staging' set up to track remote branch 'staging' from 'origin'.`

- [ ] **Step 2: Verify on GitHub**

  ```bash
  gh api repos/deriklolli/womenkind/branches --jq '.[].name'
  ```

  Expected: both `main` and `staging` appear in the list.

---

### Task 3: Configure Vercel Staging Environment Variables

Vercel supports branch-specific env var overrides within the Preview environment. We set staging-specific values that apply only when deploying the `staging` branch.

- [ ] **Step 1: Set Supabase staging URL (branch-specific Preview)**

  In Vercel dashboard → womenkind project → Settings → Environment Variables:

  Add `NEXT_PUBLIC_SUPABASE_URL`:
  - Value: the staging Supabase URL from Task 1 Step 2
  - Environments: check **Preview** only
  - Git branch: `staging`

- [ ] **Step 2: Set Supabase staging anon key**

  Add `NEXT_PUBLIC_SUPABASE_ANON_KEY`:
  - Value: staging anon key from Task 1 Step 2
  - Environments: Preview only, branch: `staging`

- [ ] **Step 3: Set Supabase staging service role key**

  Add `SUPABASE_SERVICE_ROLE_KEY`:
  - Value: staging service role key from Task 1 Step 2
  - Environments: Preview only, branch: `staging`

- [ ] **Step 4: Set a staging CRON_SECRET**

  Generate a new random secret:
  ```bash
  openssl rand -hex 32
  ```

  Add `CRON_SECRET`:
  - Value: the generated secret
  - Environments: Preview only, branch: `staging`

- [ ] **Step 5: Set NEXT_PUBLIC_APP_URL for staging**

  First, trigger a deployment of `staging` branch (push any whitespace change) to get the stable branch alias URL. Vercel assigns a stable alias like `womenkind-git-staging-dlolli-2486s-projects.vercel.app`.

  Then add `NEXT_PUBLIC_APP_URL`:
  - Value: `https://womenkind-git-staging-dlolli-2486s-projects.vercel.app`
  - Environments: Preview only, branch: `staging`

  Redeploy staging after setting this.

- [ ] **Step 6: Verify staging deployment**

  Visit the staging URL and confirm:
  - The app loads (no 500 errors)
  - Auth works (can sign in / sign up)
  - Supabase is pointing at staging (check network tab — URL should contain the staging project ref)

---

### Task 4: Set Supabase Auth Callback URL for Staging

Supabase requires the staging domain be allowlisted for auth redirects.

- [ ] **Step 1: Add staging URL to Supabase Auth allowed redirect URLs**

  In the Supabase staging dashboard → Authentication → URL Configuration:

  - Site URL: `https://womenkind-git-staging-dlolli-2486s-projects.vercel.app`
  - Add to Redirect URLs: `https://womenkind-git-staging-dlolli-2486s-projects.vercel.app/**`

- [ ] **Step 2: Test auth end-to-end on staging**

  Open the staging URL in an incognito window, attempt to sign in. Confirm no auth callback errors.

---

### Task 5: Update CI to Comment Staging URL on PRs

Make it easy for reviewers to click the staging URL directly from a pull request.

- [ ] **Step 1: Modify `.github/workflows/ci.yml`**

  Replace the current content with:

  ```yaml
  name: CI

  on:
    push:
      branches: ['**']
    pull_request:
      branches: ['**']

  jobs:
    test:
      name: Type check & unit tests
      runs-on: ubuntu-latest

      steps:
        - name: Checkout code
          uses: actions/checkout@v4

        - name: Set up Node.js
          uses: actions/setup-node@v4
          with:
            node-version: '20'
            cache: 'npm'

        - name: Install dependencies
          run: npm ci

        - name: TypeScript type check
          run: npx tsc --noEmit

        - name: Run unit tests
          run: npm test

        - name: Notify Slack on failure
          if: failure()
          uses: slackapi/slack-github-action@v1.26.0
          with:
            payload: |
              {
                "text": ":red_circle: *Womenkind CI failed* on `${{ github.ref_name }}`\n*Commit:* ${{ github.event.head_commit.message }}\n*By:* ${{ github.actor }}\n*Details:* ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"
              }
          env:
            SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}
            SLACK_WEBHOOK_TYPE: INCOMING_WEBHOOK

    staging-gate:
      name: Require staging branch for main PRs
      runs-on: ubuntu-latest
      if: github.event_name == 'pull_request' && github.base_ref == 'main'

      steps:
        - name: Check PR is from staging
          run: |
            if [ "${{ github.head_ref }}" != "staging" ]; then
              echo "::error::Direct PRs to main are not allowed. Merge your feature branch into 'staging' first, verify on staging, then open a PR from staging → main."
              exit 1
            fi
  ```

- [ ] **Step 2: Commit the CI change**

  ```bash
  git add .github/workflows/ci.yml
  git commit -m "ci: require staging gate for PRs to main"
  git push origin staging
  ```

- [ ] **Step 3: Verify CI runs on staging branch push**

  ```bash
  gh run list --branch staging --limit 3
  ```

  Expected: the CI run appears and passes.

---

### Task 6: Protect Branches on GitHub

- [ ] **Step 1: Enable branch protection on `main`**

  ```bash
  gh api repos/deriklolli/womenkind/branches/main/protection \
    --method PUT \
    --field required_status_checks='{"strict":true,"contexts":["Type check & unit tests","Require staging branch for main PRs"]}' \
    --field enforce_admins=false \
    --field required_pull_request_reviews=null \
    --field restrictions=null
  ```

  Expected: HTTP 200 response with protection rules.

- [ ] **Step 2: Verify protection is active**

  ```bash
  gh api repos/deriklolli/womenkind/branches/main --jq '.protected'
  ```

  Expected: `true`

---

## Developer Workflow (post-setup)

```
feature/my-thing  →  PR into staging  →  test on staging URL  →  PR from staging into main  →  production
```

- Never push directly to `main`
- Always test on staging before opening PR to `main`
- Migrations: run against staging first, then production after verifying
- The `staging` branch accumulates features; periodically reset it to `main` after a production release

---

## Self-Review

**Spec coverage:**
- ✅ Supabase staging project with schema
- ✅ Git `staging` branch
- ✅ Vercel env vars for staging
- ✅ Auth callback URL allowlisted
- ✅ CI gate enforcing staging-first workflow
- ✅ Branch protection on `main`

**Placeholder scan:** None found — all steps have explicit commands or UI instructions.

**Type consistency:** N/A — infrastructure only.
