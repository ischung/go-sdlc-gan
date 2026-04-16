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
> ℹ️ **GitHub App 설정은 자동화됨**: `APP_ID` 시크릿이 없으면 아래 스크립트가
> 브라우저를 열고 입력을 안내한다. 사용자는 **앱 이름 입력 + Create 버튼 클릭 1회**만 하면 된다.
> 이후 App ID 입력, .pem 경로 입력, 시크릿 등록, 앱 설치까지 자동 처리된다.

마커 파일 `.github/.kanban-auto-done-configured`에 `v3` 버전이 없거나 구버전 워크플로우가 감지되면 아래 자동화를 설정한다.

> **핵심 원칙**: 워크플로우 파일은 **feature 브랜치가 아닌 main에 직접 커밋**해야 한다.
> GitHub Actions는 base 브랜치(main)에 있는 워크플로우만 실행하기 때문에,
> feature 브랜치에 커밋하면 해당 PR이 머지될 때는 아직 main에 파일이 없어 첫 번째 PR부터 동작하지 않는다.

생성할 파일 3개:
- `_kanban-move.yml` — 공통 이슈 이동 로직 (reusable workflow)
- `kanban-auto-review.yml` — PR 오픈 시 Review 이동
- `kanban-auto-done.yml` — PR 머지 시 Done 이동

```bash
# ── 헬퍼: 브라우저 열기 (macOS / Linux / Windows Git Bash 대응) ──────────
_open_url() {
  local url="$1"
  if command -v open &>/dev/null; then
    open "$url"
  elif command -v xdg-open &>/dev/null; then
    xdg-open "$url"
  elif command -v start &>/dev/null; then
    start "$url"
  else
    echo "   👉 브라우저에서 직접 열기: $url"
  fi
}

# ── GitHub App 시크릿 자동 설정 (APP_ID 미등록 시에만 실행) ──────────────
if ! gh secret list --repo "$OWNER/$REPO" 2>/dev/null | grep -q "^APP_ID"; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📱 GitHub App 설정 (최초 1회 — 이후 자동 처리됨)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""

  # ── 1단계: App 생성 페이지 열기 ────────────────────────────────────────
  echo "1단계: 브라우저에서 GitHub App을 생성합니다."
  echo "       아래 설정으로 입력하고 'Create GitHub App'을 클릭하세요:"
  echo ""
  echo "       · App name      : 원하는 이름 (예: $REPO-kanban-bot)"
  echo "       · Homepage URL  : https://github.com/$OWNER/$REPO"
  echo "       · Webhook       : Active 체크 해제"
  echo "       · Permissions   :"
  echo "           Repository > Issues         : Read & Write"
  echo "           Repository > Pull requests  : Read-only"
  echo "           Account    > Projects       : Read & Write"
  echo "       · Where can this be installed   : Only on this account"
  echo ""
  _open_url "https://github.com/settings/apps/new"
  read -rp "   앱 생성 완료 후 Enter를 누르세요..."

  # ── 2단계: App ID 입력 ──────────────────────────────────────────────────
  echo ""
  echo "2단계: 생성된 앱의 App ID를 입력합니다."
  echo "       (앱 페이지 상단 'App ID: XXXXXXX' 에서 확인)"
  read -rp "   App ID: " _APP_ID_INPUT
  if [ -z "$_APP_ID_INPUT" ]; then
    echo "❌ App ID가 입력되지 않았습니다. 중단합니다."
    exit 1
  fi

  # ── 3단계: Private Key 생성 & .pem 경로 입력 ────────────────────────────
  echo ""
  echo "3단계: Private Key를 생성하고 .pem 파일을 다운로드합니다."
  echo "       앱 설정 페이지 → 'Private keys' 섹션 → 'Generate a private key'"
  _open_url "https://github.com/settings/apps"
  echo ""
  read -rp "   다운로드한 .pem 파일의 전체 경로: " _PEM_PATH
  _PEM_PATH="${_PEM_PATH/#\~/$HOME}"   # ~ 를 $HOME 으로 확장

  if [ ! -f "$_PEM_PATH" ]; then
    echo "❌ 파일을 찾을 수 없습니다: $_PEM_PATH"
    exit 1
  fi

  # ── 4단계: Repository Secrets 등록 ─────────────────────────────────────
  echo ""
  echo "4단계: Repository Secrets를 등록합니다..."
  gh secret set APP_ID --body "$_APP_ID_INPUT" --repo "$OWNER/$REPO"
  gh secret set APP_PRIVATE_KEY < "$_PEM_PATH" --repo "$OWNER/$REPO"
  echo "   ✅ APP_ID, APP_PRIVATE_KEY 등록 완료"

  # ── 5단계: 앱을 저장소에 Install ────────────────────────────────────────
  echo ""
  echo "5단계: 앱을 저장소에 설치합니다."
  echo "       앱 설정 페이지 → 'Install App' 탭 → 저장소 선택"
  _open_url "https://github.com/settings/apps"
  read -rp "   앱 설치 완료 후 Enter를 누르세요..."

  echo ""
  echo "✅ GitHub App 설정 완료 (APP_ID, APP_PRIVATE_KEY 등록됨)"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
fi

# ── 워크플로우 파일 생성 ─────────────────────────────────────────────────
# 이 코드는 Step 3(브랜치 생성) 이전, main 브랜치 위에서 실행한다.
# 아래 두 조건 중 하나라도 해당하면 워크플로우를 재생성한다.
#   1) 마커 파일에 v3 버전 없음 (최초 설치 / 이전 버전 마커)
#   2) 워크플로우에 APP_ID 없음 (KANBAN_TOKEN 방식 또는 gh CLI 방식 → GitHub App으로 강제 전환)
# 버전 업 시 v3 → v4로 바꾸면 기존 배포 전체가 다음 /implement 실행 때 자동 갱신된다.
if ! grep -q "^v3 " .github/.kanban-auto-done-configured 2>/dev/null || \
   ! grep -q "APP_ID" .github/workflows/_kanban-move.yml 2>/dev/null; then
  echo "🔧 칸반 자동화 설정 중 (신규 또는 구버전 업그레이드)..."

  mkdir -p .github/workflows

  # ── 1) 공통 reusable workflow ──────────────────────────────────────
  cat > .github/workflows/_kanban-move.yml << 'GHACTIONS'
# 재사용 가능한 공통 워크플로우 — 칸반 이슈 상태 이동 (GitHub App 방식)
#
# 필수 사전 설정 (저장소 Secrets):
#   APP_ID          — GitHub App의 App ID 숫자값
#   APP_PRIVATE_KEY — GitHub App의 Private Key (.pem 파일 전체 내용)
#
# [보안] PR 본문을 workflow input으로 전달하지 않고 API로 직접 조회합니다.
#   pr_number(숫자)만 전달하고 본문은 Node.js(actions/github-script)로
#   REST API를 통해 안전하게 문자열로 읽습니다. (expression injection 방지)
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
      APP_ID:
        required: true
      APP_PRIVATE_KEY:
        required: true

jobs:
  move:
    runs-on: ubuntu-latest
    steps:
      - name: Generate GitHub App token
        id: app-token
        uses: actions/create-github-app-token@v1
        with:
          app-id: ${{ secrets.APP_ID }}
          private-key: ${{ secrets.APP_PRIVATE_KEY }}

      - name: Move linked issues to ${{ inputs.status }}
        uses: actions/github-script@v7
        env:
          TARGET_STATUS: ${{ inputs.status }}
          PR_NUMBER: ${{ inputs.pr_number }}
          KANBAN_PROJECT_NUMBER: ${{ vars.KANBAN_PROJECT_NUMBER }}
        with:
          github-token: ${{ steps.app-token.outputs.token }}
          script: |
            const targetStatus = process.env.TARGET_STATUS;
            const prNumber = parseInt(process.env.PR_NUMBER, 10);
            const owner = context.repo.owner;
            const repo = context.repo.repo;

            // 1. PR 본문을 REST API로 안전하게 조회 (expression injection 없음)
            const { data: pr } = await github.rest.pulls.get({ owner, repo, pull_number: prNumber });
            const prBody = pr.body || '';

            // 2. PR 본문에서 이슈 번호 추출 (closes/fixes/resolves #N)
            const issueNumbers = [...prBody.matchAll(/(closes?|fixes?|resolves?)\s+#(\d+)/gi)]
              .map(m => parseInt(m[2], 10));

            if (issueNumbers.length === 0) {
              core.info('링크된 이슈 없음. 종료.');
              return;
            }
            core.info(`추출된 이슈 번호: ${issueNumbers.join(', ')}`);

            // 3. 프로젝트 번호 결정
            let projectNumber = parseInt(process.env.KANBAN_PROJECT_NUMBER || '0', 10);
            if (!projectNumber) {
              const { data: { repositoryOwner } } = await github.graphql(`
                query($owner: String!) {
                  repositoryOwner(login: $owner) {
                    ... on Organization { projectsV2(first:1, orderBy:{field:UPDATED_AT, direction:DESC}) { nodes { number } } }
                    ... on User        { projectsV2(first:1, orderBy:{field:UPDATED_AT, direction:DESC}) { nodes { number } } }
                  }
                }`, { owner });
              projectNumber = repositoryOwner.projectsV2.nodes[0]?.number;
            }
            if (!projectNumber) { core.setFailed('프로젝트 번호를 찾을 수 없습니다.'); return; }
            core.info(`PROJECT_NUMBER=${projectNumber}`);

            // 4. 프로젝트 ID 및 Status 필드 조회
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
            core.info(`STATUS_FIELD_ID=${statusFieldId}, TARGET_OPTION_ID=${targetOptionId}`);

            // 5. 각 이슈를 대상 상태로 이동
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

              core.info(`✅ 이슈 #${issueNum} ${targetStatus} 이동 완료`);
            }
GHACTIONS

  # ── 2) PR 오픈 → Review 이동 ──────────────────────────────────────
  cat > .github/workflows/kanban-auto-review.yml << 'GHACTIONS'
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
GHACTIONS

  # ── 3) PR 머지 → Done 이동 ────────────────────────────────────────
  cat > .github/workflows/kanban-auto-done.yml << 'GHACTIONS'
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
GHACTIONS

  # ── 마커 파일 생성 (버전 포함 — 다음 버전 업 시 v3 → v4로만 바꾸면 됨) ──
  echo "v3 configured $(date -u +%Y-%m-%dT%H:%M:%SZ)" > .github/.kanban-auto-done-configured

  # ── main에 직접 커밋 & 푸시 (feature 브랜치 생성 전에 반드시 실행) ──
  git add .github/workflows/_kanban-move.yml \
          .github/workflows/kanban-auto-review.yml \
          .github/workflows/kanban-auto-done.yml \
          .github/.kanban-auto-done-configured
  git commit -m "chore: add kanban automation workflows (reusable pattern)"
  git push origin main

  echo ""
  echo "✅ 칸반 자동화 설정 완료 (main에 직접 커밋됨)"
  echo "   · _kanban-move.yml       → 공통 이슈 이동 로직"
  echo "   · kanban-auto-review.yml → PR 오픈 시 Review 이동"
  echo "   · kanban-auto-done.yml   → PR 머지 시 Done 이동"
  echo "   💡 PR 본문에 'Closes #이슈번호'를 포함하면 자동으로 이동합니다."
  echo "   ⚠️  secrets.APP_ID / APP_PRIVATE_KEY 미설정 시 Actions 실행 시 오류 발생합니다."
fi
```

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
