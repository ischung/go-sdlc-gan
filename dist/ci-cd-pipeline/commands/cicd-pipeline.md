---
description: 프로젝트 아키텍처를 분석하여 GitHub Actions 기반 CI/CD 파이프라인 구축 이슈를 자동 생성하고 cicd-issues.md에 저장
argument-hint: "[--dry-run]"
allowed-tools: Bash(git *), Bash(gh *), Bash(find *), Bash(ls *), Bash(cat *)
---

`ci-cd-pipeline` 스킬의 지침에 따라 아래 작업을 수행하라.

인자: $ARGUMENTS

- 인자가 없으면 → 현재 리포지토리를 분석하여 CI/CD 이슈를 생성하고 cicd-issues.md에 저장
- 인자가 `--dry-run`이면 → GitHub 이슈를 실제로 생성하지 않고 생성될 이슈 목록만 출력
