---
name: ci-cd-pipeline
description: >
  숙련된 DevOps 전문가로서 프로젝트 아키텍처를 분석하고, GitHub Actions 기반의
  전체 CI/CD 파이프라인 구축에 필요한 이슈들을 자동 생성한 뒤 "cicd-issues.md" 파일에
  저장하는 스킬.
  Static Analysis → Security Scan → Unit/Integration Test (CI Gate) →
  Docker Build & Push → Container Security Scan → Staging 배포 →
  E2E Test → GitHub Pages 배포 → Smoke Test 전 과정을 커버한다.
  사용자가 "CI/CD 파이프라인 만들어줘", "GitHub Actions 설정해줘",
  "파이프라인 이슈 생성해줘", "cicd 이슈 만들어줘", "/cicd-pipeline",
  "CI/CD 자동화 구성해줘" 등을 언급하면 반드시 이 스킬을 사용할 것.
---

# CI/CD Pipeline Issue Generator 스킬

이 스킬은 숙련된 DevOps 전문가 역할을 수행하여 프로젝트 아키텍처를 분석하고,
GitHub Actions 기반의 자동화 파이프라인 구축에 필요한 이슈들을 생성하여
"cicd-issues.md" 파일에 저장한다.

---

## When to run — 실행 시점 가이드

이 스킬은 **Kanban 보드 생성 직후, 첫 `/implement` 이전**에 실행하는 것이 이상적이다.

근거:
1. **Shift Left 원칙**: CI Gate가 첫 PR부터 작동해야 회귀가 누적되지 않는다
2. **TDD와 맞물림**: `/tdd`의 Green을 자동 검증하는 것이 CI의 본질
3. **레벨별 병렬 구현 유도**: 생성되는 이슈는 DAG의 각 레벨에서 독립적으로 진행 가능
   - **L0~L1** (Cleanup + Static + CI Gate) → 즉시 구현, MVP 기능 작업과 병행
   - **L2~L3** (Docker + Pages + Scan + Staging/E2E) → MVP 완성 후 순차/병렬 구현

각 이슈 제목에는 DAG 레벨(`[L0]`, `[L1]`, `[L2]`, `[L3]`)이 붙고, 본문에는 선행 이슈 번호가 명시된다. 동일 레벨 이슈는 서로 의존하지 않으므로 **두 명 이상의 학생이 한 팀에서 서로 다른 브랜치로 병렬 작업 가능**하다.

권장 SDLC 체인은 루트 README의 "권장 실행 순서" 섹션을 참고.

---

## 실행 모드 및 멱등성 가드 (모든 Step 진입 전 필수)

사용자 인자(`$ARGUMENTS`)에 따라 실행 모드를 결정하고, 이미 `cicd-issues.md`가
존재하는 경우 중복 이슈 생성을 방지한다.

```bash
ARGS="$ARGUMENTS"
MODE=run                                     # 기본값: 실제 실행
case "$ARGS" in
  *"--dry-run"*) MODE=dry-run ;;
  *"--force"*)   MODE=force ;;
esac

if [ -f cicd-issues.md ] && [ "$MODE" = "run" ]; then
  echo "cicd-issues.md가 이미 존재합니다."
  echo "→ 변경사항 재확인만 원하면: /cicd-pipeline --dry-run"
  echo "→ 기존 목록을 무시하고 강제 재생성: /cicd-pipeline --force"
  exit 0
fi

echo "MODE=$MODE 로 실행합니다."
```

`MODE`는 이후 Step 2(이슈 생성), Step 3(파일 저장), Step 4(칸반 등록)에서
실제 부수효과 명령을 실행할지 판단하는 가드로 사용된다.

- `run` → 모든 생성 작업 실행
- `dry-run` → `gh issue create`, `cat > cicd-issues.md`, `gh project item-add` 전부 생략. 대신 "생성 예정" 문구와 함께 계획만 출력
- `force` → `run`과 동일하되 기존 파일 덮어쓰기 허용

---

## Step 0 — 환경 감지

아래 명령들을 실행하여 프로젝트 환경을 파악한다.

```bash
# 리포지토리 정보 확인
git remote get-url origin
gh repo view --json owner,name,defaultBranchRef -q '"OWNER=\(.owner.login) REPO=\(.name) DEFAULT_BRANCH=\(.defaultBranchRef.name)"'
```

```bash
# 언어/프레임워크 감지
ls package.json requirements.txt pom.xml build.gradle go.mod Cargo.toml 2>/dev/null | head -5
cat package.json 2>/dev/null | grep -E '"scripts"|"dependencies"|"devDependencies"' | head -20 || true
```

```bash
# 기존 CI/CD 워크플로우 확인
ls .github/workflows/ 2>/dev/null && cat .github/workflows/*.yml 2>/dev/null | head -80 || echo "CI/CD 없음"
```

```bash
# 테스트 구조 확인
find . -type d -name "__tests__" -o -name "tests" -o -name "test" -o -name "spec" \
  | grep -v node_modules | grep -v .git | head -10
find . -name "*.test.*" -o -name "*.spec.*" | grep -v node_modules | grep -v .git | head -10
find . -name "jest.config*" -o -name "vitest.config*" -o -name "pytest.ini" \
  -o -name "playwright.config*" -o -name "cypress.config*" \
  | grep -v node_modules | grep -v .git | head -5
```

```bash
# Docker 구성 확인
ls Dockerfile docker-compose.yml docker-compose.yaml 2>/dev/null || echo "Docker 없음"
```

```bash
# E2E 테스트 확인
find . -type d -name "e2e" -o -name "cypress" -o -name "playwright" \
  | grep -v node_modules | grep -v .git | head -5
```

```bash
# E2E webServer 설정 확인 — 실제 앱을 대상으로 하는지 검사
cat playwright.config.ts playwright.config.js 2>/dev/null | grep -A5 "webServer" || echo "webServer 설정 없음"
# 목업 HTML 존재 여부 확인
find . -path "*/e2e/public/*.html" -o -path "*/e2e/*.html" \
  | grep -v node_modules | grep -v .git | head -5
# CI 워크플로우에 E2E 단계 포함 여부 확인
grep -r "test:e2e\|playwright\|cypress" .github/workflows/ 2>/dev/null || echo "CI에 E2E 없음"
```

위 분석 결과를 바탕으로 다음 항목들의 존재 여부를 정리한다:

| 항목 | 존재 여부 | 비고 |
|------|-----------|------|
| 기존 CI/CD 워크플로우 | O/X | 파일명 |
| Unit Test | O/X | 디렉토리/설정파일 |
| Integration Test | O/X | 디렉토리/설정파일 |
| Docker 설정 | O/X | Dockerfile 등 |
| E2E 테스트 | O/X | 프레임워크명 |
| E2E가 CI에 포함됨 | O/X | CI yml에 test:e2e/playwright 존재 여부 |
| E2E webServer가 실제 앱 대상 | O/X | playwright.config의 webServer.url이 실제 devServer인지, 목업 HTML인지 |
| GitHub Pages 설정 | O/X | - |

---

## Step 1 — Gap Analysis 및 이슈 목록 결정

환경 감지 결과를 바탕으로 생성할 이슈 목록을 결정한다.

**반드시 생성하는 이슈 (필수)**:

1. 기존 CI/CD 워크플로우가 있다면: 기존 파이프라인 제거/정리 이슈 포함
2. CI 파이프라인 구축 — Static Analysis 및 Security Scan 단계
3. CI 파이프라인 구축 — Unit Test 및 Integration Test 단계 (CI Gate)
4. CD 파이프라인 구축 — Docker Build 및 Push (불변 이미지, 레이어 캐싱)
5. CD 파이프라인 구축 — Container Security Scan
6. CD 파이프라인 구축 — Staging 환경 배포 및 E2E 테스트 (실제 앱 대상 필수)
7. CD 파이프라인 구축 — GitHub Pages 정적 배포 및 Smoke Test

**E2E Gap Analysis — 이슈 6 생성 전 필수 확인**:

Step 0의 E2E 감지 결과에 따라 노드 6 이슈 본문에 아래 조건을 반드시 반영한다:

| 감지 결과 | 이슈 본문에 추가할 내용 |
|-----------|------------------------|
| CI yml에 E2E 단계 없음 | "CI에 Build 후 E2E 단계를 추가한다 (`npm run build` → `playwright install` → `npm run test:e2e`)" 명시 |
| `playwright.config`의 `webServer`가 없거나 목업 HTML 대상 | "`webServer.command`를 실제 앱 개발 서버 (`npm run dev` 등)로 교체하고, `url`을 `http://localhost:5173`(또는 실제 포트)으로 설정한다" 명시 |
| `e2e/public/*.html` 목업 파일 존재 | "목업 HTML 대신 실제 앱을 기동하여 E2E를 실행하도록 `playwright.config` 교체가 필요하다" 명시 |
| E2E 자체가 없음 | "Playwright 설치 및 기본 테스트 스크립트 생성" 명시 (기존 조건부 요건과 동일) |

**조건부 요건 (별도 이슈를 생성하지 않고 기존 이슈 본문에 흡수)**:

아래 항목들은 환경 감지 결과에 따라 Step 2의 기존 이슈 본문에 "해당 구조가 없으면 생성한다" 조항을 덧붙이는 방식으로 처리한다. 별도 이슈로 쪼개면 구현 순서가 꼬이고 학생이 혼란스러워진다.

- Unit/Integration Test 디렉토리 부재 → **이슈 3** 본문에 "tests/unit, tests/integration 디렉토리가 없으면 생성" 명시
- E2E 환경 부재(Playwright/Cypress 미설치) → **이슈 6** 본문에 "Playwright 설치 및 tests/e2e 기본 스크립트 생성" 명시
- Dockerfile 부재 → **이슈 4** 본문에 "Dockerfile이 없으면 프로젝트 특성에 맞게 기본 Dockerfile 생성" 명시

즉, **이슈 총 개수는 기존 CI/CD 유무에 따라 6개(이슈 1 제외) 또는 7개로 고정**된다.

---

## Step 1.5 — 라벨 준비 (이슈 생성 전 필수)

`gh issue create --label X`는 리포지토리에 `X` 라벨이 없으면 실패한다. 신규 리포에서 첫 실행이 실패하는 것을 방지하기 위해, 이슈 생성 전에 필요한 라벨 9종을 멱등적으로 준비한다.

```bash
[ "$MODE" != "dry-run" ] && {
  OWNER=$(gh repo view --json owner -q '.owner.login')
  REPO=$(gh repo view --json name -q '.name')
  for LABEL in ci/cd ci cd security testing docker cleanup e2e deployment; do
    gh label create "$LABEL" --repo "$OWNER/$REPO" --color ededed 2>/dev/null || true
  done
}
```

`|| true`로 이미 존재하는 라벨은 조용히 건너뛴다. `dry-run` 모드에서는 실행하지 않는다.

---

## Step 2 — GitHub 이슈 생성 (DAG 기반)

각 이슈를 GitHub에 생성한다. 이슈 본문은 마크다운 기호 없이 서술형 문장으로 작성한다.

**이슈 제목 접두어**: `[L<레벨>][<그룹>]` 형식. 같은 `L<n>` 접두어를 가진 이슈들은 서로 **의존하지 않으므로 병렬 구현 가능**하다. 본문 끝에 `선행 이슈: #X, #Y` 라인을 덧붙여 다음 레벨로 넘어갈 조건을 명시한다.

**DAG 레벨 매핑**:

| 노드 | 레벨 | 그룹 | 선행 노드 | 의미 |
|------|------|------|----------|------|
| 1 | L0 | CI/CD | 없음 | 기존 CI/CD 정리 (해당 시에만) |
| 2 | L1 | CI | 1 | Static Analysis + Security Scan |
| 3 | L1 | CI | 1 | Unit/Integration Test (CI Gate) |
| 4 | L2 | CD | 3 | Docker Build & Push |
| 7 | L2 | CD | 3 | GitHub Pages + Smoke Test |
| 5 | L3 | CD | 4 | Container Security Scan |
| 6 | L3 | CD | 4 | Staging 배포 + E2E Test |

```bash
OWNER=$(gh repo view --json owner -q '.owner.login')
REPO=$(gh repo view --json name -q '.name')

# 노드 번호별 이슈 번호 저장소 — create_issue가 채운다
NUM_1="" NUM_2="" NUM_3="" NUM_4="" NUM_5="" NUM_6="" NUM_7=""

# 이슈 생성 헬퍼 — 레벨·그룹·선행 노드 목록을 명시
create_issue() {
  local NODE="$1"        # 1~7 (결과 저장 위치)
  local LEVEL="$2"       # L0/L1/L2/L3
  local GROUP="$3"       # CI/CD, CI, CD
  local TITLE="$4"       # 이슈 제목 본문 (접두어 제외)
  local BODY="$5"        # 이슈 본문
  local LABELS="$6"      # 쉼표 구분 라벨
  local DEPS="$7"        # 공백 구분 선행 노드 번호 (예: "3" 또는 "3 4" 또는 "")

  local FULL_TITLE="[${LEVEL}][${GROUP}]${TITLE}"
  local FULL_BODY="${BODY}"

  if [ -n "$DEPS" ]; then
    local DEP_LIST=""
    for D in $DEPS; do
      local VAR="NUM_${D}"
      local VAL="${!VAR}"
      [ -n "$VAL" ] && DEP_LIST="${DEP_LIST}#${VAL}, "
    done
    DEP_LIST="${DEP_LIST%, }"
    if [ -n "$DEP_LIST" ]; then
      FULL_BODY="${FULL_BODY}

선행 이슈: ${DEP_LIST}
병렬 가능 여부: 같은 ${LEVEL} 레벨의 다른 이슈와 독립적으로 구현 가능"
    fi
  else
    FULL_BODY="${FULL_BODY}

선행 이슈: 없음 (최초 진입점)"
  fi

  if [ "$MODE" = "dry-run" ]; then
    echo "[DRY-RUN] ${LEVEL} 생성 예정: ${FULL_TITLE}  (의존: ${DEPS:-none})"
    eval "NUM_${NODE}='?${NODE}?'"
  else
    local URL
    URL=$(gh issue create --repo "$OWNER/$REPO" \
      --title "$FULL_TITLE" \
      --body "$FULL_BODY" \
      --label "$LABELS")
    local NEW_NUM
    NEW_NUM=$(basename "$URL")
    eval "NUM_${NODE}=${NEW_NUM}"
    echo "생성됨(${LEVEL}): #${NEW_NUM} ${FULL_TITLE}"
  fi
}
```

아래 이슈 템플릿을 위 `create_issue` 헬퍼로 **DAG 레벨 순서대로** 호출한다. 기존 CI/CD 워크플로우가 없는 경우 이슈 1(L0) 호출을 건너뛰고 `#2`, `#3`의 `DEPS`를 `""`로 바꾼다 — 그러면 L1이 최초 진입점이 된다.

### 노드 1 (L0) — 기존 CI/CD 파이프라인 정리 (기존 파이프라인이 있을 때만)

```bash
create_issue 1 "L0" "CI/CD" \
  " 기존 워크플로우 제거 및 파이프라인 재구성 준비" \
  "기존에 설정된 CI/CD 워크플로우 파일들을 확인하고 제거하거나 수정하여 새로운 파이프라인 재구성을 위한 준비 작업을 수행한다. .github/workflows 디렉토리 내 기존 워크플로우 파일을 검토하고, 새로운 파이프라인과 충돌하거나 중복되는 내용이 있으면 삭제 또는 통합한다. 작업 완료 후 워크플로우 디렉토리가 깨끗한 상태임을 확인한다." \
  "ci/cd,cleanup" \
  ""
```

### 노드 2 (L1) — CI 파이프라인: Static Analysis 및 Security Scan

```bash
create_issue 2 "L1" "CI" \
  " Static Analysis 및 Security Scan 파이프라인 구축" \
  "개발자가 소스 코드를 Push하거나 PR을 생성할 때 자동으로 실행되는 CI 파이프라인의 첫 번째 단계를 구축한다. 코드 품질과 타입 오류를 점검하는 Static Analysis 단계와 소스 코드 및 의존성 취약점을 확인하는 Security Scan 단계를 GitHub Actions 워크플로우로 구성한다. Static Analysis는 프로젝트의 언어와 프레임워크에 맞는 도구(ESLint, Pylint, golangci-lint 등)를 선택하고, Security Scan은 Snyk 또는 Trivy를 활용하여 의존성 취약점을 검사한다. 빌드 효율을 위해 Dependency 캐싱 전략을 반영한다." \
  "ci/cd,ci,security" \
  "1"
```

### 노드 3 (L1) — CI 파이프라인: Unit Test 및 Integration Test (CI Gate)

```bash
create_issue 3 "L1" "CI" \
  " Unit Test 및 Integration Test CI Gate 구축" \
  "비즈니스 로직을 검증하는 Unit Test와 모듈 간 연동을 확인하는 Integration Test를 수행하는 CI Gate를 구축한다. Unit Test는 tests/unit 디렉토리에, Integration Test는 tests/integration 디렉토리에 위치하도록 구조를 잡는다. 해당 디렉토리가 없다면 새로 생성하고 기본 테스트 스크립트를 작성한다. 두 테스트 단계 중 하나라도 실패하면 CI Gate를 통과하지 못하도록 파이프라인을 설계하고, Dependency 캐싱을 적용하여 빌드 시간을 단축한다. 본 이슈는 노드 2(Static Analysis)와 독립적으로 진행 가능하다." \
  "ci/cd,ci,testing" \
  "1"
```

### 노드 4 (L2) — CD 파이프라인: Docker Build 및 Push

```bash
create_issue 4 "L2" "CD" \
  " Docker Build 및 Push 파이프라인 구축 (불변 이미지 전략)" \
  "CI Gate 통과 후 CD 단계에서 불변 이미지 생성을 위한 Docker Build 및 Container Registry Push 파이프라인을 구축한다. Docker 이미지는 커밋 SHA를 태그로 사용하여 불변성을 보장하고, Docker Layer Caching 전략을 적용하여 빌드 시간을 최소화한다. GitHub Container Registry(ghcr.io) 또는 Docker Hub를 레지스트리로 활용하며, 이미지 빌드 시 멀티스테이지 빌드를 권장한다. Dockerfile이 없는 경우 프로젝트 특성에 맞는 기본 Dockerfile을 생성한다." \
  "ci/cd,cd,docker" \
  "3"
```

### 노드 7 (L2) — CD 파이프라인: GitHub Pages 배포 및 Smoke Test

노드 4(Docker)와 독립적으로 진행 가능하다. 정적 배포는 컨테이너 이미지를 필요로 하지 않으므로 L2 병렬 그룹에 속한다.

```bash
create_issue 7 "L2" "CD" \
  " GitHub Pages 정적 배포 및 Smoke Test 자동화 구축" \
  "CI Gate 통과 후 정적 결과물을 GitHub Pages에 자동으로 배포하는 CD 파이프라인을 구성한다. actions/upload-pages-artifact와 actions/deploy-pages 액션을 사용하여 배포 절차를 자동화한다. 프로젝트 빌드 산출물(dist, build, out 등)을 Pages 아티팩트로 업로드하고 배포한다. 배포 완료 후 배포된 사이트에 HTTP 요청을 보내 정상 응답(200 OK)을 확인하는 Smoke Test를 수행하여 배포 성공 여부를 최종 검증한다. 저장소 Settings에서 GitHub Pages의 Source를 GitHub Actions로 설정해야 한다. 본 이슈는 노드 4(Docker Build)와 독립적이므로 병렬 진행 가능하다." \
  "ci/cd,cd,deployment" \
  "3"
```

### 노드 5 (L3) — CD 파이프라인: Container Security Scan

```bash
create_issue 5 "L3" "CD" \
  " Container Security Scan으로 이미지 레이어 보안 검증" \
  "Docker 이미지 빌드 완료 후 컨테이너 이미지 레이어의 보안을 점검하는 Container Security Scan 단계를 추가한다. Trivy 또는 Grype를 사용하여 이미지 내부의 OS 패키지 취약점과 애플리케이션 의존성 취약점을 스캔한다. 심각도 HIGH 이상의 취약점이 발견되면 파이프라인을 중단하도록 임계값을 설정한다. 스캔 결과는 GitHub Security 탭에 SARIF 형식으로 업로드하여 추적 가능하게 관리한다. 본 이슈는 노드 6(Staging 배포)과 독립적이므로 병렬 진행 가능하다." \
  "ci/cd,cd,security,docker" \
  "4"
```

### 노드 6 (L3) — CD 파이프라인: Staging 배포 및 E2E 테스트

```bash
create_issue 6 "L3" "CD" \
  " Staging 환경 배포 및 E2E 테스트 자동화 구축 (실제 앱 대상)" \
  "Docker 이미지 빌드 완료 후 Staging 환경에 자동으로 배포하고 E2E 테스트를 수행하는 파이프라인을 구축한다.

[E2E 대상 원칙] E2E 테스트는 반드시 실제 앱(React, Vue, Express 등 개발 서버 또는 빌드 결과물)을 대상으로 해야 한다. 바닐라 JS 목업 HTML(e2e/public/index.html 등)을 대상으로 하는 E2E는 실제 앱의 런타임 오류(import 누락, 타입 에러 등)를 검출할 수 없으므로 허용하지 않는다.

[playwright.config 설정] playwright.config.ts의 webServer 항목을 아래와 같이 실제 앱 개발 서버로 설정한다.
  webServer: {
    command: 'npm run dev',  // 실제 앱 기동 명령
    url: 'http://localhost:5173',  // 실제 앱 포트
    reuseExistingServer: !process.env.CI,
  }
풀스택 프로젝트(클라이언트+서버)라면 'npm run dev:client & npm run dev:server' 형식으로 두 프로세스를 함께 기동한다.

[CI 파이프라인 단계] CI yml에 E2E를 추가할 때는 반드시 아래 순서를 지킨다.
  1. npm run build  (빌드 실패 자체가 첫 번째 게이트)
  2. npx playwright install --with-deps chromium
  3. npm run test:e2e  (빌드 결과물 또는 dev server 대상)
E2E 단계가 CI에 없으면 이 단계에서 추가한다.

[e2e/public 목업 처리] e2e/public/index.html 등 독립 목업 파일이 존재하면 playwright.config의 webServer를 실제 앱으로 교체하고 목업 파일을 제거하거나 별도 디렉토리로 이동한다.

[앱 분석 기반 테스트 생성 방법] 구현 담당자는 다음 순서로 앱을 분석하여 테스트를 생성한다. 1) package.json scripts.dev에서 dev 서버 기동 명령과 포트를 파악한다. 2) src/에서 React Router path= 또는 createBrowserRouter route 객체를 추출하여 테스트할 URL 목록을 확보한다. 3) src/pages/, src/views/에서 CRUD 관련(Create/List/Edit/Delete)과 인증 관련(Login/Auth) 컴포넌트를 확인한다. 4) 분석 결과를 바탕으로 최소 시나리오(메인 로딩, 라우트 접근성, CRUD/인증 플로우)를 포함하는 tests/e2e/app.spec.ts를 생성한다. 5) playwright.config.ts의 webServer를 실제 dev 서버로 설정하고, CI에 Build → playwright install → E2E 단계를 추가한다.

E2E 테스트 환경이 아예 없다면 Playwright를 설치하고 tests/e2e 디렉토리에 기본 시나리오(메인 페이지 로딩, 핵심 플로우)를 포함한 스크립트를 생성한다. E2E 테스트 실패 시 Production 배포를 차단하도록 파이프라인 게이트를 설정한다. 교육용 프로젝트로 별도 Staging 서버가 없는 경우 Docker 컨테이너를 Actions runner 위에서 임시로 기동하고 Playwright로 해당 컨테이너에 접근하는 방식으로 대체 가능하다. 본 이슈는 노드 5(Container Scan)와 독립적이므로 병렬 진행 가능하다." \
  "ci/cd,cd,testing,e2e" \
  "4"
```

이슈 생성 후 각 이슈 번호는 `create_issue` 헬퍼가 `NUM_1..NUM_7`에 자동 저장한다. Step 3에서 `cicd-issues.md`를 작성할 때 이 변수들을 그대로 참조한다.

---

## Step 3 — cicd-issues.md 파일 생성

생성된 이슈 정보를 모아 프로젝트 루트에 "cicd-issues.md" 파일을 생성한다.
파일은 마크다운 기호 없이 서술형으로 작성하며, 각 이슈의 번호, 제목, 설명, 담당 파이프라인 단계를 포함한다.

파일 형식 (레벨별 DAG 그룹핑):

```
CI/CD 파이프라인 구축 이슈 목록

리포지토리: OWNER/REPO
생성일: YYYY-MM-DD
총 이슈 수: N개

병렬 실행 그룹 (DAG 레벨별)

Level 0: 기존 CI/CD 정리 (해당 시에만)
  #N1  [L0][CI/CD] 기존 워크플로우 제거 및 파이프라인 재구성 준비
       URL: https://github.com/OWNER/REPO/issues/N1
       선행: 없음

Level 1: CI 병렬 그룹 (서로 독립, 동시 구현 가능; #N1 후행)
  #N2  [L1][CI] Static Analysis 및 Security Scan
       URL: https://github.com/OWNER/REPO/issues/N2
       선행: #N1
  #N3  [L1][CI] Unit Test 및 Integration Test CI Gate
       URL: https://github.com/OWNER/REPO/issues/N3
       선행: #N1

Level 2: CD 진입 병렬 그룹 (서로 독립, #N3 후행)
  #N4  [L2][CD] Docker Build 및 Push (불변 이미지)
       URL: https://github.com/OWNER/REPO/issues/N4
       선행: #N3
  #N7  [L2][CD] GitHub Pages 정적 배포 및 Smoke Test
       URL: https://github.com/OWNER/REPO/issues/N7
       선행: #N3

Level 3: CD 후처리 병렬 그룹 (서로 독립, #N4 후행)
  #N5  [L3][CD] Container Security Scan
       URL: https://github.com/OWNER/REPO/issues/N5
       선행: #N4
  #N6  [L3][CD] Staging 배포 및 E2E 테스트
       URL: https://github.com/OWNER/REPO/issues/N6
       선행: #N4

구현 순서 가이드
  - 같은 레벨의 이슈들은 별도 브랜치로 동시에 작업해도 된다
  - 한 레벨의 모든 이슈가 Done이 되어야 다음 레벨을 시작한다
  - L2까지 완료하면 "CI + 최소 정적 배포" MVP가 성립한다

파이프라인 전체 흐름

Push 또는 PR 생성 시 CI 파이프라인이 자동 가동된다.
L1에서 Static Analysis와 Unit/Integration Test가 서로 독립적으로 병렬 실행되어
코드 품질과 테스트 통과를 함께 확인한다.
L1 통과 후 L2에서는 Docker Build/Push와 GitHub Pages 정적 배포가
서로 독립 경로로 병렬 진행된다.
L3에서는 L2의 Docker 이미지 산출물을 받아 Container Security Scan과
Staging 배포 + E2E 테스트가 병렬로 실행되어 CD 사이클을 마무리한다.
```

실제 파일 저장 (dry-run 모드에서는 저장하지 않고 콘솔에만 출력):

```bash
if [ "$MODE" = "dry-run" ]; then
  echo "=== [DRY-RUN] 아래 내용이 cicd-issues.md로 저장될 예정 ==="
  cat << 'EOF'
(위 형식에 맞게 실제 이슈 번호와 URL을 채워서 출력)
EOF
else
  cat > cicd-issues.md << 'EOF'
(위 형식에 맞게 실제 이슈 번호와 URL을 채워서 저장)
EOF
  echo "cicd-issues.md 저장 완료"
fi
```

---

## Step 4 — 칸반 보드 등록 (선택)

GitHub Projects 보드가 있다면 생성된 이슈들을 Todo 열에 등록한다. `dry-run` 모드에서는 건너뛴다.

```bash
[ "$MODE" != "dry-run" ] && {
  OWNER=$(gh repo view --json owner -q '.owner.login')
  PROJECTS_JSON=$(gh project list --owner "$OWNER" --format json 2>/dev/null || echo '{"projects":[]}')
  PROJECT_COUNT=$(echo "$PROJECTS_JSON" | jq '.projects | length')

  if [ "$PROJECT_COUNT" = "0" ]; then
    echo "프로젝트 보드 없음 — 칸반 등록 단계 건너뜁니다."
  elif [ "$PROJECT_COUNT" = "1" ]; then
    PROJECT_NUMBER=$(echo "$PROJECTS_JSON" | jq -r '.projects[0].number')
    PROJECT_TITLE=$(echo "$PROJECTS_JSON" | jq -r '.projects[0].title')
    echo "프로젝트 보드 감지: #${PROJECT_NUMBER} \"${PROJECT_TITLE}\""
    echo "이 보드에 생성된 이슈들을 등록하시겠습니까? (y/n)"
    # 사용자 응답 수신 후 진행
  else
    echo "복수의 프로젝트 보드가 감지되었습니다:"
    echo "$PROJECTS_JSON" | jq -r '.projects[] | "  #\(.number) \(.title)"'
    echo "등록할 프로젝트 번호를 지정해 주세요. (예: 칸반 등록 건너뛰려면 skip 입력)"
    # 사용자 응답 수신 후 PROJECT_NUMBER 설정
  fi
}
```

승인 시 각 이슈를 보드에 추가한다:

```bash
for ISSUE_URL in $ISSUE_URLS; do
  gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$ISSUE_URL"
  sleep 0.3
done
```

---

## Step 5 — 완료 보고

```
CI/CD 파이프라인 이슈 생성 완료

리포지토리: OWNER/REPO
생성된 이슈 수: N개
저장 파일: cicd-issues.md

생성된 이슈 — DAG 레벨별 병렬 그룹:

  [L0]  #N1  [CI/CD] 기존 워크플로우 제거 및 파이프라인 재구성 준비

  [L1]  #N2  [CI] Static Analysis 및 Security Scan
  [L1]  #N3  [CI] Unit Test 및 Integration Test CI Gate
         ↳ 위 두 이슈는 서로 독립 — 병렬 구현 가능

  [L2]  #N4  [CD] Docker Build 및 Push
  [L2]  #N7  [CD] GitHub Pages 정적 배포 및 Smoke Test
         ↳ 위 두 이슈는 서로 독립 — 병렬 구현 가능

  [L3]  #N5  [CD] Container Security Scan
  [L3]  #N6  [CD] Staging 배포 및 E2E Test
         ↳ 위 두 이슈는 서로 독립 — 병렬 구현 가능

파이프라인 흐름 (DAG):
  Push/PR
    └─ L1: {Static Analysis + Security Scan, Unit/Integration Test}
        └─ L2: {Docker Build & Push, GitHub Pages + Smoke Test}
              └─ L3: {Container Security Scan, Staging + E2E}

다음 단계: 같은 레벨 이슈는 /implement로 동시에 진행해도 된다.
한 레벨이 모두 Done이 되어야 다음 레벨을 시작하세요.
```

---

## Constraints

- 기존 CI/CD 파이프라인이 있다면 제거 또는 수정 이슈를 반드시 먼저 생성한다
- 이슈 본문은 마크다운 기호를 사용하지 않고 서술형 문장으로 작성한다
- 모든 워크플로우는 GitHub Actions 기반으로 설계한다
- Dependency 캐싱 및 Docker Layer Caching 전략을 이슈 내용에 반드시 포함한다
- Unit Test 또는 Integration Test가 없으면 생성 이슈를 추가한다
- E2E 테스트 환경이 없으면 Playwright 기반 환경 구축 이슈를 추가한다
- **E2E는 반드시 실제 앱(devServer 또는 빌드 결과물)을 대상으로 해야 한다.** 바닐라 JS 목업 HTML이나 별도 mock 페이지를 대상으로 하는 E2E 설정은 허용하지 않는다. Step 0에서 목업 대상 E2E가 감지되면 노드 6 이슈에 교체 지침을 반드시 포함한다.
- **CI에 E2E 단계가 없으면 허용하지 않는다.** Step 0에서 CI yml에 E2E가 없음이 감지되면 노드 6 이슈에 CI E2E 단계 추가 지침을 반드시 포함한다.
- CI의 E2E 단계는 반드시 Build 이후에 위치해야 한다 (`npm run build` → Playwright install → `npm run test:e2e` 순서).

## Prerequisites

### 필수 도구

| 항목 | 확인 방법 |
|------|-----------|
| `gh` CLI 2.x 이상 | `gh --version` |
| `jq` | `jq --version` |
| Git 리포지토리 | `git remote get-url origin` 성공 |

### gh CLI 인증 — 필요 스코프

```bash
gh auth refresh -s repo -s project -s read:org
gh auth status   # 아래 3개 스코프가 모두 보여야 함
```

| 스코프 | 용도 | 누락 시 증상 |
|--------|------|-------------|
| `repo` | 이슈 생성, 라벨 관리 | Step 1.5의 `gh label create`, Step 2의 `gh issue create` 실패 |
| `project` | 칸반 보드에 이슈 등록 | Step 4의 `gh project item-add` 실패 |
| `read:org` | Organization/User 타입 판별 | `gh project list --owner`가 비어있게 반환 |

### 실행 원칙

- 첫 실행은 항상 `--dry-run`으로 계획 먼저 확인
- 이미 `cicd-issues.md`가 있으면 기본 실행은 멈춘다 (멱등성 가드)
- 의도적 재생성은 `--force`를 명시적으로 사용
