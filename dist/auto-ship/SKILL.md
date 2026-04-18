---
name: auto-ship
description: >
  GitHub Projects의 Todo 이슈를 구현부터 CI/CD 파이프라인 통과까지 end-to-end로 완전 자동화하는 스킬.
  단일 이슈(/ship)와 Todo 전체 일괄 처리(/ship-all) 두 가지 모드를 제공하며,
  CI/CD 실패 시 실패 로그를 분석하여 자동 수정 후 재검사하는 피드백 루프를 내장한다.
  최대 3회 재시도 후에도 실패하면 사용자에게 수동 개입을 요청한다.
  사용자가 "/ship", "/ship-all", "이슈 자동 배포해줘", "Todo 이슈 전부 처리해줘",
  "CI/CD 통과할 때까지 자동으로 해줘", "이슈 전체 자동 ship", "배포까지 자동화해줘",
  "모든 이슈 자동 구현 및 배포", "이슈 끝날 때까지 돌려줘", "전체 이슈 자동으로 해줘" 등을
  언급하면 반드시 이 스킬을 사용할 것.
  단일 이슈 처리("/ship #42", "이슈 42번 ship해줘") 요청에도 이 스킬을 사용할 것.
---

# Auto-Ship 스킬

## Commands

| 커맨드 | 설명 |
|--------|------|
| `/ship` | Todo 최상단 이슈 자동 선택 → 구현 → CI/CD 통과까지 처리 |
| `/ship #42` | 이슈 번호 지정 → 구현 → CI/CD 통과까지 처리 |
| `/ship-all` | Todo 이슈 전체를 DAG 레벨 순서로 순차 처리 |

---

## Role

너는 이 프로젝트의 **풀사이클 자동화 AI 개발자**다.
`/implement`가 PR 생성에서 멈추는 것과 달리, `/ship`은 **CI/CD 파이프라인 통과까지** 책임진다.
실패 로그를 읽고 스스로 수정하며, 최대 3회 재시도 후에도 해결 불가능한 경우에만 사용자에게 보고한다.
**한 번에 하나의 이슈만** 처리한다.

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

현재 기본 브랜치도 확인한다:

```bash
gh repo view --json defaultBranchRef -q '.defaultBranchRef.name'
```

---

## Step 0.5 — 칸반 자동화 워크플로우 확인

`github-flow-impl` 스킬의 Step 0.5 ~ Step 0.6과 동일한 절차를 따른다.

아래 명령으로 마커 파일을 확인한다:

```bash
(grep -q "^v5 " .github/.kanban-auto-done-configured 2>/dev/null && grep -q "KANBAN_TOKEN" .github/workflows/_kanban-move.yml 2>/dev/null && grep -q "Check secrets configured" .github/workflows/_kanban-move.yml 2>/dev/null) && echo "SKIP" || echo "NEED_SETUP"
```

결과가 **"SKIP"**이면 이 단계를 건너뛴다.
결과가 **"NEED_SETUP"**이면 `github-flow-impl` 스킬의 Step 0.5 절차에 따라 칸반 자동화를 설정한다.

---

## Step 1 — 이슈 선정

### 모드 A: `/ship` (자동 선택)

```bash
gh project item-list PROJECT_NUMBER --owner OWNER --format json --limit 200
```

Status가 "Todo"인 첫 번째 아이템을 선택한다. 없으면 아래를 출력하고 중단한다:

```
ℹ️  Todo에 이슈가 없습니다. 칸반 보드를 확인하세요: /kanban-status
```

### 모드 B: `/ship #N` (번호 지정)

```bash
gh issue view N --repo OWNER/REPO --json number,title,body,labels
```

이슈 정보(번호, 제목, 본문, 수락 기준)를 파싱한다.

---

## Step 2 — In Progress 이동 및 담당자 할당

GraphQL로 PROJECT_ID, STATUS_FIELD_ID, IN_PROGRESS_OPTION_ID를 조회한 뒤:

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
git checkout DEFAULT_BRANCH && git pull origin DEFAULT_BRANCH
git checkout -b BRANCH_NAME
```

브랜치 이름 규칙: `feature/issue-42-이슈-제목-슬러그`
(공백은 `-`로, 특수문자 제거, 소문자, 최대 50자)

---

## Step 4 — 코드 구현 (Generator, iter = 1)

이슈가 E2E 관련인 경우(제목·본문에 `e2e`, `playwright`, `cypress`, `end-to-end` 포함),
`github-flow-impl` 스킬의 **Step 4-0(E2E 이슈 감지 및 앱 분석)** 서브스텝을 먼저 실행하여
앱 라우트·컴포넌트·dev 서버 정보를 분석하고 playwright 테스트 파일을 자동 생성한다.
테스트 파일 생성 완료 후 아래 일반 구현 절차를 이어서 진행한다.

이후 `github-flow-impl` 스킬의 **Step 4**와 동일하게 진행한다 — `sdlc-code-generator` 서브에이전트(Sonnet 4.6) 호출.
`--no-eval` 플래그가 있으면 Claude가 직접 구현.

---

## Step 4.5 — Contracting (AC → TC 잠금)

> `--no-eval` 모드에서는 건너뛴다.

`github-flow-impl` 스킬의 **Step 4.5** 절차를 그대로 수행한다.
`sdlc-contracting` 서브에이전트(Sonnet 4.6)를 호출하여 `docs/evaluations/issue-<N>/sprint-contract.md`를 생성·승인한다.

---

## Step 5 — 로컬 테스트 (Generator 자가 검증)

```bash
npm run build 2>&1 | tail -80
npm test 2>&1 | tail -120
```

`github-flow-impl` 스킬의 **Step 5**와 동일하게, build/test 결과를 stdout에 보존하고 **중단하지 않고** Step 5.5로 넘어간다(Evaluator가 판정).
`--no-eval` 모드에서는 기존 동작(실패 시 1회 재시도 후 중단)을 따른다.

---

## Step 5.5 — Evaluator (QA 채점)

> `--no-eval` 모드에서는 건너뛴다.

`github-flow-impl` 스킬의 **Step 5.5** 절차를 그대로 수행한다.
`sdlc-code-evaluator` 서브에이전트(Opus 4.7)를 호출하여 `qa-report-iter-<K>.md`를 생성한다.

---

## Step 5.6 — 분기 (로컬 GAN 루프 제어)

> `--no-eval` 모드에서는 건너뛴다.

`github-flow-impl` 스킬의 **Step 5.6** 분기 로직을 그대로 따른다:
- `VERDICT=PASS` → Step 6 (PR 생성)
- `VERDICT=FAIL` AND iter 미만 → Step 4로 재진입 (feedback 주입)
- `VERDICT=FAIL` AND (iter 초과 OR plateau) → 사용자 회부, Step 7 진입 금지

> **중요 — 두 개의 독립 루프**:
> - **로컬 GAN 루프 (Step 4 ↔ 5.5)**: 비즈니스 로직·사용자 가치 검증. `IMPL_ITER_MAX=3`.
> - **원격 CI 루프 (Step 7)**: 파이프라인·환경 호환성. `RETRY_COUNT=3`.
> 두 카운터는 **독립**이며, 로컬 루프를 통과한 뒤에만 원격 루프에 진입한다.

---

## Step 6 — PR 생성

```bash
git add -A
git commit -m "feat: SUMMARY (closes #ISSUE_NUMBER)"
git push origin BRANCH_NAME
```

```bash
PR_URL=$(gh pr create \
  --repo OWNER/REPO \
  --base DEFAULT_BRANCH \
  --title "ISSUE_TITLE (#ISSUE_NUMBER)" \
  --body "## Summary
SUMMARY

## Changes
- CHANGE_1
- CHANGE_2

Closes #ISSUE_NUMBER" \
  --output json | jq -r '.url' 2>/dev/null)
```

`PR_URL`을 이후 단계에서 사용할 수 있도록 저장한다.

---

## Step 7 — CI/CD 모니터링 루프 (핵심)

이 단계가 `/ship`을 `/implement`와 구별하는 핵심이다.
`RETRY_COUNT=0`으로 시작하여 최대 3회까지 반복한다.

### 7.1 — CI/CD checks 존재 여부 확인

PR 생성 직후 30초 대기 후 checks를 확인한다:

```bash
sleep 30
CHECKS_COUNT=$(gh pr checks "$PR_URL" --json name 2>/dev/null | jq 'length' 2>/dev/null || echo "0")
```

`CHECKS_COUNT`가 0이면 CI/CD 파이프라인이 없는 저장소로 판단하고 아래를 출력한 뒤 Step 8로 진행한다:

```
ℹ️  CI/CD 파이프라인이 없습니다. PR이 생성되었으니 리뷰어가 확인 후 머지해 주세요.
   파이프라인 구축이 필요하면: /cicd-pipeline
```

### 7.2 — CI/CD 상태 폴링

`--watch` 지원 여부를 먼저 확인한다:

```bash
gh pr checks --help 2>/dev/null | grep -q "watch" && echo "WATCH_SUPPORTED" || echo "POLL_MODE"
```

**WATCH_SUPPORTED**이면:
```bash
gh pr checks "$PR_URL" --watch --interval 30
```

**POLL_MODE**이면 아래 폴링 루프를 사용한다:

```bash
while true; do
  RESULT=$(gh pr checks "$PR_URL" --json name,state,conclusion 2>/dev/null)
  PENDING=$(echo "$RESULT" | jq '[.[] | select(.conclusion == null or .conclusion == "" or .state == "IN_PROGRESS" or .state == "QUEUED")] | length' 2>/dev/null || echo "1")
  FAILURES=$(echo "$RESULT" | jq '[.[] | select(.conclusion == "FAILURE" or .conclusion == "failure" or .conclusion == "error" or .conclusion == "cancelled")] | length' 2>/dev/null || echo "0")

  if [ "$FAILURES" -gt "0" ]; then
    echo "CI/CD 실패 감지 ($FAILURES개)"
    break
  elif [ "$PENDING" -eq "0" ]; then
    echo "CI/CD 전체 완료"
    break
  fi
  echo "CI/CD 진행 중 (pending: $PENDING개)... 30초 후 재확인"
  sleep 30
done
```

### 7.3 — 결과 판정

```bash
FINAL_FAILURES=$(gh pr checks "$PR_URL" --json conclusion 2>/dev/null \
  | jq '[.[] | select(.conclusion == "FAILURE" or .conclusion == "failure" or .conclusion == "error")] | length' 2>/dev/null || echo "0")
```

- `FINAL_FAILURES == 0` → Step 8로 진행 (성공)
- `FINAL_FAILURES > 0` → Step 7.4로 진행 (실패 처리)

### 7.4 — 실패 로그 수집 및 자동 수정

```bash
RETRY_COUNT=$((RETRY_COUNT + 1))
```

**RETRY_COUNT가 3 초과이면** Step 7.5(한계 보고)로 진행한다.

**RETRY_COUNT가 3 이하이면** 아래 절차를 진행한다:

**① 실패 로그 수집**

```bash
FAILED_RUN_ID=$(gh run list \
  --branch "$BRANCH_NAME" \
  --repo "$OWNER/$REPO" \
  --status failure \
  --limit 1 \
  --json databaseId \
  -q '.[0].databaseId' 2>/dev/null)

FAILED_LOG=$(gh run view "$FAILED_RUN_ID" \
  --repo "$OWNER/$REPO" \
  --log-failed 2>&1 | head -200)

echo "=== CI/CD 실패 로그 (재시도 ${RETRY_COUNT}/3) ==="
echo "$FAILED_LOG"
```

**② 실패 원인 분석**

로그에서 아래 패턴을 분석한다:
- `Error:`, `FAIL`, `error:`, `failed` 키워드가 포함된 줄
- 스택 트레이스 (at 으로 시작하는 줄들)
- 어떤 테스트/빌드 단계에서 실패했는지 (step 이름)
- 실패한 파일 경로와 줄 번호

추가로 아래 **구조적 실패 패턴**을 우선 확인한다:

| 패턴 | 감지 방법 | 자동 수정 방법 |
|------|-----------|---------------|
| `package-lock.json` 없음 | 로그에 "Dependencies lock file is not found" | `npm install` 실행 후 `package-lock.json` 커밋 |
| CI에 E2E 단계 누락 | `.github/workflows/*.yml`에 `test:e2e` / `playwright` 키워드 없음 | CI yml에 `Build → playwright install → test:e2e` 단계 추가 |
| E2E가 목업 HTML을 대상으로 함 | `playwright.config.*`의 `webServer.url`이 `file://` 이거나 `webServer` 자체 없음, 또는 `e2e/public/*.html` 파일 존재 | `playwright.config`의 `webServer`를 실제 앱 devServer(`npm run dev`, `localhost:5173`)로 교체 |
| Build 없이 E2E 실행 | CI yml에서 E2E 단계가 Build 이전에 위치 | CI yml에서 E2E 단계를 Build 단계 이후로 이동 |
| Import / 모듈 누락으로 빌드 실패 | 로그에 `Cannot find module`, `Module not found`, `is not defined` | 해당 파일의 import 구문 추가 또는 경로 수정 |

E2E 관련 패턴이 감지되면 **코드 수정에 앞서 CI yml과 playwright.config를 먼저 수정**한다. 소스 코드 버그보다 파이프라인 구조 문제가 더 근본적이기 때문이다.

**③ 코드 수정**

분석 결과를 바탕으로 관련 소스 파일을 수정한다.
수정 후 로컬 테스트를 재실행하여 수정 사항을 검증한다:

```bash
npm test 2>/dev/null || yarn test 2>/dev/null || true
```

**④ 수정 사항 push**

```bash
git add -A
git commit -m "fix: CI 실패 수정 - ${RETRY_COUNT}회차 (closes #ISSUE_NUMBER)"
git push --force-with-lease origin "$BRANCH_NAME"
```

> **중요**: `--force`는 사용 금지. 반드시 `--force-with-lease`를 사용한다.

**⑤ Step 7.1로 돌아가 30초 대기 후 재폴링**

```bash
sleep 30
```

### 7.5 — 최대 재시도 초과 보고

`RETRY_COUNT`가 3을 초과하면 자동 수정을 중단하고 아래를 출력한다:

```
⚠️  CI/CD 자동 수정 한계 도달

이슈:     #ISSUE_NUMBER ISSUE_TITLE
브랜치:   BRANCH_NAME
PR:       PR_URL
재시도:   3/3 (전부 실패)

마지막 실패 로그 요약:
──────────────────────────────────────────
FAILED_LOG_SUMMARY (최대 20줄)
──────────────────────────────────────────

자동 수정으로 해결하지 못했습니다. 다음 중 하나를 선택해 주세요:
  1) 위 로그를 보고 직접 수정 후: git push --force-with-lease origin BRANCH_NAME
  2) 새 세션에서 재시도: /ship #ISSUE_NUMBER
  3) 이 이슈를 건너뛰고 계속: /ship-all --skip #ISSUE_NUMBER
```

---

## Step 8 — 자동 머지 및 완료 보고

CI/CD 전체 통과 시, 즉시 PR을 자동으로 머지한다:

```bash
gh pr merge "$PR_URL" --squash --delete-branch
```

머지 실패(브랜치 보호 규칙 등)한 경우 아래를 출력하고 사용자에게 수동 머지를 요청한다:

```
⚠️  자동 머지 실패: 브랜치 보호 규칙 또는 권한 문제
   PR: PR_URL
   수동으로 머지해 주세요.
```

머지 성공 시:

```
✅ Ship 완료!

📌 이슈:   #ISSUE_NUMBER ISSUE_TITLE
🌿 브랜치: BRANCH_NAME
🔗 PR:     PR_URL
🔁 재시도: RETRY_COUNT회
✔️  CI/CD:  전체 통과
🔀 머지:   자동 squash 머지 완료 → 칸반 Done 자동 이동
```

---

## Constraints

- `--force`는 절대 사용 금지. 반드시 `--force-with-lease`를 사용한다.
- 로컬 테스트가 실패한 상태에서 push하지 않는다.
- 재시도 최대 3회 초과 시 자동 수정을 중단하고 사용자에게 보고한다.
- `gh` CLI와 `git`만 사용한다.
- CI/CD 통과 후 자동으로 squash 머지한다. 머지 실패 시에만 사용자에게 수동 머지를 요청한다.

## Prerequisites

- `gh auth login` 완료
- `gh` CLI 2.x 이상, `jq` 설치
- CI/CD 파이프라인이 있는 저장소 권장 (없어도 graceful skip으로 동작함)
