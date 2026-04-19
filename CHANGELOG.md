# Changelog

모든 변경 사항은 이 파일에 기록됩니다. 형식은 [Keep a Changelog](https://keepachangelog.com/ko/1.0.0/)를 따르며, 버전 관리는 [Semantic Versioning](https://semver.org/lang/ko/)을 따릅니다.

---

## [1.2.0] — 2026-04-19

### 추가

- **`/ship` · `/ship-all` GAN 루프 실제 실행 보장** (`auto-ship`): 기존에는 위임 문구만 있어 AI가 `sdlc-code-generator`, `sdlc-contracting`, `sdlc-code-evaluator` 에이전트를 실제로 호출하지 않는 문제가 있었음. `auto-ship/SKILL.md`에 Step 4(Generator 구현), Step 4.5(Contracting), Step 5(로컬 테스트), Step 5.5(Evaluator 채점), Step 5.6(루프 분기)의 Task 호출 코드를 명시적으로 추가. 이제 `/ship`, `/ship-all` 실행 시 세 서브에이전트가 확실히 호출됨.
- Step 0~3(환경 감지·이슈 선정·브랜치 생성)과 Step 6(PR 생성)은 `github-flow-impl` 위임 유지. GAN 루프 구간만 auto-ship에 직접 내장.

---

## [1.1.0] — 2026-04-19

### 수정

- **`github-kanban/SKILL.md`** 3단계 GraphQL mutation 버그 수정: `singleSelectOptions`에 plain string 배열을 전달하던 코드를 `{name, color, description}` 객체 배열로 교체. GitHub Projects V2 API의 `ProjectV2SingleSelectFieldOptionInput` 타입을 정확히 충족하지 않아 mutation이 조용히 실패하면서 Review 컬럼이 생성되지 않던 문제 해결. Review 옵션이 이미 존재하면 덮어쓰기를 건너뜀 guard 추가.

### 추가

- **`/ship-all` GAN 루프 기본 활성화** (`auto-ship`): 기존에는 `/implement` 경로에서만 GAN Generator-Evaluator 루프가 실행되었으나, 이제 `/ship`·`/ship-all`에서도 기본으로 활성화된다. 끄려면 `--no-eval` 플래그를 명시한다.
- **`ship-all.md` 커맨드** `argument-hint`에 GAN 플래그 추가: `--no-eval`, `--eval-threshold <N>`, `--eval-economy`, `--eval-strict`.
- **`auto-ship/SKILL.md`** GAN 루프 상수 테이블 추가 (IMPL_ITER_MAX, EVAL_THRESHOLD, EVAL_ITEM_MIN, PLATEAU_EPS) 및 위임 블록에 "GAN 루프는 반드시 실행한다" 명시.

---

## [1.0.1] — 2026-04-19

### 변경 (리팩토링 — 기능 동일)

- **`auto-ship/SKILL.md`** (423 → 258줄): Step 0~6 중복 내용을 `github-flow-impl` 위임 단일 블록으로 교체. 유지보수 포인트가 `github-flow-impl` 하나로 통일.
- **`write-techspec/SKILL.md`** (651 → 621줄): "금지 예시 2 — Todo 캘린더" 16개 반례 블록 삭제. 규칙 한 문장으로 대체.
- **`ci-cd-pipeline/SKILL.md`** (652 → 633줄): 노드 3b(Playwright E2E on PR) 설명 ~40줄 → ~20줄 압축. "Walking Skeleton과의 관계" 섹션 3줄로 축약.
- **`write-prd/SKILL.md`** (626 → 623줄): Phase 3 페르소나 선택지 예시 인물 묘사 제거.
- **`ship.md` 커맨드**: `argument-hint`에 GAN 플래그 추가(`--no-eval`, `--eval-threshold`, `--eval-economy`, `--eval-strict`).

**총 -244줄 (-8%).** 스킬 동작·출력 형식·에이전트 호출 방식은 변경 없음.

---

## [1.0.0] — 2026-04-19

### 추가

#### GAN Generator-Evaluator 품질 루프 (핵심 신규 기능)

- **`sdlc-contracting` 서브에이전트** (`model: sonnet`): 이슈의 Acceptance Criteria를 테스트 가능한 명제(TC)로 번역하여 `docs/evaluations/issue-<N>/sprint-contract.md`에 잠금. `/implement` Step 4.5에서 호출.
- **`sdlc-code-generator` 서브에이전트** (`model: sonnet`): sprint-contract의 TC를 충족시키는 코드 생성 또는 이전 qa-report feedback 반영 재구현. `/implement` Step 4 / 재진입에서 호출.
- **`sdlc-code-evaluator` 서브에이전트** (`model: opus`): 실제 명령 출력(`npm test`, `git diff`)을 인용하며 7항목 rubric으로 채점, `qa-report-iter-<K>.md` 생성. `/implement` Step 5.5에서 호출.
- **7항목 평가 rubric**: TC Pass Rate, Build & Test Health, AC Coverage, Code Hygiene, Scope Discipline, Regression Safety, User Value Trace. PASS 조건: 평균 ≥ 8.0 AND 모든 항목 ≥ 6.0.
- **파일 기반 상태 공유** (`docs/evaluations/issue-<N>/`): 세션이 끊겨도 중단점부터 루프를 재개할 수 있음.
- **plateau 감지**: iter간 평균 상승폭 < 0.3이면 조기 중단, Evaluator가 "해결 불가 사유" 명시.
- **PR 본문 자동 첨부**: qa-report 점수 궤적 (예: `5.6 → 7.2 → 8.1`) 포함.

#### `/implement` 스킬 개선 (`github-flow-impl`)

- Step 4.5 (Contracting), Step 5.5 (Evaluator), Step 5.6 (분기) 삽입.
- **GAN 루프 제어 플래그** 추가:

  | 플래그 | 기본값 | 설명 |
  |--------|--------|------|
  | `--no-eval` | — | GAN 루프 건너뜀 (레거시 호환) |
  | `--eval-threshold <N>` | `8.0` | rubric 평균 임계값 |
  | `--eval-max-iter <N>` | `3` | 최대 반복 횟수 |
  | `--eval-economy` | — | Evaluator를 Sonnet으로 전환 (~$1.2/이슈) |
  | `--eval-strict` | — | Generator도 Opus로 전환 (~$6.0/이슈) |

- 루프 상수 명시: `IMPL_ITER_MAX=3`, `EVAL_THRESHOLD=8.0`, `EVAL_ITEM_MIN=6.0`, `PLATEAU_EPS=0.3`.

#### `/ship` · `/ship-all` 스킬 개선 (`auto-ship`)

- 로컬 GAN 루프(Step 4.5/5.5/5.6)를 `github-flow-impl`에 위임.
- 두 독립 피드백 루프 명세: 로컬 GAN 루프(비즈니스 로직) ↔ 원격 CI 루프(파이프라인). 각각 독립 카운터(`IMPL_ITER_MAX` / `RETRY_COUNT`).

#### 설치 관리 (`bin/install.js`)

- `dist/agents/*.md` → `.claude/agents/` 복사 루프 추가 (기존 skills/commands에 이어 agents 처리).
- `list` / `uninstall` 명령에 agents 대칭 처리 추가.
- **버전 메타 파일** (`go-sdlc-gan.json`): 설치 시 버전·날짜·스코프 기록, `list`에서 표시, `uninstall` 시 제거.
- 배너 동적 버전 표시 (`v${PKG_VERSION}`).
- `help` 명령에 버전별 설치/제거 구문 추가.

#### 패키지 이름 변경

- `go-sdlc` → **`go-sdlc-gan`** (package.json `name`, `bin`, repository/homepage/bugs URL 일괄 변경).

---

## 비용 참고 (이슈 1건당 추정)

| 구성 | Generator | Evaluator | 대략 비용 |
|------|:---------:|:---------:|:--------:|
| 기본 | Sonnet 4.6 | Opus 4.7 | ~$1.9 |
| `--eval-economy` | Sonnet 4.6 | Sonnet 4.6 | ~$1.2 |
| `--eval-strict` | Opus 4.7 | Opus 4.7 | ~$6.0 |

---

[1.2.0]: https://github.com/ischung/go-sdlc-gan/releases/tag/v1.2.0
[1.1.0]: https://github.com/ischung/go-sdlc-gan/releases/tag/v1.1.0
[1.0.1]: https://github.com/ischung/go-sdlc-gan/releases/tag/v1.0.1
[1.0.0]: https://github.com/ischung/go-sdlc-gan/releases/tag/v1.0.0
