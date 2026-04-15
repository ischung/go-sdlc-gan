# cc-sdlc — 소프트웨어 개발 자동화 Claude Code 스킬 패키지

소프트웨어 개발 전체 라이프사이클(기획 → 설계 → 이슈 관리 → 구현 → CI/CD)을 자동화하는 **Claude Code 커스텀 스킬** 6종 패키지입니다.

> **cc-sdlc** = Claude Code + Software Development Life Cycle

---

## 빠른 설치

```bash
npx github:ischung/cc-sdlc
```

설치 후 **Claude Code를 재시작**하면 모든 스킬이 활성화됩니다.

### 기타 명령

```bash
npx github:ischung/cc-sdlc list       # 설치 현황 확인
npx github:ischung/cc-sdlc uninstall  # 제거
npx github:ischung/cc-sdlc help       # 도움말
```

---

## 포함된 스킬 (6종)

| 스킬 | 커맨드 | 설명 |
|------|--------|------|
| **write-prd** | `/write-prd` | 시니어 PM 코치가 1:1 대화로 PRD 단계별 완성 |
| **write-techspec** | `/write-techspec` `/generate-issues` | PRD → TechSpec 작성 + GitHub 이슈 자동 발행 |
| **github-kanban** | `/kanban-create` `/kanban-add-issues` `/kanban-status` | GitHub Projects 칸반 보드 자동 구성 |
| **ci-cd-pipeline** | `/cicd-pipeline` | GitHub Actions CI/CD 파이프라인 이슈 자동 생성 |
| **tdd** | `/tdd` | TDD(Red→Green→Refactor) 워크플로우 페어 프로그래밍 |
| **github-flow-impl** | `/implement` `/impl` | 칸반 보드 이슈 자동 선택 → GitHub Flow 구현 |

---

## 개발 워크플로우

```mermaid
flowchart LR
    A[아이디어] -->|/write-prd| B[PRD 문서]
    B -->|/write-techspec| C[TechSpec + 아키텍처]
    C -->|/generate-issues| D[GitHub 이슈]
    D -->|/kanban-create| E[칸반 보드]
    E -->|/implement| F[코드 구현]
    F -->|/tdd| G[TDD 검증]
    C -->|/cicd-pipeline| H[CI/CD 파이프라인]
    G --> H
```

---

## 스킬별 상세 설명

### `/write-prd` — PRD 작성
시니어 PM 코치 역할로 8단계 인터뷰를 통해 제품 요구사항 문서를 완성합니다.

- **Phase 0**: 아이디어 청취
- **Phase 1**: 프로젝트 목표 정의
- **Phase 2**: 범위 확정 (In/Out-of-Scope)
- **Phase 3**: 대상 사용자 & 유저 스토리
- **Phase 4**: KPI 정의
- **Phase 5**: 상세 기능 요건
- **Phase 6**: UI/UX 요건
- **Phase 7**: 기술적 제약 & 최종 저장

> 자연어 트리거: "PRD 작성해줘", "제품 기획서 만들어줘"

---

### `/write-techspec` + `/generate-issues` — TechSpec 및 이슈 발행
PRD를 분석하여 시스템 아키텍처, 데이터 모델, API 명세를 포함한 TechSpec을 작성하고,
INVEST 원칙 기반의 GitHub 이슈로 자동 분할합니다.

> 자연어 트리거: "TechSpec 작성해줘", "기술 명세서 만들어줘", "이슈 발행해줘"

---

### `/kanban-create` + `/kanban-add-issues` + `/kanban-status` — 칸반 보드
GitHub Projects를 사용하여 **Todo / In Progress / Review / Done** 4개 컬럼 보드를 자동 생성하고 이슈를 배치합니다.

**전제 조건**: `gh` CLI 설치 및 GitHub 인증 (`gh auth login`)

> 자연어 트리거: "칸반 보드 만들어줘", "GitHub 프로젝트 생성해줘"

---

### `/cicd-pipeline` — CI/CD 파이프라인
프로젝트를 분석하여 7단계 GitHub Actions 파이프라인 구성 이슈를 자동 생성합니다.

1. 기존 워크플로우 정리
2. CI — Static Analysis & Security Scan
3. CI — Unit/Integration Test
4. CD — Docker Build & Push
5. CD — Container Security Scan
6. CD — Staging 배포 & E2E Test
7. CD — GitHub Pages 배포 & Smoke Test

> 자연어 트리거: "CI/CD 파이프라인 구축해줘", "GitHub Actions 설정해줘"

---

### `/tdd` — TDD 워크플로우
Red → Green → Refactor 사이클을 단계별로 안내하는 페어 프로그래밍 스킬입니다.

```
STEP 0: TODO 테스트 목록 생성
STEP 1 (RED):      실패 테스트 작성 (AAA 패턴)
STEP 2 (GREEN):    최소 코드로 테스트 통과
STEP 3 (REFACTOR): 동작 유지하며 코드 개선
```

> 자연어 트리거: "TDD로 구현해줘", "테스트 먼저 짜줘"

---

### `/implement` + `/impl` — GitHub 이슈 자동 구현
칸반 보드의 **Todo** 이슈를 자동으로 선택하여 GitHub Flow(브랜치 → 코드 → PR)로 구현합니다.

```bash
/implement          # Todo 최우선 이슈 자동 선택
/implement #42      # 특정 이슈 지정
/impl               # 단축 커맨드
```

**전제 조건**:
- `gh` CLI 2.x 이상 (`gh auth login`)
- `jq` 설치
- GitHub 인증 스코프: `repo, read:org, read:discussion, project`
- `KANBAN_TOKEN` PAT → GitHub Actions Secret 등록

---

## 설치 위치

```
~/.claude/
├── skills/
│   ├── github-kanban/SKILL.md
│   ├── write-prd/SKILL.md
│   ├── write-techspec/SKILL.md
│   ├── ci-cd-pipeline/SKILL.md
│   ├── tdd/SKILL.md
│   └── github-flow-impl/SKILL.md
└── commands/
    ├── write-prd.md
    ├── write-techspec.md
    ├── generate-issues.md
    ├── kanban-create.md
    ├── kanban-add-issues.md
    ├── kanban-status.md
    ├── cicd-pipeline.md
    ├── tdd.md
    ├── implement.md
    └── impl.md
```

---

## 지원 도구 로드맵

| 도구 | 상태 |
|------|------|
| Claude Code | ✅ 지원 |
| OpenAI Codex CLI | 🔜 예정 |
| GitHub Copilot CLI | 🔜 예정 |

---

## 패키지 구조

```
cc-sdlc/
├── package.json
├── bin/
│   └── install.js       ← npx 진입점 (Node.js)
├── dist/                ← 배포용 스킬 번들
│   ├── github-kanban/
│   ├── write-prd/
│   ├── write-techspec/
│   ├── ci-cd-pipeline/
│   ├── tdd/
│   └── github-flow-impl/
└── README.md
```
