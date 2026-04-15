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

위 분석 결과를 바탕으로 다음 항목들의 존재 여부를 정리한다:

| 항목 | 존재 여부 | 비고 |
|------|-----------|------|
| 기존 CI/CD 워크플로우 | O/X | 파일명 |
| Unit Test | O/X | 디렉토리/설정파일 |
| Integration Test | O/X | 디렉토리/설정파일 |
| Docker 설정 | O/X | Dockerfile 등 |
| E2E 테스트 | O/X | 프레임워크명 |
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
6. CD 파이프라인 구축 — Staging 환경 배포 및 E2E 테스트
7. CD 파이프라인 구축 — GitHub Pages 정적 배포 및 Smoke Test

**조건부 이슈**:

- Unit Test가 없으면: Unit Test 디렉토리 구조 생성 및 기본 테스트 스크립트 작성 이슈 추가
- Integration Test가 없으면: Integration Test 디렉토리 생성 및 기본 테스트 작성 이슈 추가
- E2E 테스트 환경이 없으면: E2E 테스트 환경 구축(Playwright 설치 및 기본 스크립트) 이슈 추가

---

## Step 2 — GitHub 이슈 생성

각 이슈를 GitHub에 생성한다. 이슈 본문은 마크다운 기호 없이 서술형 문장으로 작성한다.

```bash
OWNER=$(gh repo view --json owner -q '.owner.login')
REPO=$(gh repo view --json name -q '.name')
```

아래 이슈 템플릿을 참고하여 프로젝트에 맞게 조정한 뒤 순서대로 생성한다.

### 이슈 1: 기존 CI/CD 파이프라인 정리 (기존 파이프라인이 있을 때만)

```bash
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "[CI/CD] 기존 워크플로우 제거 및 파이프라인 재구성 준비" \
  --body "기존에 설정된 CI/CD 워크플로우 파일들을 확인하고 제거하거나 수정하여 새로운 파이프라인 재구성을 위한 준비 작업을 수행한다. .github/workflows 디렉토리 내 기존 워크플로우 파일을 검토하고, 새로운 파이프라인과 충돌하거나 중복되는 내용이 있으면 삭제 또는 통합한다. 작업 완료 후 워크플로우 디렉토리가 깨끗한 상태임을 확인한다." \
  --label "ci/cd,cleanup"
```

### 이슈 2: CI 파이프라인 — Static Analysis 및 Security Scan

```bash
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "[CI] Static Analysis 및 Security Scan 파이프라인 구축" \
  --body "개발자가 소스 코드를 Push하거나 PR을 생성할 때 자동으로 실행되는 CI 파이프라인의 첫 번째 단계를 구축한다. 코드 품질과 타입 오류를 점검하는 Static Analysis 단계와 소스 코드 및 의존성 취약점을 확인하는 Security Scan 단계를 GitHub Actions 워크플로우로 구성한다. Static Analysis는 프로젝트의 언어와 프레임워크에 맞는 도구(ESLint, Pylint, golangci-lint 등)를 선택하고, Security Scan은 Snyk 또는 Trivy를 활용하여 의존성 취약점을 검사한다. 빌드 효율을 위해 Dependency 캐싱 전략을 반영한다." \
  --label "ci/cd,ci,security"
```

### 이슈 3: CI 파이프라인 — Unit Test 및 Integration Test (CI Gate)

```bash
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "[CI] Unit Test 및 Integration Test CI Gate 구축" \
  --body "Static Analysis와 Security Scan 이후 비즈니스 로직을 검증하는 Unit Test와 모듈 간 연동을 확인하는 Integration Test를 수행하는 CI Gate를 구축한다. Unit Test는 tests/unit 디렉토리에, Integration Test는 tests/integration 디렉토리에 위치하도록 구조를 잡는다. 해당 디렉토리가 없다면 새로 생성하고 기본 테스트 스크립트를 작성한다. 두 테스트 단계 중 하나라도 실패하면 CI Gate를 통과하지 못하도록 파이프라인을 설계하고, Dependency 캐싱을 적용하여 빌드 시간을 단축한다." \
  --label "ci/cd,ci,testing"
```

### 이슈 4: CD 파이프라인 — Docker Build 및 Push

```bash
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "[CD] Docker Build 및 Push 파이프라인 구축 (불변 이미지 전략)" \
  --body "CI Gate 통과 후 CD 단계에서 불변 이미지 생성을 위한 Docker Build 및 Container Registry Push 파이프라인을 구축한다. Docker 이미지는 커밋 SHA를 태그로 사용하여 불변성을 보장하고, Docker Layer Caching 전략을 적용하여 빌드 시간을 최소화한다. GitHub Container Registry(ghcr.io) 또는 Docker Hub를 레지스트리로 활용하며, 이미지 빌드 시 멀티스테이지 빌드를 권장한다. Dockerfile이 없는 경우 프로젝트 특성에 맞는 기본 Dockerfile을 생성한다." \
  --label "ci/cd,cd,docker"
```

### 이슈 5: CD 파이프라인 — Container Security Scan

```bash
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "[CD] Container Security Scan으로 이미지 레이어 보안 검증" \
  --body "Docker 이미지 빌드 완료 후 컨테이너 이미지 레이어의 보안을 점검하는 Container Security Scan 단계를 추가한다. Trivy 또는 Grype를 사용하여 이미지 내부의 OS 패키지 취약점과 애플리케이션 의존성 취약점을 스캔한다. 심각도 HIGH 이상의 취약점이 발견되면 파이프라인을 중단하도록 임계값을 설정한다. 스캔 결과는 GitHub Security 탭에 SARIF 형식으로 업로드하여 추적 가능하게 관리한다." \
  --label "ci/cd,cd,security,docker"
```

### 이슈 6: CD 파이프라인 — Staging 배포 및 E2E 테스트

```bash
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "[CD] Staging 환경 배포 및 E2E 테스트 자동화 구축" \
  --body "Container Security Scan 통과 후 Staging 환경에 자동으로 배포하고 E2E 테스트를 수행하는 파이프라인을 구축한다. E2E 테스트 환경이 없다면 Playwright를 설치하고 tests/e2e 디렉토리에 기본 테스트 스크립트를 생성한다. 기본 E2E 테스트는 메인 페이지 접근 가능 여부, 핵심 사용자 플로우 동작 확인 등 최소한의 시나리오를 포함한다. E2E 테스트 실패 시 Production 배포를 차단하도록 파이프라인 게이트를 설정한다." \
  --label "ci/cd,cd,testing,e2e"
```

### 이슈 7: CD 파이프라인 — GitHub Pages 배포 및 Smoke Test

```bash
gh issue create \
  --repo "$OWNER/$REPO" \
  --title "[CD] GitHub Pages 정적 배포 및 Smoke Test 자동화 구축" \
  --body "모든 테스트가 성공하면 정적 결과물을 GitHub Pages에 자동으로 배포하는 CD 파이프라인을 구성한다. actions/upload-pages-artifact와 actions/deploy-pages 액션을 사용하여 배포 절차를 자동화한다. 프로젝트 빌드 산출물(dist, build, out 등)을 Pages 아티팩트로 업로드하고 배포한다. 배포 완료 후 배포된 사이트에 HTTP 요청을 보내 정상 응답(200 OK)을 확인하는 Smoke Test를 수행하여 배포 성공 여부를 최종 검증하고 전체 CI/CD 프로세스를 마무리한다. 저장소 Settings에서 GitHub Pages의 Source를 GitHub Actions로 설정해야 한다." \
  --label "ci/cd,cd,deployment"
```

이슈 생성 후 각 이슈 번호(URL에서 추출)를 기록해 둔다.

---

## Step 3 — cicd-issues.md 파일 생성

생성된 이슈 정보를 모아 프로젝트 루트에 "cicd-issues.md" 파일을 생성한다.
파일은 마크다운 기호 없이 서술형으로 작성하며, 각 이슈의 번호, 제목, 설명, 담당 파이프라인 단계를 포함한다.

파일 형식:

```
CI/CD 파이프라인 구축 이슈 목록

리포지토리: OWNER/REPO
생성일: YYYY-MM-DD
총 이슈 수: N개

이슈 #N1  [CI/CD] 기존 워크플로우 제거 및 파이프라인 재구성 준비
URL: https://github.com/OWNER/REPO/issues/N1
단계: 사전 정리
설명: 기존 CI/CD 워크플로우를 정리하여 새로운 파이프라인 구성을 위한 환경을 준비한다.

이슈 #N2  [CI] Static Analysis 및 Security Scan 파이프라인 구축
URL: https://github.com/OWNER/REPO/issues/N2
단계: CI - 1단계
설명: 코드 품질 점검(Static Analysis)과 취약점 스캔(Security Scan)을 자동화한다.

이슈 #N3  [CI] Unit Test 및 Integration Test CI Gate 구축
URL: https://github.com/OWNER/REPO/issues/N3
단계: CI - 2단계
설명: Unit Test와 Integration Test로 구성된 CI Gate를 통해 코드 품질을 보장한다.

이슈 #N4  [CD] Docker Build 및 Push 파이프라인 구축
URL: https://github.com/OWNER/REPO/issues/N4
단계: CD - 1단계
설명: 불변 이미지 전략과 레이어 캐싱을 적용한 Docker 빌드 파이프라인을 구성한다.

이슈 #N5  [CD] Container Security Scan으로 이미지 레이어 보안 검증
URL: https://github.com/OWNER/REPO/issues/N5
단계: CD - 2단계
설명: 컨테이너 이미지의 취약점을 스캔하여 보안이 검증된 이미지만 배포한다.

이슈 #N6  [CD] Staging 환경 배포 및 E2E 테스트 자동화 구축
URL: https://github.com/OWNER/REPO/issues/N6
단계: CD - 3단계
설명: Staging 배포 후 E2E 테스트를 통해 실제 사용자 시나리오를 자동 검증한다.

이슈 #N7  [CD] GitHub Pages 정적 배포 및 Smoke Test 자동화 구축
URL: https://github.com/OWNER/REPO/issues/N7
단계: CD - 4단계 (최종)
설명: GitHub Pages에 정적 결과물을 자동 배포하고 Smoke Test로 서비스 생존을 확인한다.

파이프라인 전체 흐름

Push 또는 PR 생성 시 CI 파이프라인이 자동 가동된다.
첫째로 Static Analysis와 Security Scan을 병렬로 수행하여 코드 품질과 보안을 점검한다.
둘째로 Unit Test와 Integration Test를 수행하여 CI Gate를 통과한다.
CI Gate 통과 후 Docker Build와 Push를 수행하여 불변 이미지를 생성한다.
이미지 생성 후 Container Security Scan으로 이미지 레이어 보안을 재확인한다.
보안 검증 후 Staging 환경에 배포하고 E2E 테스트를 수행한다.
모든 테스트 통과 시 GitHub Pages에 정적 결과물을 배포하고 Smoke Test로 마무리한다.
```

실제 파일 저장:

```bash
cat > cicd-issues.md << 'EOF'
(위 형식에 맞게 실제 이슈 번호와 URL을 채워서 저장)
EOF
```

---

## Step 4 — 칸반 보드 등록 (선택)

GitHub Projects 보드가 있다면 생성된 이슈들을 Todo 열에 등록한다.

```bash
# 프로젝트 보드 확인
OWNER=$(gh repo view --json owner -q '.owner.login')
gh project list --owner "$OWNER" --format json | jq '.projects[] | {number, title}'
```

프로젝트가 있으면 사용자에게 등록 여부를 확인하고, 승인 시 각 이슈를 보드에 추가한다.

```bash
for ISSUE_URL in $ISSUE_URLS; do
  gh project item-add PROJECT_NUMBER --owner "$OWNER" --url "$ISSUE_URL"
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

생성된 이슈 목록:
  #N1  [CI/CD] 기존 워크플로우 제거 및 파이프라인 재구성 준비
  #N2  [CI] Static Analysis 및 Security Scan 파이프라인 구축
  #N3  [CI] Unit Test 및 Integration Test CI Gate 구축
  #N4  [CD] Docker Build 및 Push 파이프라인 구축
  #N5  [CD] Container Security Scan으로 이미지 레이어 보안 검증
  #N6  [CD] Staging 환경 배포 및 E2E 테스트 자동화 구축
  #N7  [CD] GitHub Pages 정적 배포 및 Smoke Test 자동화 구축

파이프라인 흐름:
  Push/PR → [Static Analysis + Security Scan] → [Unit + Integration Test]
  → CI Gate → [Docker Build & Push] → [Container Security Scan]
  → [Staging 배포 + E2E Test] → [GitHub Pages 배포 + Smoke Test]

다음 단계: /implement 명령으로 각 이슈를 순서대로 구현하세요.
```

---

## Constraints

- 기존 CI/CD 파이프라인이 있다면 제거 또는 수정 이슈를 반드시 먼저 생성한다
- 이슈 본문은 마크다운 기호를 사용하지 않고 서술형 문장으로 작성한다
- 모든 워크플로우는 GitHub Actions 기반으로 설계한다
- Dependency 캐싱 및 Docker Layer Caching 전략을 이슈 내용에 반드시 포함한다
- Unit Test 또는 Integration Test가 없으면 생성 이슈를 추가한다
- E2E 테스트 환경이 없으면 Playwright 기반 환경 구축 이슈를 추가한다

## Prerequisites

- `gh auth login` 완료
- `gh` CLI 2.x 이상, `jq` 설치
- GitHub 리포지토리에서 실행
