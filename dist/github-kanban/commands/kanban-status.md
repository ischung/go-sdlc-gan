---
description: GitHub Projects 칸반 보드의 현재 상태(컬럼별 이슈 수, 목록)를 조회합니다. 사용법: /kanban-status [프로젝트번호] [owner(선택)]
---

GitHub Projects 칸반 보드의 현재 현황을 조회하고 요약해줘.

인수: $ARGUMENTS

인수 처리 규칙:
- 인수가 없으면: 현재 리포지토리 Owner 기준 프로젝트 목록 출력 후 선택 안내
- 인수가 프로젝트 번호: 해당 보드 상태 조회
- 인수가 번호 + owner: 지정 owner의 해당 번호 보드 조회

조회 및 출력 순서:
1. `gh repo view --json owner`로 Owner 자동 감지 (명시 없는 경우)
2. `gh project item-list <번호> --owner <OWNER> --format json --limit 500`으로 전체 아이템 조회
3. 각 아이템의 Status 필드값 기준으로 그룹핑하여 집계
4. 아래 형식으로 현황 출력:

```
📋 프로젝트: <이름>
🔗 URL: https://github.com/orgs/<OWNER>/projects/<번호>
📅 마지막 업데이트: <날짜>

📊 상태별 이슈 현황:
┌─────────────────┬──────┐
│ 상태            │  수  │
├─────────────────┼──────┤
│ 📌 Todo         │  N개 │
│ 🔨 In Progress  │  N개 │
│ 👀 Review       │  N개 │
│ ✅ Done         │  N개 │
│ ❓ 상태 미설정   │  N개 │
├─────────────────┼──────┤
│ 합계            │  N개 │
└─────────────────┴──────┘

🔨 In Progress 이슈 목록:
  • #12 - <이슈 제목>
  • #7  - <이슈 제목>

👀 Review 이슈 목록:
  • #9  - <이슈 제목>
```

5. In Progress가 WIP Limit(2개)을 초과하면 경고 메시지 출력:
   `⚠️ In Progress 이슈가 X개입니다. WIP Limit(권장 1~2개)을 초과했습니다.`

6. Todo가 0개이고 Done이 전체의 100%이면:
   `🎉 모든 이슈가 완료되었습니다!`
