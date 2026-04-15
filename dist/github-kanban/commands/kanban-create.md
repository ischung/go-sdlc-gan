---
description: GitHub Projects 칸반 보드를 생성하고 오픈 이슈를 Todo에 등록합니다. 사용법: /kanban-create [프로젝트 이름] [owner/repo(선택)]
---

GitHub Projects 칸반 보드를 생성하는 전체 워크플로우를 실행해줘.

인수: $ARGUMENTS

인수 처리 규칙:
- 인수가 없으면: 프로젝트 이름을 먼저 사용자에게 질문하고, 리포지토리는 현재 디렉토리에서 자동 감지
- 인수가 1개(이름만): 해당 이름으로 현재 리포지토리에 보드 생성
- 인수가 2개(이름 + owner/repo): 지정한 이름과 리포지토리로 보드 생성

반드시 아래 순서로 처리할 것:
1. `gh auth status`로 인증 상태 먼저 확인
2. `gh repo view --json owner,name`으로 리포지토리 Owner 자동 감지 (명시되지 않은 경우)
3. 동일 이름 프로젝트 중복 여부 확인 (`gh project list --owner <OWNER> --format json`)
4. `gh project create --owner <OWNER> --title "<이름>"` 으로 신규 프로젝트 생성
5. GraphQL로 Status 컬럼 4개 구성: Todo / In Progress / Review / Done
6. `gh issue list --state open --limit 500`으로 이슈 전체 조회
7. 각 이슈를 `gh project item-add`로 순차 등록 (sleep 0.3 포함)
8. `gh project item-edit`으로 전체 이슈를 Todo 상태로 설정
9. 완료 후 프로젝트 URL과 상태별 이슈 수 요약 출력

bundled 헬퍼 스크립트 사용도 안내할 것:
```bash
bash .claude/skills/github-kanban/scripts/create_kanban.sh "<이름>" "<owner/repo>"
```
