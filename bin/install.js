#!/usr/bin/env node
/**
 * go-sdlc-gan installer
 *
 * 전역 설치 (기본):
 *   npx go-sdlc-gan                        → ~/.claude/ 에 모든 스킬 설치
 *   npx go-sdlc-gan uninstall              → ~/.claude/ 에서 제거
 *   npx go-sdlc-gan list                   → 전역 설치 현황
 *
 * 프로젝트 스코프 설치:
 *   npx go-sdlc-gan --project              → 현재 디렉토리의 .claude/ 에 설치
 *   npx go-sdlc-gan --project /some/path   → 지정 경로의 .claude/ 에 설치
 *   npx go-sdlc-gan uninstall --project    → 현재 디렉토리의 .claude/ 에서 제거
 *   npx go-sdlc-gan list --project         → 프로젝트 설치 현황
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
  dim:    (s) => USE_COLOR ? `\x1b[2m${s}\x1b[0m`  : s,
};

// ── 인자 파싱 ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const COMMANDS = new Set(['install', 'uninstall', 'list', 'help']);

let cmd = 'install';
let projectFlagIdx = -1;
let projectPath = null;

for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (COMMANDS.has(a)) {
    cmd = a;
  } else if (a === '--project') {
    projectFlagIdx = i;
    const next = argv[i + 1];
    if (next && !next.startsWith('--') && !COMMANDS.has(next)) {
      projectPath = path.resolve(next);
      i++;
    } else {
      projectPath = process.cwd();
    }
  } else if (a === '--help' || a === '-h') {
    cmd = 'help';
  } else {
    console.error(c.red(`알 수 없는 인자: ${a}`));
    process.exit(1);
  }
}

// ── 경로 설정 ─────────────────────────────────────────────────────────────
const DIST_DIR = path.join(__dirname, '..', 'dist');

const isProjectScope = projectFlagIdx !== -1;
const baseDir        = isProjectScope ? projectPath : os.homedir();
const SCOPE_LABEL    = isProjectScope
  ? `project — ${baseDir}/.claude/`
  : `global — ~/.claude/`;

const SKILLS_DIR   = path.join(baseDir, '.claude', 'skills');
const COMMANDS_DIR = path.join(baseDir, '.claude', 'commands');
const AGENTS_DIR   = path.join(baseDir, '.claude', 'agents');
const DIST_AGENTS  = path.join(DIST_DIR, 'agents');

// ── 유틸리티 ─────────────────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  const existed = fs.existsSync(dst);
  fs.copyFileSync(src, dst);
  return existed;
}

function getMdFiles(dir) {
  if (!dir || !fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => path.join(dir, f));
}

function getSkillNames() {
  if (!fs.existsSync(DIST_DIR)) return [];
  return fs.readdirSync(DIST_DIR).filter((name) => {
    const skillMd = path.join(DIST_DIR, name, 'SKILL.md');
    return fs.existsSync(skillMd);
  });
}

function removeDirIfEmpty(dir) {
  try {
    if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
      fs.rmdirSync(dir);
      return true;
    }
  } catch { /* ignore */ }
  return false;
}

// ── 배너 ─────────────────────────────────────────────────────────────────
function printBanner() {
  console.log('');
  console.log(c.cyan(c.bold('╔══════════════════════════════════════════════╗')));
  console.log(c.cyan(c.bold('║  go-sdlc-gan — SDLC + GAN Quality Loop v1.0 ║')));
  console.log(c.cyan(c.bold('╚══════════════════════════════════════════════╝')));
  console.log('');
  console.log(c.dim(`  대상: ${SCOPE_LABEL}`));
  console.log('');
}

// ── 설치 ─────────────────────────────────────────────────────────────────
function install() {
  printBanner();

  if (isProjectScope && !fs.existsSync(baseDir)) {
    console.log(c.red(`  ✖ 프로젝트 경로가 존재하지 않음: ${baseDir}`));
    process.exit(1);
  }

  console.log(c.bold('[설치 시작]'));
  console.log('');

  ensureDir(SKILLS_DIR);
  ensureDir(COMMANDS_DIR);
  ensureDir(AGENTS_DIR);

  const skillNames = getSkillNames();
  if (skillNames.length === 0) {
    console.log(c.red('  ✖ dist/ 폴더에 스킬 파일이 없습니다.'));
    process.exit(1);
  }

  let totalSkills   = 0;
  let totalCommands = 0;
  let totalAgents   = 0;

  for (const name of skillNames) {
    console.log(c.bold(`  ▸ ${name}`));

    const srcSkill    = path.join(DIST_DIR, name, 'SKILL.md');
    const dstSkillDir = path.join(SKILLS_DIR, name);
    const dstSkill    = path.join(dstSkillDir, 'SKILL.md');
    ensureDir(dstSkillDir);
    const ow = copyFile(srcSkill, dstSkill);
    console.log(`    ${c.green('✔')} 스킬 ${ow ? '업데이트' : '설치'}: ${dstSkill}`);
    totalSkills++;

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

  // GAN 루프용 에이전트 설치 (dist/agents/*.md → .claude/agents/)
  const agentFiles = getMdFiles(DIST_AGENTS);
  if (agentFiles.length > 0) {
    console.log(c.bold('  ▸ agents (GAN Generator-Evaluator)'));
    for (const f of agentFiles) {
      const dstAgent = path.join(AGENTS_DIR, path.basename(f));
      const ow = copyFile(f, dstAgent);
      console.log(`    ${c.green('✔')} 에이전트 ${ow ? '업데이트' : '설치'}: ${path.basename(f, '.md')}`);
      totalAgents++;
    }
    console.log('');
  }

  console.log(c.bold('[설치 완료]'));
  console.log('');
  console.log(`  ${c.cyan('→')} 스킬:      ${c.bold(String(totalSkills))}개  →  ${SKILLS_DIR}`);
  console.log(`  ${c.cyan('→')} 커맨드:    ${c.bold(String(totalCommands))}개  →  ${COMMANDS_DIR}`);
  console.log(`  ${c.cyan('→')} 에이전트:  ${c.bold(String(totalAgents))}개  →  ${AGENTS_DIR}`);
  console.log('');
  console.log(`  ${c.green('Claude Code를 재시작하면 모든 스킬이 활성화됩니다.')}`);
  if (isProjectScope) {
    console.log(`  ${c.dim('(프로젝트 스코프 설치 — 이 프로젝트 안에서만 사용됩니다)')}`);
  }
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
    ['/ship',              '이슈 구현 + CI/CD 통과까지 자동 처리'],
    ['/ship-all',          'Todo 이슈 전체 일괄 자동 ship'],
  ];
  for (const [cmdName, desc] of cmds) {
    console.log(`    ${c.cyan(cmdName.padEnd(22))} ${desc}`);
  }
  console.log('');
}

// ── 제거 ─────────────────────────────────────────────────────────────────
function uninstall() {
  printBanner();
  console.log(c.bold('[제거 시작]'));
  console.log('');

  let removedSkills = 0;
  let removedCmds   = 0;
  let removedAgents = 0;

  for (const name of getSkillNames()) {
    console.log(c.bold(`  ▸ ${name}`));

    const dstSkillDir = path.join(SKILLS_DIR, name);
    if (fs.existsSync(dstSkillDir)) {
      fs.rmSync(dstSkillDir, { recursive: true });
      console.log(`    ${c.green('✔')} 스킬 제거: ${dstSkillDir}`);
      removedSkills++;
    } else {
      console.log(`    ${c.yellow('⚠')} 없음 (건너뜀): ${dstSkillDir}`);
    }

    const cmdDir = path.join(DIST_DIR, name, 'commands');
    for (const f of getMdFiles(cmdDir)) {
      const dstCmd = path.join(COMMANDS_DIR, path.basename(f));
      if (fs.existsSync(dstCmd)) {
        fs.unlinkSync(dstCmd);
        console.log(`    ${c.green('✔')} 커맨드 제거: /${path.basename(f, '.md')}`);
        removedCmds++;
      }
    }
    console.log('');
  }

  // GAN 루프용 에이전트 제거
  const agentFiles = getMdFiles(DIST_AGENTS);
  if (agentFiles.length > 0) {
    console.log(c.bold('  ▸ agents (GAN Generator-Evaluator)'));
    for (const f of agentFiles) {
      const dstAgent = path.join(AGENTS_DIR, path.basename(f));
      if (fs.existsSync(dstAgent)) {
        fs.unlinkSync(dstAgent);
        console.log(`    ${c.green('✔')} 에이전트 제거: ${path.basename(f, '.md')}`);
        removedAgents++;
      }
    }
    console.log('');
  }

  // 프로젝트 스코프에서는 빈 .claude 하위 디렉토리 정리
  if (isProjectScope) {
    const emptyRemoved = [];
    if (removeDirIfEmpty(SKILLS_DIR))   emptyRemoved.push(SKILLS_DIR);
    if (removeDirIfEmpty(COMMANDS_DIR)) emptyRemoved.push(COMMANDS_DIR);
    if (removeDirIfEmpty(AGENTS_DIR))   emptyRemoved.push(AGENTS_DIR);
    const claudeDir = path.join(baseDir, '.claude');
    if (removeDirIfEmpty(claudeDir))    emptyRemoved.push(claudeDir);
    for (const d of emptyRemoved) {
      console.log(c.dim(`  🗑  빈 디렉토리 정리: ${d}`));
    }
    if (emptyRemoved.length) console.log('');
  }

  console.log(c.bold('[제거 완료]'));
  console.log(`  ${c.cyan('→')} 스킬 ${removedSkills}개, 커맨드 ${removedCmds}개, 에이전트 ${removedAgents}개 제거되었습니다.`);
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

  const agentFiles = getMdFiles(DIST_AGENTS);
  if (agentFiles.length > 0) {
    console.log('');
    console.log(c.bold('  에이전트 (GAN Generator-Evaluator):'));
    for (const f of agentFiles) {
      const dstAgent = path.join(AGENTS_DIR, path.basename(f));
      const ok = fs.existsSync(dstAgent);
      console.log(`  ${ok ? c.green('✔') : c.red('✖')}  ${path.basename(f, '.md')}`);
    }
  }
  console.log('');
}

// ── 도움말 ───────────────────────────────────────────────────────────────
function help() {
  console.log(`
go-sdlc-gan — Claude Code SDLC + GAN Quality Loop 설치 도구

전역 설치 (사용자 홈의 ~/.claude/):
  npx go-sdlc-gan                        스킬 설치
  npx go-sdlc-gan uninstall              스킬 제거
  npx go-sdlc-gan list                   설치 현황 확인

프로젝트 스코프 설치 (대상 프로젝트의 .claude/):
  npx go-sdlc-gan --project              현재 디렉토리에 설치
  npx go-sdlc-gan --project /some/path   지정 경로에 설치
  npx go-sdlc-gan uninstall --project    현재 디렉토리에서 제거
  npx go-sdlc-gan list --project         프로젝트 설치 현황

기타:
  npx go-sdlc-gan help                   이 도움말 출력
`);
}

// ── 진입점 ───────────────────────────────────────────────────────────────
switch (cmd) {
  case 'install':   install();   break;
  case 'uninstall': uninstall(); break;
  case 'list':      list();      break;
  case 'help':      help();      break;
}
