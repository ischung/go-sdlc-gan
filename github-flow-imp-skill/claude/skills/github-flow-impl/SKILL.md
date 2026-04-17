---
name: github-flow-impl
description: >
  GitHub Projects 보드에서 우선순위 이슈를 자동으로 선택하거나, 사용자가 직접 이슈 내용을
  입력하여 GitHub Flow에 따라 브랜치 생성, 코드 구현, 로컬 테스트, PR 생성까지
  end-to-end로 처리하는 AI 개발자 스킬.
  사용자가 "/implement", "/impl", "이슈 처리해줘", "다음 이슈 구현해줘",
  "GitHub 보드 작업 시작", "Todo 이슈 자동 처리", "이슈 직접 입력해서 구현" 등을
  언급하면 반드시 이 스킬을 사용할 것.
  특정 이슈 번호("/implement #42") 또는 이슈 내용을 직접 입력하는
  "/implement --inline" 형태 요청 시에도 이 스킬을 사용할 것.
---

# GitHub Flow Auto-Implementation Skill

## Commands

| 커맨드 | 이슈 소스 | 설명 |
|--------|-----------|------|
| `/implement` | GitHub Projects | Todo 열 최우선 이슈 자동 선택 후 구현 |
| `/implement #42` | GitHub Issues | 특정 이슈 번호 지정 후 구현 |
| `/implement --inline` | 직접 입력 | 이슈 내용 입력 → GitHub 이슈 생성 → 보드 등록 → 구현 |
| `/impl` | — | `/implement` 단축어 |

---

## Role

너는 이 프로젝트의 **구현 담당 AI 개발자**다. 한 번에 **하나의 이슈만** 처리한다.

---

## Step 0 — 환경 감지 (모든 모드 공통, 가장 먼저 실행)

아래 명령을 실제로 실행하여 OWNER, REPO, PROJECT_NUMBER를 확인한다.

```bash
git remote get-url origin
```

위 출력에서 `github.com/OWNER/REPO` 형식으로 OWNER와 REPO를 추출한다.
실패하면 `gh repo view --json owner,name` 으로 대체한다.

```bash
gh project list --owner OWNER --format json
```

프로젝트 목록을 출력하고 PROJECT_NUMBER를 확인한다.
- 1개: 자동 사용
- 2개 이상: 사용자에게 선택 요청
- 0개: "연결된 프로젝트가 없습니다" 안내 후 중단

### Step 0.5 — 칸반 자동화 워크플로우 설정 확인 (최초 1회)

> **이 단계를 생략하면 PR 오픈/머지 후 칸반 카드가 자동으로 이동하지 않는다. 반드시 실행한다.**
>
> ℹ️ **KANBAN_TOKEN PAT 설정은 안내 기반 자동화**: `KANBAN_TOKEN` 시크릿이 없으면 아래 스크립트가
> 토큰 발급 페이지를 열고 입력을 안내한다. 사용자는 **토큰 생성 + 복사·붙여넣기**만 하면 된다.

마커 파일 `.github/.kanban-auto-done-configured`에 `v5` 버전이 없거나 구버전 워크플로우가 감지되면 아래 자동화를 설정한다.

> **핵심 원칙**: 워크플로우 파일은 **feature 브랜치가 아닌 main에 직접 커밋**해야 한다.
> GitHub Actions는 base 브랜치(main)에 있는 워크플로우만 실행하기 때문에,
> feature 브랜치에 커밋하면 해당 PR이 머지될 때는 아직 main에 파일이 없어 첫 번째 PR부터 동작하지 않는다.

생성할 파일 3개:
- `_kanban-move.yml` — 공통 이슈 이동 로직 (reusable workflow)
- `kanban-auto-review.yml` — PR 오픈 시 Review 이동
- `kanban-auto-done.yml` — PR 머지 시 Done 이동

> **실행 순서 중요**: 워크플로우 파일을 **먼저** 생성하고, KANBAN_TOKEN 등록은 **나중에** 한다.
> 파일 생성과 시크릿 등록은 독립적이다. 파일이 없으면 Actions 트리거 자체가 안 되지만,
> 시크릿이 없어도 파일은 미리 생성해 둘 수 있다 (runtime guard로 graceful skip).

#### Part A — 워크플로우 파일 생성/갱신 (무조건 먼저 실행)

아래 세 조건 중 하나라도 해당하면 워크플로우를 재생성한다:
1. 마커 파일에 `v5` 버전 없음 (최초 설치 / 이전 버전)
2. `_kanban-move.yml`에 `KANBAN_TOKEN` 없음 (GitHub App 방식 → PAT 방식으로 되돌림)
3. `_kanban-move.yml`에 `Check secrets configured` step 없음 (runtime guard 미탑재)

**감지 방법** — 아래 명령을 실행한다:

```bash
(grep -q "^v5 " .github/.kanban-auto-done-configured 2>/dev/null && grep -q "KANBAN_TOKEN" .github/workflows/_kanban-move.yml 2>/dev/null && grep -q "Check secrets configured" .github/workflows/_kanban-move.yml 2>/dev/null) && echo "SKIP" || echo "NEED_SETUP"
```

결과가 **"SKIP"**이면 Part A를 건너뛰고 Part B로 진행한다.
결과가 **"NEED_SETUP"**이면 아래 절차를 **반드시** 실행한다.

> **중요 — bash heredoc을 사용하지 않는다.**
> 아래 파일들을 Claude의 **Write 도구**로 직접 생성한다.
> 각 파일의 내용을 그대로 복사하여 Write 도구에 전달한다.
> `${{` 로 시작하는 GitHub Actions 표현식은 쉘 변수가 아니므로 **그대로** 유지한다.

**현재 브랜치가 main인지 확인한다** (워크플로우는 main에만 있어야 한다):

```bash
git checkout main
```

**파일 1** — `.github/workflows/_kanban-move.yml` 을 Write 도구로 생성한다.
내용은 아래와 **정확히 동일**하게 작성한다:

<details><summary>_kanban-move.yml 전체 내용 (접어둠 — Write 도구에 이 내용을 전달)</summary>

```yaml
name: Kanban — Move Issue Status (Reusable)

on:
  workflow_call:
    inputs:
      status:
        description: "이동할 칸반 컬럼 이름 (예: Review, Done)"
        required: true
        type: string
      pr_number:
        description: "PR 번호 (API로 본문 조회하여 closes #N 파싱)"
        required: true
        type: number
    secrets:
      KANBAN_TOKEN:
        required: false

jobs:
  move:
    runs-on: ubuntu-latest
    steps:
      - name: Check secrets configured
        id: check
        run: |
          if [ -z "${{ secrets.KANBAN_TOKEN }}" ]; then
            echo "configured=false" >> $GITHUB_OUTPUT
            echo "::notice::KANBAN_TOKEN 미등록 — 칸반 이동 스킵. Repo Settings → Secrets에서 등록하면 자동화가 활성화됩니다."
          else
            echo "configured=true" >> $GITHUB_OUTPUT
          fi

      - name: Move linked issues to ${{ inputs.status }}
        if: steps.check.outputs.configured == 'true'
        uses: actions/github-script@v7
        env:
          TARGET_STATUS: ${{ inputs.status }}
          PR_NUMBER: ${{ inputs.pr_number }}
          KANBAN_PROJECT_NUMBER: ${{ vars.KANBAN_PROJECT_NUMBER }}
        with:
          github-token: ${{ secrets.KANBAN_TOKEN }}
          script: |
            const targetStatus = process.env.TARGET_STATUS;
            const prNumber = parseInt(process.env.PR_NUMBER, 10);
            const owner = context.repo.owner;
            const repo = context.repo.repo;

            const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: prNumber });
            const prBody = pr.body || '';

            const issueNumbers = [...prBody.matchAll(/(closes?|fixes?|resolves?)\s+#(\d+)/gi)]
              .map(m => parseInt(m[2], 10));

            if (issueNumbers.length === 0) {
              core.info('링크된 이슈 없음. 종료.');
              return;
            }
            core.info(`추출된 이슈 번호: ${issueNumbers.join(', ')}`);

            let projectNumber = parseInt(process.env.KANBAN_PROJECT_NUMBER || '0', 10);
            if (!projectNumber) {
              const projectData = await github.graphql(`
                query($owner: String!) {
                  repositoryOwner(login: $owner) {
                    ... on Organization { projectsV2(first:1, orderBy:{field:UPDATED_AT, direction:DESC}) { nodes { number } } }
                    ... on User        { projectsV2(first:1, orderBy:{field:UPDATED_AT, direction:DESC}) { nodes { number } } }
                  }
                }`, { owner });
              projectNumber = projectData.repositoryOwner.projectsV2.nodes[0]?.number;
            }
            if (!projectNumber) { core.setFailed('프로젝트 번호를 찾을 수 없습니다.'); return; }
            core.info(`PROJECT_NUMBER=${projectNumber}`);

            const fieldData = await github.graphql(`
              query($owner: String!, $num: Int!) {
                repositoryOwner(login: $owner) {
                  ... on Organization { projectV2(number: $num) { id fields(first:30) { nodes { ...on ProjectV2SingleSelectField { id name options { id name } } } } } }
                  ... on User        { projectV2(number: $num) { id fields(first:30) { nodes { ...on ProjectV2SingleSelectField { id name options { id name } } } } } }
                }
              }`, { owner, num: projectNumber });

            const project = fieldData.repositoryOwner.projectV2;
            if (!project) { core.setFailed(`프로젝트 #${projectNumber}를 찾을 수 없습니다.`); return; }

            const projectId = project.id;
            const statusField = project.fields.nodes.find(f => f.name === 'Status');
            if (!statusField) { core.setFailed('Status 필드를 찾을 수 없습니다.'); return; }

            const statusFieldId = statusField.id;
            const targetOption = statusField.options.find(o => o.name === targetStatus);
            if (!targetOption) { core.setFailed(`'${targetStatus}' 옵션을 찾을 수 없습니다.`); return; }
            const targetOptionId = targetOption.id;

            for (const issueNum of issueNumbers) {
              core.info(`이슈 #${issueNum} → ${targetStatus} 이동 중...`);

              const itemData = await github.graphql(`
                query($owner: String!, $num: Int!) {
                  repositoryOwner(login: $owner) {
                    ... on Organization { projectV2(number: $num) { items(first:100) { nodes { id content { ...on Issue { number } } } } } }
                    ... on User        { projectV2(number: $num) { items(first:100) { nodes { id content { ...on Issue { number } } } } } }
                  }
                }`, { owner, num: projectNumber });

              const items = itemData.repositoryOwner.projectV2?.items?.nodes || [];
              const item = items.find(i => i.content?.number === issueNum);
              if (!item) {
                core.warning(`이슈 #${issueNum}가 프로젝트에 없음, 건너뜀`);
                continue;
              }

              await github.graphql(`
                mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
                  updateProjectV2ItemFieldValue(input: {
                    projectId: $projectId
                    itemId: $itemId
                    fieldId: $fieldId
                    value: { singleSelectOptionId: $optionId }
                  }) { projectV2Item { id } }
                }`, { projectId, itemId: item.id, fieldId: statusFieldId, optionId: targetOptionId });

              core.info(`이슈 #${issueNum} ${targetStatus} 이동 완료`);
            }
```

</details>

**파일 2** — `.github/workflows/kanban-auto-review.yml` 을 Write 도구로 생성한다:

```yaml
name: Kanban — Move to Review on PR Open

on:
  pull_request:
    types: [opened, reopened, ready_for_review]

jobs:
  move-to-review:
    if: "!github.event.pull_request.draft"
    uses: ./.github/workflows/_kanban-move.yml
    with:
      status: Review
      pr_number: ${{ github.event.pull_request.number }}
    secrets: inherit
```

**파일 3** — `.github/workflows/kanban-auto-done.yml` 을 Write 도구로 생성한다:

```yaml
name: Kanban — Move to Done on PR Merge

on:
  pull_request:
    types: [closed]

jobs:
  move-to-done:
    if: github.event.pull_request.merged == true
    uses: ./.github/workflows/_kanban-move.yml
    with:
      status: Done
      pr_number: ${{ github.event.pull_request.number }}
    secrets: inherit
```

**파일 4** — `.github/.kanban-auto-done-configured` 를 Write 도구로 생성한다:

```
v5 configured (현재 UTC 시각)
```

> `(현재 UTC 시각)` 대신 실제 시각을 넣는다. 예: `v5 configured 2026-04-16T12:00:00Z`

**파일 4개 생성 후**, main에 커밋하고 push한다:

```bash
git add .github/workflows/_kanban-move.yml .github/workflows/kanban-auto-review.yml .github/workflows/kanban-auto-done.yml .github/.kanban-auto-done-configured
git commit -m "chore: add kanban automation workflows (reusable pattern)"
git push origin main
```

이전 브랜치로 복귀한다:

```bash
git checkout -
```

---

#### Part B — KANBAN_TOKEN PAT 등록 (토큰 없을 때만)

워크플로우 파일 생성 후, 아래 명령을 실행해 KANBAN_TOKEN 시크릿 등록 여부를 확인한다:

```bash
gh secret list --repo "$OWNER/$REPO" 2>/dev/null | grep -q "^KANBAN_TOKEN" && echo "EXISTS" || echo "MISSING"
```

결과가 **"EXISTS"**이면 건너뛰고 Step 0.6으로 진행한다.
결과가 **"MISSING"**이면 아래 절차를 사용자와 **대화하며** 수행한다.

> **중요**: 이 절차는 bash 스크립트로 한 번에 실행하지 않는다.
> 각 단계를 Claude가 사용자에게 안내하고, 사용자 입력을 받아서 처리한다.

**1단계 — PAT 발급 페이지 열기**

아래 명령으로 GitHub PAT (classic) 발급 페이지를 연다:

```bash
open "https://github.com/settings/tokens/new"
```

> (Linux: `xdg-open`, Windows Git Bash: `start` 사용)

사용자에게 아래 설정으로 토큰을 발급하도록 안내한다:

- **Note**: `kanban-automation` (식별용)
- **Expiration**: 90 days 또는 No expiration (교육용이면 No expiration 권장)
- **Select scopes** — 아래 4개 체크:
  - ✅ `repo` (전체)
  - ✅ `project`
  - ✅ `read:org`
  - ✅ `read:discussion`

→ **Generate token** 버튼 클릭 후 표시되는 `ghp_...` 토큰 값을 복사.

**2단계 — 토큰 입력 받기**

사용자에게 묻는다:

> "발급받은 토큰(`ghp_...` 또는 `github_pat_...`)을 붙여넣어 주세요."

사용자 입력을 `_PAT_INPUT` 변수로 기억한다.

**3단계 — 시크릿 등록**

```bash
gh secret set KANBAN_TOKEN --body "<_PAT_INPUT>" --repo "$OWNER/$REPO"
```

성공하면 사용자에게 "KANBAN_TOKEN 등록 완료"를 알린 후 Step 0.6으로 진행한다.

---

### Step 0.6 — 칸반 자동화 사전 점검 (preflight)

Part A/B 완료 후, 칸반 자동화가 실제로 동작 가능한 상태인지 **자동으로 검증**한다.
아래 bash 블록을 **한 번** 실행하여 2가지를 한꺼번에 확인한다.

```bash
set +e
OWNER=$(gh repo view --json owner -q .owner.login 2>/dev/null)
REPO=$(gh repo view --json name -q .name 2>/dev/null)

echo "=== 칸반 자동화 사전 점검 ($OWNER/$REPO) ==="

# [1/2] KANBAN_TOKEN 시크릿 등록 여부
SECRETS=$(gh secret list --repo "$OWNER/$REPO" --json name -q '.[].name' 2>/dev/null)
if echo "$SECRETS" | grep -qx "KANBAN_TOKEN"; then
  SECRETS_OK=1
  echo "✅ [1/2] KANBAN_TOKEN 등록됨"
else
  SECRETS_OK=0
  echo "❌ [1/2] KANBAN_TOKEN 누락 — Part B 재실행 필요"
fi

# [2/2] 워크플로우 파일이 원격 main 브랜치에 존재하는가
if git ls-tree -r origin/main --name-only 2>/dev/null | grep -qx ".github/workflows/_kanban-move.yml"; then
  WORKFLOW_OK=1
  echo "✅ [2/2] _kanban-move.yml이 origin/main에 존재"
else
  WORKFLOW_OK=0
  echo "❌ [2/2] origin/main에 워크플로우 없음 — Part A 재실행 필요"
fi

echo ""
if [ "$SECRETS_OK" = "1" ] && [ "$WORKFLOW_OK" = "1" ]; then
  echo "✅ 칸반 자동화 준비 완료 — PR 오픈/머지 시 Review/Done 자동 이동 가능"
else
  echo "⚠️  위 실패 항목을 해결하지 않으면 자동화가 동작하지 않습니다."
fi
set -e
```

**판정 기준**:
- 모두 ✅ → Step 1로 진행
- `[1/2]` 실패 → Part B를 다시 실행 (PAT 발급 + 등록)
- `[2/2]` 실패 → Part A를 다시 실행 (main 브랜치에 미푸시 가능성)

하나라도 실패 상태로 Step 1에 진입하지 않는다. 사용자에게 "점검 실패 — 해결 후 재시도 필요" 메시지를 출력하고 중단한다.

---

## Step 1 — 이슈 선정

### 모드 A: `/implement` (자동 선택)

```bash
gh project item-list PROJECT_NUMBER --owner OWNER --format json
```

Status가 "Todo"인 첫 번째 아이템을 선택한다. 없으면 중단.

### 모드 B: `/implement #42` (번호 지정)

```bash
gh issue view 42 --repo OWNER/REPO
```

### 모드 C: `/implement --inline` (직접 입력)

사용자 입력에서 아래 항목을 파싱한다:

- **티켓 번호**: `[T-006]`, `T-006`, `티켓 번호: [T-006]` 등 어떤 형식이든 추출. 없으면 무시.
- **제목**: `제목:` 레이블 뒤 텍스트, 또는 첫 번째 의미 있는 줄.
- **본문**: 상세 설명 전체.
- **AC**: `수용 기준`, `AC:`, `- [ ]` 패턴 뒤 항목들. 없으면 본문 전체를 구현 기준으로 사용.

파싱 후 **즉시** 아래 명령을 실행하여 GitHub 이슈를 생성한다:

```bash
gh issue create \
  --repo OWNER/REPO \
  --title "ISSUE_TITLE" \
  --body "ISSUE_BODY"
```

- 티켓 번호가 있으면 제목 앞에 붙인다: `[T-006] TimerDisplay 컴포넌트 구현`
- 명령 실행 후 출력된 URL에서 이슈 번호를 추출한다 (URL 마지막 숫자)

이슈 생성 직후 보드에 등록한다:

```bash
gh project item-add PROJECT_NUMBER --owner OWNER --url ISSUE_URL
```

등록 후 2초 대기, 이후 아이템 ID를 조회하여 To Do 상태로 설정한다:

```bash
gh project item-list PROJECT_NUMBER --owner OWNER --format json --limit 100
```

조회된 아이템 중 방금 생성된 이슈 번호와 일치하는 항목의 ID를 찾는다.

```bash
gh project item-edit \
  --id ITEM_ID \
  --field-id STATUS_FIELD_ID \
  --project-id PROJECT_ID \
  --single-select-option-id TODO_OPTION_ID
```

STATUS_FIELD_ID, PROJECT_ID, TODO_OPTION_ID는 아래로 조회한다:

```bash
gh project field-list PROJECT_NUMBER --owner OWNER --format json
gh project list --owner OWNER --format json
```

---

## Step 2 — In Progress 이동 및 담당자 할당

모드 A/B의 경우 이슈가 보드에 없으면 Step 1 모드 C의 보드 등록 과정과 동일하게 추가한다.

```bash
gh project item-edit \
  --id ITEM_ID \
  --field-id STATUS_FIELD_ID \
  --project-id PROJECT_ID \
  --single-select-option-id IN_PROGRESS_OPTION_ID

gh issue edit ISSUE_NUMBER --add-assignee @me --repo OWNER/REPO
```

---

## Step 3 — 브랜치 생성

```bash
git checkout main && git pull origin main
git checkout -b BRANCH_NAME
```

브랜치 이름 규칙:
- 티켓 번호 있음: `feature/t-006-timer-display`
- 티켓 번호 없음: `feature/issue-42-login-page`

---

## Step 4 — 코드 구현

### Step 4-0 — E2E 이슈 감지 및 앱 분석 (E2E 관련 이슈 전용)

**감지**:

트리거: (a) 키워드 grep — 제목/본문/라벨에 `e2e|playwright|cypress|end.to.end|end-to-end`. (b) **L2 Vertical Slice 라벨** — `level/L2` 또는 `slice/*`. 둘 중 하나라도 해당하면 E2E 단계로 진입한다. (b)는 `/generate-issues` 개정 이후 모든 L2 슬라이스 이슈가 Playwright E2E 시나리오를 본문에 보유하도록 강제된 규정과 정합을 맞추기 위한 것으로, 이슈 본문 템플릿 문구에 의존하지 않는다.

```bash
IS_E2E=false
# (a) 키워드 매칭 (제목/본문/라벨)
echo "$ISSUE_TITLE $ISSUE_BODY" | grep -iEq "e2e|playwright|cypress|end.to.end|end-to-end" \
  && IS_E2E=true || true
echo "$ISSUE_LABELS" | grep -iEq "e2e|playwright" && IS_E2E=true || true
# (b) L2 Vertical Slice 이슈는 모두 Playwright E2E 시나리오를 포함하도록 규정되었으므로
#     level/L2 또는 slice/* 라벨이 붙은 이슈는 키워드 매칭 결과와 무관하게 E2E로 간주
echo "$ISSUE_LABELS" | grep -Eq "(^|,)[[:space:]]*level/L2([[:space:]]|,|$)|(^|,)[[:space:]]*slice/" \
  && IS_E2E=true || true
```

`IS_E2E=false`이면 이 서브스텝을 건너뛰고 일반 구현(아래)으로 진행한다.

**① dev 서버 명령·포트 파악**

```bash
node -e "const p=require('./package.json'); console.log(JSON.stringify(p.scripts, null, 2))"
```

`scripts.dev` 또는 `scripts.start`에서 DEV_CMD, DEV_PORT를 추출한다.
포트 우선순위: `--port` 옵션 > `PORT=` 환경변수 > Vite 기본값(5173) > CRA 기본값(3000).

**② React Router 라우트 추출**

```bash
grep -rn "path=" src/ --include="*.tsx" --include="*.jsx" --include="*.ts" --include="*.js" \
  2>/dev/null | grep -v "node_modules\|//\|test\|spec" | head -30
grep -rn "createBrowserRouter\|createHashRouter\|RouteObject" src/ 2>/dev/null | head -5
```

추출된 path 값들을 ROUTES 목록으로 정리한다.

**③ CRUD/인증 컴포넌트 확인**

```bash
ls src/pages/ src/views/ src/screens/ 2>/dev/null | head -20
```

`Create|List|Edit|Delete|Form|Table` → CRUD 플로우 감지
`Login|Auth|SignIn|Register` → 인증 플로우 감지

**④ 기존 E2E 설정 확인**

```bash
cat playwright.config.ts 2>/dev/null || cat playwright.config.js 2>/dev/null || echo "NO_CONFIG"
find . \( -path "*/e2e/**/*.spec.*" -o -path "*/tests/e2e/**/*.spec.*" \) \
  | grep -v node_modules | head -10
find . -type d \( -name "e2e" -o -name "playwright" \) | grep -v node_modules | head -5
```

**⑤ 테스트 파일 위치 결정**

기존 `e2e/tests/` → 그 안에 생성 / 기존 `tests/e2e/` → 그 안에 생성 / 없으면 → `tests/e2e/` (기본값)

**⑥ `playwright.config.ts` 생성/수정**

`webServer`가 없거나 목업 대상이면 아래 내용으로 생성/교체한다.
`webServer.command` = DEV_CMD, `webServer.url` = `http://localhost:DEV_PORT`, `testDir` = ⑤의 경로

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',        // ⑤에서 결정된 경로로 교체
  timeout: 30_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',  // DEV_PORT로 교체
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',       // DEV_CMD로 교체
    url: 'http://localhost:5173', // DEV_PORT로 교체
    reuseExistingServer: !process.env.CI,
  },
});
```

**⑦ `app.spec.ts` 생성 — 최소 시나리오**

분석 결과를 바탕으로 아래 시나리오를 포함하는 테스트 파일을 생성한다.

| 조건 | 시나리오 |
|------|---------|
| 항상 | 메인 페이지 로딩: `page.goto('/')` 후 타이틀 존재 확인 |
| 항상 | 라우트 접근성: ROUTES 각 path에 goto 후 404 아님 확인 |
| CRUD 감지 시 | 목록 → 생성 버튼 → 폼 표시 확인 |
| 인증 감지 시 | 로그인 페이지 UI(입력 필드, 제출 버튼) 확인 |

셀렉터는 `data-testid`, `aria-label`, 텍스트 기반 순으로 실제 앱에서 확인 후 사용한다.

**⑧ `package.json` test:e2e 스크립트 추가**

```bash
node -e "const p=require('./package.json'); console.log(p.scripts['test:e2e'] || 'MISSING')"
```

`MISSING`이면 `"test:e2e": "playwright test"`를 scripts에 추가한다.

**⑨ CI E2E 단계 추가**

```bash
grep -rn "test:e2e\|playwright" .github/workflows/ 2>/dev/null || echo "CI_E2E_MISSING"
```

`CI_E2E_MISSING`이면 기존 CI yml의 build 단계 이후에 추가한다:

```yaml
- name: Install Playwright browsers
  run: npx playwright install --with-deps chromium
- name: Run E2E tests
  run: npm run test:e2e
```

---

### Step 4-1 — 일반 구현 (모든 이슈 공통)

먼저 프로젝트 구조를 파악한다:

```bash
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.py" \) \
  | grep -v node_modules | grep -v .git | head -30
cat package.json 2>/dev/null || true
```

AC가 있으면 AC 항목 기준으로, 없으면 이슈 설명 전체를 기준으로 구현한다.
기존 코드 컨벤션(파일 구조, 네이밍, import 스타일)을 엄격히 준수한다.

---

## Step 5 — 로컬 테스트

```bash
npm run build 2>/dev/null || yarn build 2>/dev/null || true
npm test 2>/dev/null || yarn test 2>/dev/null || true
```

테스트 실패 시 코드 수정 후 재실행. 1회 재시도 후에도 실패 시 사용자에게 보고 후 중단.

---

## Step 6 — PR 생성 및 Review 이동

```bash
git add -A
git commit -m "feat: SUMMARY (closes #ISSUE_NUMBER)"
git push origin BRANCH_NAME

gh pr create \
  --repo OWNER/REPO \
  --base main \
  --title "ISSUE_TITLE (#ISSUE_NUMBER)" \
  --body "## Summary
SUMMARY

## Changes
- CHANGE_1
- CHANGE_2

Closes #ISSUE_NUMBER"
```

> **중요**: PR 본문에 반드시 `Closes #ISSUE_NUMBER` 형식을 포함한다.
> 이 키워드가 없으면 PR 머지 시 이슈가 자동으로 닫히지 않아 Done 자동 이동이 동작하지 않는다.

PR 생성 후 Review 열로 이동:

```bash
gh project item-edit \
  --id ITEM_ID \
  --field-id STATUS_FIELD_ID \
  --project-id PROJECT_ID \
  --single-select-option-id REVIEW_OPTION_ID
```

---

## Step 7 — 완료 보고

```
✅ 작업 완료

📌 이슈: #ISSUE_NUMBER ISSUE_TITLE
🌿 브랜치: BRANCH_NAME
🔗 PR: PR_URL
✔️ 테스트: 통과
📬 상태: Review로 이동 완료
🤖 자동화: PR 머지 시 'Closes #ISSUE_NUMBER' 키워드에 의해 Done으로 자동 이동됩니다
```

---

## Constraints

- 한 번에 하나의 이슈만 처리
- `gh` CLI와 `git`만 사용
- 테스트 미통과 시 PR 생성 금지

## Prerequisites

- `gh auth login` 완료
- `gh` CLI 2.x 이상, `jq` 설치
