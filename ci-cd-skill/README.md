# ci-cd-skill

GitHub Actions 기반 CI/CD 파이프라인 구축을 자동화하는 Claude Code 스킬 모음.

## 포함 스킬

### `/cicd-pipeline`

프로젝트 아키텍처를 분석하여 GitHub Actions CI/CD 파이프라인 구축에 필요한 이슈를 자동 생성하고 `cicd-issues.md`에 저장한다.

**파이프라인 커버 범위 (DAG — 같은 레벨은 병렬):**

```
Push/PR
  ├─ [L1] Static Analysis & Security Scan ─┐
  └─ [L1] Unit/Integration Test (CI Gate) ─┤
                                            │
             ┌──────────────────────────────┘
             ├─ [L2] Docker Build & Push ──┬─ [L3] Container Security Scan
             │                             └─ [L3] Staging 배포 + E2E Test
             └─ [L2] GitHub Pages + Smoke Test
```

동일 레벨(`[L1]`, `[L2]`, `[L3]`) 이슈는 서로 의존하지 않으므로 **병렬 구현 가능**하다. 생성되는 이슈 제목에 `[L<n>]` 접두어가 붙어 구분된다.

**사용법:**

```bash
/cicd-pipeline           # 이슈 생성 + cicd-issues.md 저장
/cicd-pipeline --dry-run # 환경 감지 표 + 생성될 이슈 목록만 출력 (이슈 미생성)
/cicd-pipeline --force   # cicd-issues.md가 이미 있어도 강제 재생성 (중복 생성 위험, 실행 전 확인 필요)
```

## 설치

이 스킬은 [`go-sdlc-gan`](../README.md) 패키지의 일부로 함께 설치됩니다.
**단일 명령**으로 전역 또는 프로젝트 스코프 설치·제거가 가능합니다.

### 전역 설치 (모든 프로젝트에서 사용)

```bash
npx go-sdlc-gan                # 설치 (~/.claude/)
npx go-sdlc-gan uninstall      # 제거
npx go-sdlc-gan list           # 설치 현황
```

### 프로젝트 스코프 설치 (해당 프로젝트에서만)

```bash
cd /your-project
npx go-sdlc-gan --project             # 현재 디렉토리의 .claude/ 에 설치
npx go-sdlc-gan uninstall --project   # 현재 디렉토리의 .claude/ 에서 제거
npx go-sdlc-gan list --project        # 프로젝트 설치 현황
```

설치 위치 비교:

| 스코프 | 위치 |
|--------|------|
| 전역 | `~/.claude/skills/ci-cd-pipeline/SKILL.md`, `~/.claude/commands/cicd-pipeline.md` |
| 프로젝트 | `<project>/.claude/skills/ci-cd-pipeline/SKILL.md`, `<project>/.claude/commands/cicd-pipeline.md` |

> 전체 스킬 목록과 기타 옵션은 루트 [README](../README.md) 참고.

## 전제 조건

| 항목 | 확인 방법 | 비고 |
|------|-----------|------|
| `gh` CLI 2.x 이상 | `gh --version` | GitHub 공식 CLI |
| `jq` | `jq --version` | JSON 파서 |
| GitHub 인증 | `gh auth status` | 아래 스코프 포함 필수 |
| Git 리포 | `git remote get-url origin` | 성공해야 실행 가능 |

### 필요 스코프

```bash
gh auth refresh -s repo -s project -s read:org
```

| 스코프 | 용도 |
|--------|------|
| `repo` | 이슈 생성·라벨 관리 |
| `project` | 칸반 보드에 이슈 등록 |
| `read:org` | owner 타입(User/Organization) 판별 |
