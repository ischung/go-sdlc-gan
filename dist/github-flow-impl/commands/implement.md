---
description: GitHub Flow에 따라 이슈를 end-to-end로 자동 구현 (브랜치 → 구현 → GAN 루프 → 테스트 → PR)
argument-hint: "[#이슈번호 | --inline 이슈내용] [--no-eval] [--eval-threshold N] [--eval-max-iter N] [--eval-economy | --eval-strict]"
allowed-tools: Bash(git *), Bash(gh *)
---

`github-flow-impl` 스킬의 지침에 따라 아래 인자를 처리하라.

인자: $ARGUMENTS

## 이슈 소스 (배타적)

- 인자가 없으면 → **자동 선택 모드**: GitHub Projects Todo 열 최상단 이슈 선택
- 인자가 `#숫자` 형태이면 → **번호 지정 모드**: 해당 이슈 번호로 구현
- 인자가 `--inline`으로 시작하면 → **직접 입력 모드**: `--inline` 뒤의 내용을 이슈로 파싱

## GAN 루프 플래그 (조합 가능)

| 플래그 | 동작 |
|--------|------|
| `--no-eval` | Step 4.5/5.5/5.6을 건너뛰고 기존 단순 경로(로컬 테스트 1회 재시도)로 실행 |
| `--eval-threshold <N>` | rubric 평균 임계값을 `N`으로 설정 (기본 8.0) |
| `--eval-max-iter <N>` | Generator-Evaluator 최대 반복 횟수 (기본 3) |
| `--eval-economy` | Evaluator도 Sonnet으로 다운그레이드 — 비용 절감, 실습 수업용 |
| `--eval-strict` | Generator를 Opus로 업그레이드 — 최고 품질, 컨테스트용 |

예시:
- `/implement #42` — 기본 GAN 루프 (Generator=Sonnet, Evaluator=Opus, threshold=8.0, maxIter=3)
- `/implement #42 --eval-economy` — 저비용 모드 (모두 Sonnet)
- `/implement #42 --eval-threshold 7.0 --eval-max-iter 5` — 임계 완화 + 반복 확대
- `/implement #42 --no-eval` — 기존 경로 (GAN 건너뜀)
