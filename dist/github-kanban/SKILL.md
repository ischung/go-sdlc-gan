---
name: github-kanban
description: >
  GitHub Projects를 사용하여 칸반 보드를 자동으로 생성하고 이슈를 배치하는 스킬.
  gh CLI 명령어를 활용하여 사용자가 지정한 이름으로 프로젝트를 만들고,
  Todo / In Progress / Review / Done 4개 상태 컬럼을 구성하고,
  현재 리포지토리의 오픈 이슈를 전부 Todo에 등록하고 결과 URL과 요약을 출력한다.
  사용자가 "칸반 보드 만들어줘", "GitHub 프로젝트 생성", "이슈 관리 보드", "프로젝트 보드 설정",
  "gh project", "이슈를 칸반에 등록", "티켓 보드", "스프린트 보드", "애자일 보드" 등을
  언급하면 반드시 이 스킬을 사용할 것.
  프로젝트 이름을 사용자가 제공하지 않으면 먼저 물어본 후 진행할 것.
---

# GitHub Kanban 보드 자동 생성 스킬

이 스킬은 `gh` CLI 도구를 사용하여 GitHub Projects 칸반 보드를 자동으로 생성하고,
현재 리포지토리의 모든 오픈 이슈(티켓)를 보드에 배치하는 전체 워크플로우를 처리한다.

## 슬래시 커맨드 (Claude Code에서 바로 사용)

이 스킬을 설치하면 Claude Code에서 아래 3개의 슬래시 커맨드를 바로 사용할 수 있다:

| 커맨드 | 설명 | 사용 예시 |
|--------|------|-----------|
| `/kanban-create` | 새 칸반 보드 생성 + 이슈 전체 등록 | `/kanban-create "Sprint 1" my-org/my-repo` |
| `/kanban-add-issues` | 기존 보드에 이슈 추가 등록 | `/kanban-add-issues 42` |
| `/kanban-status` | 보드 현황 조회 (컬럼별 이슈 수) | `/kanban-status 42` |

**커맨드 설치 방법** (스킬 설치 후 프로젝트 루트에서 실행):
```bash
# 프로젝트별 커맨드로 등록
mkdir -p .claude/commands
cp .claude/skills/github-kanban/commands/*.md .claude/commands/

# 또는 전체 사용자 커맨드로 등록
mkdir -p ~/.claude/commands
cp .claude/skills/github-kanban/commands/*.md ~/.claude/commands/
```

## 시작 전 확인사항

실행 전에 아래 두 가지를 반드시 확인한다:

1. **프로젝트 이름**: 사용자가 이름을 제공했으면 그대로 사용하고, 없으면 **먼저 질문**한다.
   > "어떤 이름으로 프로젝트 보드를 만들까요?"

2. **리포지토리**: 사용자가 특정 리포지토리를 명시하지 않으면 현재 작업 디렉토리 기준으로 자동 감지한다.

## 전제 조건

- `gh` CLI가 설치되어 있고 `gh auth login`으로 인증이 완료되어 있어야 한다.
- 현재 디렉토리가 GitHub 리포지토리이거나, 대상 리포지토리 정보(`owner/repo`)를 명시해야 한다.

헬퍼 스크립트(`scripts/create_kanban.sh`)를 사용하면 아래 전체 워크플로우를 한 번에 실행할 수 있다.

---

## 워크플로우

### 1단계: 리포지토리 & Owner 자동 감지

```bash
# 현재 리포지토리의 owner와 repo 이름을 한 번에 확인
REPO_INFO=$(gh repo view --json owner,name -q '"\(.owner.login)/\(.name)"')
OWNER=$(gh repo view --json owner -q '.owner.login')
REPO=$(gh repo view --json name -q '.name')
echo "대상 리포지토리: $OWNER/$REPO"
```

사용자가 `owner/repo` 형식으로 직접 지정하면 그 값을 사용한다.

### 2단계: 프로젝트 생성

```bash
PROJECT_TITLE="<사용자가 제공한 이름>"

# 동일 이름의 기존 프로젝트가 있는지 먼저 확인
EXISTING=$(gh project list --owner "$OWNER" --format json | \
  jq -r ".projects[] | select(.title==\"$PROJECT_TITLE\") | .number")

if [ -n "$EXISTING" ]; then
  echo "이미 존재하는 프로젝트를 사용합니다: #$EXISTING"
  PROJECT_NUMBER="$EXISTING"
else
  # 신규 프로젝트 생성
  gh project create --owner "$OWNER" --title "$PROJECT_TITLE"
  sleep 1  # 생성 완료 대기
  PROJECT_NUMBER=$(gh project list --owner "$OWNER" --format json | \
    jq -r ".projects[] | select(.title==\"$PROJECT_TITLE\") | .number")
  echo "프로젝트 생성 완료: #$PROJECT_NUMBER"
fi
```

### 3단계: Status 컬럼 구성 (Todo / In Progress / Review / Done)

GitHub Projects V2의 기본 Status 필드는 `updateProjectV2Field`로 수정이 불가능하다.
대신 **기존 Status 필드를 삭제하고, 4개 옵션을 가진 새 Status 필드를 생성**하는 방식을 사용한다.

> 이 단계는 이슈를 보드에 추가(4단계)하기 전에 실행하므로 데이터 손실이 없다.

```bash
# Project node ID 획득
PROJECT_ID=$(gh project list --owner "$OWNER" --format json | \
  jq -r ".projects[] | select(.number==$PROJECT_NUMBER) | .id")

# 기존 Status 필드 ID 획득
FIELD_ID=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json | \
  jq -r '.fields[] | select(.name=="Status") | .id')

# Review 옵션 존재 여부 확인
HAS_REVIEW=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json | \
  jq -r '.fields[] | select(.name=="Status") | .options[].name' | grep -c "Review" || true)

if [ "$HAS_REVIEW" -gt "0" ]; then
  echo "Review 옵션이 이미 존재합니다."
else
  echo "기존 Status 필드 삭제 후 4개 옵션으로 재생성합니다..."

  # 기존 Status 필드 삭제
  gh api graphql -f query='
    mutation($fieldId: ID!) {
      deleteProjectV2Field(input: { fieldId: $fieldId }) {
        projectV2Field { id }
      }
    }
  ' -f fieldId="$FIELD_ID"

  sleep 1

  # 4개 옵션을 가진 새 Status 필드 생성
  gh api graphql -f query='
    mutation($projectId: ID!) {
      createProjectV2Field(input: {
        projectId: $projectId
        dataType: SINGLE_SELECT
        name: "Status"
        singleSelectOptions: [
          {name: "Todo",        color: GRAY,   description: ""},
          {name: "In Progress", color: YELLOW, description: ""},
          {name: "Review",      color: BLUE,   description: ""},
          {name: "Done",        color: GREEN,  description: ""}
        ]
      }) {
        projectV2Field {
          ... on ProjectV2SingleSelectField {
            id name options { id name }
          }
        }
      }
    }
  ' -f projectId="$PROJECT_ID"

  sleep 1

  # 결과 검증
  HAS_REVIEW_NOW=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json | \
    jq -r '.fields[] | select(.name=="Status") | .options[].name' | grep -c "Review" || true)

  if [ "$HAS_REVIEW_NOW" -gt "0" ]; then
    echo "✅ Status 필드 생성 완료 (Todo / In Progress / Review / Done)"
  else
    echo "⚠️  자동 설정 실패. GitHub Projects UI에서 수동으로 추가해 주세요:"
    echo "   보드 Settings → Fields → Status → Add option → 'Review'"
  fi
fi
```

필요한 4개 상태:

| 상태 | 설명 |
|------|------|
| **Todo** | 모든 이슈가 처음 배치되는 곳 (기본값) |
| **In Progress** | 현재 개발 중 (WIP Limit: 1~2개 권장) |
| **Review** | PR 생성 및 코드 리뷰 진행 중 |
| **Done** | 메인 브랜치 병합 완료 |

> 이미 "Todo", "In Progress" 등의 옵션이 있다면 덮어쓰지 말고 기존 옵션 ID를 활용한다.

### 4단계: 오픈 이슈 전체를 프로젝트에 등록

`gh issue list`는 기본 30개 제한이 있으므로 `--limit 500`을 반드시 사용한다.

```bash
# 오픈 이슈 번호 전체 조회
ISSUES=$(gh issue list --repo "$OWNER/$REPO" --state open \
  --json number --limit 500 -q '.[].number')

TOTAL=$(echo "$ISSUES" | grep -c .)
echo "등록할 이슈 수: $TOTAL개"

# 각 이슈를 프로젝트에 순차 추가 (누락 없이 처리)
COUNT=0
for ISSUE_NUM in $ISSUES; do
  ISSUE_URL="https://github.com/$OWNER/$REPO/issues/${ISSUE_NUM}"
  gh project item-add "$PROJECT_NUMBER" --owner "$OWNER" --url "$ISSUE_URL"
  COUNT=$((COUNT + 1))
  echo "[$COUNT/$TOTAL] 이슈 #${ISSUE_NUM} 등록 완료"
  sleep 0.3  # API 호출 제한 방지
done
```

### 5단계: 등록된 이슈를 모두 'Todo' 상태로 설정

```bash
# GraphQL node ID 획득 (item-edit에 필요)
PROJECT_ID=$(gh project list --owner "$OWNER" --format json | \
  jq -r ".projects[] | select(.number==$PROJECT_NUMBER) | .id")

# Status 필드 ID 및 Todo 옵션 ID 획득
STATUS_FIELD_ID=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json | \
  jq -r '.fields[] | select(.name=="Status") | .id')

TODO_OPTION_ID=$(gh project field-list "$PROJECT_NUMBER" --owner "$OWNER" --format json | \
  jq -r '.fields[] | select(.name=="Status") | .options[] | select(.name=="Todo") | .id')

# 모든 아이템에 Todo 상태 설정
gh project item-list "$PROJECT_NUMBER" --owner "$OWNER" --format json | \
  jq -r '.items[].id' | while read ITEM_ID; do
    gh project item-edit \
      --project-id "$PROJECT_ID" \
      --id "$ITEM_ID" \
      --field-id "$STATUS_FIELD_ID" \
      --single-select-option-id "$TODO_OPTION_ID"
  done
```

### 6단계: 결과 요약 출력

작업 완료 후 반드시 아래 형식으로 결과를 사용자에게 보고한다:

```
✅ GitHub 칸반 보드 생성 완료!

📋 프로젝트 이름: <사용자가 지정한 이름>
🔗 프로젝트 URL: https://github.com/orgs/<OWNER>/projects/<PROJECT_NUMBER>
               (개인 계정인 경우) https://github.com/users/<OWNER>/projects/<PROJECT_NUMBER>

📊 상태별 이슈 현황:
  • Todo       : <N>개 (전체 오픈 이슈)
  • In Progress: 0개
  • Review     : 0개
  • Done       : 0개
  ──────────────────
  • 합계        : <N>개
```

---

## 헬퍼 스크립트 사용법

`scripts/create_kanban.sh`를 사용하면 위 6단계를 한 번에 실행할 수 있다:

```bash
# 기본 사용 (현재 리포지토리, 이름 입력 프롬프트)
bash scripts/create_kanban.sh

# 이름과 리포지토리를 직접 지정
bash scripts/create_kanban.sh "My Project Board" "my-org/my-repo"
```

---

## 오류 처리 및 주의사항

**인증 오류**: `gh auth status`로 로그인 상태를 먼저 확인한다. 미인증 시 `gh auth login` 실행을 안내한다.

**프로젝트 중복**: 같은 이름의 프로젝트가 이미 있으면 새로 생성하지 않고 기존 프로젝트를 재사용한다.

**다른 프로젝트 혼동 방지**: 프로젝트 번호와 이름을 명시적으로 확인하여 다른 진행 중인 프로젝트에 영향을 주지 않도록 한다.

**GraphQL vs REST**: `item-edit` 명령어는 숫자 번호가 아닌 GraphQL node ID가 필요하다. `gh project list`의 JSON 출력에서 `.id` 필드로 획득한다.

---

## 사용 예시

사용자가 이런 방식으로 요청할 수 있다:

- "현재 리포지토리 이슈들을 칸반 보드로 관리하고 싶어"
- "GitHub Projects에 'Sprint 1'이라는 보드 만들어줘"
- "`my-org/my-repo` 이슈들을 '백엔드 보드'에 등록해줘"
- "이슈 티켓을 보드에 배치해줘" (이름 미제공 → 이름 먼저 질문)

어떤 경우든 프로젝트 이름이 확인된 후 워크플로우를 실행하고, 각 단계 결과를 중간 보고한다.
