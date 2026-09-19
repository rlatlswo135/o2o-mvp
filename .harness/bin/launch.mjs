import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync, spawn, spawnSync } from 'node:child_process';

const roles = ['planner', 'executor', 'reviewer'];
export const sessionName = root => 'harness-' + createHash('sha256').update(fs.realpathSync(root)).digest('hex').slice(0, 12);
const quote = value => `'${String(value).replaceAll("'", "'\\''")}'`;

export function rolePrompt(root, role) {
  if (!roles.includes(role)) throw new Error('Invalid role.');
  const file = path.join(root, '.harness/roles', `${role}.md`);
  return `당신은 이 프로젝트의 ${role}입니다. 모델/thinking/effort는 사용자가 CLI에서 설정합니다. 임의로 바꾸지 않습니다.\n프로젝트 지침과 .harness/FLOW.md·RESUME.md를 따릅니다. 명령은 프로젝트 루트에서 node .harness/bin/c2h.mjs 로 실행합니다.\n${fs.readFileSync(file, 'utf8')}`;
}

export function roleCommand(directory, role, env = process.env) {
  const root = fs.realpathSync(directory);
  const prompt = rolePrompt(root, role);
  const common = `역할 ${role}을 준비하고 node .harness/bin/c2h.mjs resume ${role} 로 현재 상태를 확인한다. 역할 로드 자체로 제품 소스 수정·새 스토리 시작·리뷰 적용은 하지 않는다. 기존 승인된 인계·사용자 명령·검증된 완료 planning_request만 처리한다. 완료 인계는 다음 계획만 허용하며 구현은 별도 승인이다.`;
  const bootstrap = role === 'executor' ? `${common}\n.harness/FLOW.md의 실행자 수신 절차를 읽고 node .harness/bin/c2h.mjs listen executor --timeout 0 을 Bash run_in_background: true로 한 번 시작한다. 이전 세션의 대기 작업이 살아 있다고 가정하지 않는다. native background 완료 알림의 요청 ID를 재검증하고 승인된 스토리 인계면 /executor 절차, 리뷰 회신이면 수정 없이 브리핑한다. 취소/권한 거부는 알리고 수동 /executor 재개 방법을 안내한다. 같은 세션에서 waiter 중복 실행 금지.` : `${common}\n준비 상태만 짧게 알리고 대기한다. planner는 /plan 또는 확장의 검증된 완료 planning_request로 계획하며 /planner로 인계를 재개한다. reviewer는 /reviewer 또는 확장의 유효한 리뷰 요청으로 작업한다.`;
  return { command: role === 'executor' ? 'claude' : 'pi', args: ['--append-system-prompt', prompt, bootstrap], env: { ...env, C2H_ROLE: role, C2H_PROJECT: root }, cwd: root };
}

export function runRole(root, role) {
  const launch = roleCommand(root, role);
  const child = spawn(launch.command, launch.args, { cwd: launch.cwd, env: launch.env, stdio: 'inherit' });
  // Keep the parent only to relay terminal termination and preserve native CLI exit status.
  for (const signal of ['SIGTERM', 'SIGHUP']) process.on(signal, () => child.kill(signal));
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
  return child;
}

export function start(directory, { attach = false, env = process.env, interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY) } = {}) {
  if (attach && !interactive) throw new Error('Attach requires an interactive terminal; use --no-attach.');
  const root = fs.realpathSync(directory);
  const cli = path.join(root, '.harness/bin/c2h.mjs');
  if (!fs.existsSync(cli)) throw new Error('Run Node setup first.');
  const session = sessionName(root);
  const tmux = (...args) => execFileSync('tmux', args, { env, encoding: 'utf8' }).trim();
  const exists = spawnSync('tmux', ['has-session', '-t', session], { env, stdio: 'ignore' }).status === 0;
  if (!exists) {
    const command = role => [process.execPath, cli, 'run', role].map(quote).join(' ');
    let created = false;
    try {
      const reviewer = tmux('new-session', '-d', '-s', session, '-n', 'agents', '-x', '160', '-y', '48', '-c', root, '-e', `PATH=${env.PATH ?? ''}`, '-P', '-F', '#{pane_id}', command('reviewer'));
      created = true;
      const executor = tmux('split-window', '-v', '-l', '50%', '-t', reviewer, '-c', root, '-P', '-F', '#{pane_id}', command('executor'));
      const planner = tmux('split-window', '-h', '-l', '50%', '-t', reviewer, '-c', root, '-P', '-F', '#{pane_id}', command('planner'));
      for (const [role, pane] of Object.entries({ reviewer, planner, executor })) {
        tmux('set-option', '-p', '-t', pane, '@harness_role', role);
        tmux('select-pane', '-t', pane, '-T', role);
      }
      tmux('set-option', '-w', '-t', `${session}:agents`, 'pane-border-status', 'top');
      tmux('set-option', '-w', '-t', `${session}:agents`, 'pane-border-format', ' #{@harness_role} ');
      tmux('set-option', '-w', '-t', `${session}:agents`, 'remain-on-exit', 'on');
      tmux('select-pane', '-t', planner);
    } catch (error) {
      if (created) spawnSync('tmux', ['kill-session', '-t', session], { env, stdio: 'ignore' });
      throw error;
    }
  }
  if (attach) {
    const action = env.TMUX ? 'switch-client' : 'attach-session';
    const result = spawnSync('tmux', [action, '-t', session], { env, stdio: 'inherit' });
    if (result.error || result.status !== 0) throw result.error ?? new Error(`tmux ${action} failed.`);
  }
  return { session, reused: exists, attach: `tmux attach-session -t ${session}`, note: exists ? 'Existing panes preserved; no agents restarted or layout changed.' : 'Role CLIs launched. Login/trust/permission prompts remain interactive.' };
}
