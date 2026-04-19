---
description: Todo 이슈 전체를 DAG 레벨 순서에 따라 순차적으로 ship(구현+CI/CD 통과)합니다. 사용법: /ship-all [--skip #N] [플래그]
argument-hint: "[--skip #이슈번호] [--no-eval] [--eval-threshold <N>] [--eval-economy] [--eval-strict]"
allowed-tools: Bash(git *), Bash(gh *)
---

`auto-ship` 스킬의 지침에 따라 Todo 이슈 전체를 처리하라.

인자: $ARGUMENTS

- `--skip #N` → 해당 이슈 번호를 건너뜀
- `--no-eval` → GAN 루프 건너뜀 (단순 구현 경로)
- `--eval-threshold <N>` → rubric 평균 임계값 (기본 8.0)
- `--eval-economy` → Evaluator를 Sonnet으로 전환 (비용 절감)
- `--eval-strict` → Generator도 Opus로 전환 (최고 품질)

---

## 실행 전 사전 점검

### 1단계: 환경 및 Todo 이슈 목록 확인

`auto-ship` 스킬의 Step 0(환경 감지)과 Step 0.5(칸반 자동화 확인)을 먼저 실행한다.

이후 아래 명령으로 Todo 이슈 전체 목록을 조회한다:

```bash
gh project item-list PROJECT_NUMBER --owner OWNER --format json --limit 500
```

Status가 "Todo"인 아이템만 필터링한다. Todo 이슈가 0개이면:

```
ℹ️  Todo 이슈가 없습니다. 모든 이슈가 처리되었거나 칸반 보드가 비어 있습니다.
   칸반 현황 확인: /kanban-status
```

출력 후 중단한다.

### 2단계: DAG 레벨 분석

각 이슈의 제목 접두어에서 DAG 레벨을 감지한다:
- `[L0]` 접두어 → 레벨 0 (CI/CD 정리 이슈, 최우선)
- `[L1]` 접두어 → 레벨 1 (CI 게이트 이슈)
- `[L2]` 접두어 → 레벨 2 (CD 진입 이슈)
- `[L3]` 접두어 → 레벨 3 (CD 후처리 이슈)
- 접두어 없음 → 레벨 99 (기능 이슈, CI/CD 이슈 이후 처리)

### 3단계: --skip 인자 처리

인자에 `--skip #N` 또는 `--skip N` 형식이 있으면 해당 이슈 번호를 SKIP_LIST에 추가한다.
SKIP_LIST에 포함된 이슈는 처리 계획에서 제외한다.

---

## 처리 계획 출력

실행 전 처리 순서를 사용자에게 보고한다:

```
📋 /ship-all 처리 계획

Todo 이슈 총 N개 (DAG 레벨 순서)

  레벨 0 (CI/CD 정리):
    • #N1  [L0][CI/CD] 기존 워크플로우 제거 및 재구성

  레벨 1 (CI 게이트):
    • #N2  [L1][CI] Static Analysis 및 Security Scan
    • #N3  [L1][CI] Unit/Integration Test CI Gate

  레벨 2 (CD 진입):
    • #N4  [L2][CD] Docker Build & Push
    • #N5  [L2][CD] GitHub Pages 배포

  레벨 99 (기능 이슈):
    • #N6  로그인 페이지 구현
    • #N7  회원가입 API 구현

진행하려면 Enter를 누르거나, --skip #N 으로 특정 이슈를 건너뛸 수 있습니다.
```

---

## 순차 처리 루프

레벨 오름차순, 동일 레벨 내에서는 칸반 보드 position 순으로 처리한다.

각 이슈에 대해 아래 헤더를 출력하고 `auto-ship` 스킬의 Step 1~Step 8을 완전히 실행한다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[이슈 K/N 처리 중] #ISSUE_NUMBER ISSUE_TITLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

한 이슈가 **성공**(CI/CD 통과)하거나 **실패**(3회 초과)한 뒤 다음 이슈로 넘어간다.

### 이슈 3회 초과 실패 시 처리

1. 해당 이슈를 FAILED_LIST에 기록
2. 이슈의 칸반 상태를 "In Progress"로 유지 (Done 이동 금지)
3. 아래를 출력하고 **다음 이슈 처리 계속**:

```
⚠️  #ISSUE_NUMBER 이슈는 CI/CD 자동 수정 한계 초과로 건너뜁니다.
   나중에 /ship #ISSUE_NUMBER 로 재시도할 수 있습니다.
```

---

## 최종 보고

모든 이슈 처리가 완료되면 아래 요약을 출력한다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ /ship-all 완료

처리 결과 요약:
  ✔️  성공 (CI/CD 통과): N개
  ⚠️  실패 (수동 개입 필요): M개
  ⏭️  건너뜀 (--skip): K개

성공한 이슈:
  • #N1  이슈 제목  →  PR: https://github.com/.../pull/...
  ...

수동 개입이 필요한 이슈:
  • #N2  이슈 제목  →  PR: https://github.com/.../pull/...
         마지막 실패: 실패 원인 한 줄 요약
  ...

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
칸반 보드 현황 확인: /kanban-status
실패 이슈 재시도: /ship #N
```
