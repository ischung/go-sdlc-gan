---
description: 기존 GitHub Projects 보드에 현재 리포지토리의 오픈 이슈를 추가 등록합니다. 사용법: /kanban-add-issues [프로젝트번호] [owner/repo(선택)]
---

기존 GitHub Projects 칸반 보드에 오픈 이슈를 추가 등록해줘.

인수: $ARGUMENTS

인수 처리 규칙:
- 인수가 없으면: 현재 리포지토리의 프로젝트 목록을 보여주고 사용자가 선택하도록 안내
- 인수가 숫자(프로젝트 번호): 해당 번호의 프로젝트에 현재 리포지토리 이슈 추가
- 인수가 숫자 + owner/repo: 지정 리포지토리 이슈를 지정 프로젝트에 추가

처리 순서:
1. 프로젝트 번호가 없으면 `gh project list --owner <OWNER> --format json`으로 목록 출력 후 선택 안내
2. 대상 프로젝트 번호와 이름을 확인하여 사용자에게 명시적으로 보고 (다른 프로젝트와 혼동 방지)
3. 이미 등록된 이슈는 건너뛰고 새 이슈만 추가 (`gh project item-add` 실패 시 continue)
4. `gh issue list --state open --limit 500 --json number`로 전체 오픈 이슈 조회
5. 각 이슈 순차 등록 — 진행 상황 `[N/전체]` 형식으로 실시간 출력
6. 등록 완료 후: 신규 추가 N개 / 이미 등록됨 N개 / 실패 N개 형식으로 결과 보고

주의: 기존에 In Progress, Review, Done 상태인 이슈는 상태를 변경하지 말 것.
새로 추가된 이슈만 Todo 상태로 설정할 것.
