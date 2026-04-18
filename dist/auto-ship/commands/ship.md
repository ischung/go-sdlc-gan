---
description: 단일 이슈를 구현하고 CI/CD 파이프라인을 통과할 때까지 자동으로 처리합니다. 사용법: /ship [#이슈번호] [플래그]
argument-hint: "[#이슈번호] [--no-eval] [--eval-threshold <N>] [--eval-economy] [--eval-strict]"
allowed-tools: Bash(git *), Bash(gh *)
---

`auto-ship` 스킬의 지침에 따라 아래 인자를 처리하라.

인자: $ARGUMENTS

- 인자가 없으면 → **자동 선택 모드**: GitHub Projects Todo 열 최상단 이슈 자동 선택
- `#숫자` 또는 `숫자` → **번호 지정 모드**
- `--no-eval` → GAN 루프 건너뜀 (단순 구현 경로)
- `--eval-threshold <N>` → rubric 평균 임계값 (기본 8.0)
- `--eval-economy` → Evaluator를 Sonnet으로 전환 (비용 절감)
- `--eval-strict` → Generator도 Opus로 전환 (최고 품질)

Step 0~6(github-flow-impl 위임, GAN 루프 포함) → Step 7(CI/CD 모니터링, 최대 3회 자동 수정) → Step 8(자동 squash 머지) 순서로 진행한다.
