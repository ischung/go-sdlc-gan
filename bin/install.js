#!/usr/bin/env node
/**
 * claude-code-skills installer
 *
 * npx claude-code-skills             → 설치
 * npx claude-code-skills uninstall   → 제거
 * npx claude-code-skills list        → 설치 현황
 * npx claude-code-skills help        → 도움말
 */

const fs   = require('fs');
const path = require('path');
const os   = require('os');

// ── 색상 출력 ─────────────────────────────────────────────────────────────
const USE_COLOR = process.stdout.isTTY;
const c = {
  green:  (s) => USE_COLOR ? `\x1b[32m${s}\x1b[0m` : s,
  yellow: (s) => USE_COLOR ? `\x1b[33m${s}\x1b[0m` : s,
  cyan:   (s) => USE_COLOR ? `\x1b[36m${s}\x1b[0m` : s,
  bold:   (s) => USE_COLOR ? `\x1b[1m${s}\x1b[0m`  : s,
  red:    (s) => USE_COLOR ? `\x1b[31m${s}\x1b[0m` : s,
};

// ── 경로 설정 ─────────────────────────────────────────────────────────────
const DIST_DIR     = path.join(__dirname, '..', 'dist');
const CLAUDE_DIR   = path.join(os.homedir(), '.claude');
const SKILLS_DIR   = path.join(CLAUDE_DIR, 'skills');
const COMMANDS_DIR = path.join(CLAUDE_DIR, 'commands');

// ── 유틸리티 ─────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  const existed = fs.existsSync(dst);
  fs.copyFileSync(src, dst);
  return existed; // true → 덮어쓰기
}

function getMdFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(dir, f));
}

// dist/ 안의 스킬 폴더 목록을 자동 탐색
function getSkillNames() {
  if (!fs.existsSync(DIST_DIR)) return [];
  return fs.readdirSync(DIST_DIR).filter((name) => {
    const skillMd = path.join(DIST_DIR, name, 'SKILL.md');
    return fs.existsSync(skillMd);
  });
}

// ── 배너 ─────────────────────────────────────────────────────────────────
function printBanner() {
  console.log('');
  console.log(c.cyan(c.bold('╔══════════════════════════════════════════════╗')));
  console.log(c.cyan(c.bold('║     cc-sdlc — Claude Code SDLC Skills v1.0  ║')));
  console.log(c.cyan(c.bold('╚══════════════════════════════════════════════╝')));
  console.log('');
}

// ── 설치 ─────────────────────────────────────────────────────────────────
function install() {
  printBanner();
  console.log(c.bold('[설치 시작]'));
  console.log('');

  ensureDir(SKILLS_DIR);
  ensureDir(COMMANDS_DIR);

  const skillNames = getSkillNames();
  if (skillNames.length === 0) {
    console.log(c.red('  ✖  dist/ 폴더에 스킬 파일이 없습니다.'));
    process.exit(1);
  }

  let totalSkills   = 0;
  let totalCommands = 0;

  for (const name of skillNames) {
    console.log(c.bold(`  ▸ ${name}`));

    // SKILL.md 복사
    const srcSkill    = path.join(DIST_DIR, name, 'SKILL.md');
    const dstSkillDir = path.join(SKILLS_DIR, name);
    const dstSkill    = path.join(dstSkillDir, 'SKILL.md');
    ensureDir(dstSkillDir);
    const ow = copyFile(srcSkill, dstSkill);
    console.log(`    ${c.green('✔')} 스킬 ${ow ? '업데이트' : '설치'}: ${dstSkill}`);
    totalSkills++;

    // commands/ 복사
    const cmdDir   = path.join(DIST_DIR, name, 'commands');
    const cmdFiles = getMdFiles(cmdDir);
    for (const f of cmdFiles) {
      const dstCmd = path.join(COMMANDS_DIR, path.basename(f));
      const ow2    = copyFile(f, dstCmd);
      console.log(`    ${c.green('✔')} 커맨드 ${ow2 ? '업데이트' : '설치'}: /${path.basename(f, '.md')}`);
      totalCommands++;
    }

    console.log('');
  }

  console.log(c.bold('[설치 완료]'));
  console.log('');
  console.log(`  ${c.cyan('→')} 스킬:    ${c.bold(String(totalSkills))}개  →  ${SKILLS_DIR}`);
  console.log(`  ${c.cyan('→')} 커맨드:  ${c.bold(String(totalCommands))}개  →  ${COMMANDS_DIR}`);
  console.log('');
  console.log(`  ${c.green('Claude Code를 재시작하면 모든 스킬이 활성화됩니다.')}`);
  console.log('');
  console.log('  사용 가능한 커맨드:');
  const cmds = [
    ['/write-prd',         'PRD(제품 요구사항 문서) 작성'],
    ['/write-techspec',    'TechSpec(기술 명세서) 작성'],
    ['/generate-issues',   'TechSpec → GitHub 이슈 자동 발행'],
    ['/kanban-create',     'GitHub Projects 칸반 보드 생성'],
    ['/kanban-add-issues', '칸반 보드에 이슈 추가'],
    ['/kanban-status',     '칸반 보드 현황 조회'],
    ['/cicd-pipeline',     'CI/CD 파이프라인 이슈 자동 생성'],
    ['/tdd',               'TDD 워크플로우 시작'],
    ['/implement',         'GitHub 이슈 자동 구현'],
    ['/impl',              '/implement 단축 커맨드'],
  ];
  for (const [cmd, desc] of cmds) {
    console.log(`    ${c.cyan(cmd.padEnd(22))} ${desc}`);
  }
  console.log('');
}

// ── 제거 ─────────────────────────────────────────────────────────────────
function uninstall() {
  printBanner();
  console.log(c.bold('[제거 시작]'));
  console.log('');

  let removed = 0;
  for (const name of getSkillNames()) {
    console.log(c.bold(`  ▸ ${name}`));

    // 스킬 폴더 제거
    const dstSkillDir = path.join(SKILLS_DIR, name);
    if (fs.existsSync(dstSkillDir)) {
      fs.rmSync(dstSkillDir, { recursive: true });
      console.log(`    ${c.green('✔')} 스킬 제거: ${dstSkillDir}`);
      removed++;
    } else {
      console.log(`    ${c.yellow('⚠')} 없음 (건너뜀): ${dstSkillDir}`);
    }

    // 커맨드 파일 제거
    const cmdDir = path.join(DIST_DIR, name, 'commands');
    for (const f of getMdFiles(cmdDir)) {
      const dstCmd = path.join(COMMANDS_DIR, path.basename(f));
      if (fs.existsSync(dstCmd)) {
        fs.unlinkSync(dstCmd);
        console.log(`    ${c.green('✔')} 커맨드 제거: /${path.basename(f, '.md')}`);
      }
    }
    console.log('');
  }

  console.log(c.bold('[제거 완료]'));
  console.log(`  ${c.cyan('→')} ${removed}개 스킬이 제거되었습니다.`);
  console.log('');
}

// ── 목록 ─────────────────────────────────────────────────────────────────
function list() {
  printBanner();
  console.log(c.bold('[설치 현황]'));
  console.log('');

  for (const name of getSkillNames()) {
    const installed = fs.existsSync(path.join(SKILLS_DIR, name, 'SKILL.md'));
    const mark = installed ? c.green('✔') : c.red('✖');
    console.log(`  ${mark}  스킬: ${name}`);

    for (const f of getMdFiles(path.join(DIST_DIR, name, 'commands'))) {
      const dstCmd = path.join(COMMANDS_DIR, path.basename(f));
      const ok     = fs.existsSync(dstCmd);
      console.log(`       ${ok ? c.green('✔') : c.red('✖')}  /${path.basename(f, '.md')}`);
    }
  }
  console.log('');
}

// ── 도움말 ───────────────────────────────────────────────────────────────
function help() {
  console.log(`
사용법:
  npx claude-code-skills             스킬 설치
  npx claude-code-skills uninstall   스킬 제거
  npx claude-code-skills list        설치 현황 확인
  npx claude-code-skills help        도움말
`);
}

// ── 진입점 ───────────────────────────────────────────────────────────────
const cmd = process.argv[2] || 'install';
switch (cmd) {
  case 'install':   install();   break;
  case 'uninstall': uninstall(); break;
  case 'list':      list();      break;
  case 'help':      help();      break;
  default:
    console.error(c.red(`알 수 없는 명령: ${cmd}`));
    help();
    process.exit(1);
}
