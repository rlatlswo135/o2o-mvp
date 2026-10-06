# S001R2 코드 리뷰 1 — A(FE 화면·가상 동작)만

## 요청·승인·기준

- 요청 ID: `20261006T070037704000Z-80bde91f87c3` (첫 리뷰).
- 소스 기준: `files-v1 / 099e2fc70c013e7da366c6a085e01683be2306061bf1b29cf130fd95a216c351`.
- 승인 story.md SHA-256: `dcde0526aa0b26b53b907351337af1816b4cb5ddcc3a0c3cb457df7a619d4c8b`, 실제 hash 일치.
- handoff: `20261006T063921038000Z-eae14113be08`; 계획 출처: `20261006T041635308000Z-c8e7d91206a1`.
- `resume reviewer`·inbox·CURRENT.md: S001R2/reviewing, 요청·승인·소스 기준 일치.
- 비교 기준: HEAD `bf61529`. 착수 시 client clean이었다는 executor 기록과 현재 Git diff·신규 파일 목록을 대조했다. 과거 UI 리뷰 기준 `1f85d8b`는 이번 비교에 쓰지 않았다.

## 판정·승인 경계

**R1 중간(P2): 조회 실패/대기 중 저장 성공의 목록 반영·늦은 조회 보호 누락.**
**R2 낮음(P3): 신규 Props·입력 타입이 client/AGENTS.md의 type alias 지침과 불일치.**

A 완료 조건 2·5의 경계가 R1에서 충족되지 않는다. R2는 런타임 결함이 아닌 명시적 프로젝트 규칙 누락이다. 그 외 검토 범위에서 추가 확정 결함 없음.

**B(사용자 직접 BE)·C(실제 연결)·학습 게이트는 검토/PASS 대상이 아니다.** FE 화면 확인도 전체 S001 DONE이 아니다. 서버·DB 영속성·동시성·인증/샵 접근 보호 완료를 주장하지 않는다.

## 검토 범위·한계

- `client/src/features/customers/` 신규 12파일 전체(구현 8, 테스트 4).
- 신규 `routes/customers.tsx`, 수정 `routes/index.tsx` 및 `routeTree.gen.ts` diff.
- 직접 연결되는 공통 LiveNotice의 `noticeKey` 동작, 기존 공통 UI API와 타입 지침, 승인된 S001R2 및 기존 구조 문서, 시안 `02-ink-blue.png`.
- 공유 UI 전체 재리뷰·서버·다른 업무 기능·브라우저/종합 QA는 하지 않았다. routeTree 생성 경로는 executor 기록을 인용하며 생성기를 재실행하지 않았다.

## R1 — 저장 성공 후 목록을 확정하지 않아 실패 상태 또는 늦은 빈 조회가 남는다

- **심각도:** 중간 / P2.
- **위치:** `client/src/features/customers/use-customer-mock.ts:37-50,60-70`; 연관 `customer-mock.ts:38-41`, `customers-page.tsx:66-72`.
- **실패 조건 A(동시 조작 없이 재현 가능한 경로):** 다음 조회 결과를 ‘조회 실패’로 고르고 다시 조회해 실패 화면을 만든다. 그 상태에서 새 고객을 정상 저장한다. `store.save`는 성공하지만 성공 updater는 `current.kind === "loaded"`일 때만 목록을 바꾼다. 현재 failed를 그대로 반환하므로 성공 안내·폼 닫힘은 일어나도 고객 표·수는 표시되지 않는다. “목록 맨 위에 추가했어요” 문구와 화면이 일치하지 않는다.
- **실패 조건 B(늦은 빈 조회):** 유효 저장을 먼저 시작하고 600ms 안에 ‘빈 결과’ 재조회를 시작한다. 저장 완료 때 query는 loading이므로 반영을 건너뛴다. 뒤늦은 빈 조회 완료가 `store.list("empty")`를 실행하면서 저장소 전체를 비운다. 성공한 고객은 화면뿐 아니라 가상 저장소에서도 사라지고, 정상 재조회에서도 복구되지 않으며 같은 번호를 다시 저장해도 duplicate가 아니다.
- **원인:** 조회·저장 각각의 중복 가드는 있지만 저장 성공을 더 오래된 조회와 조정하지 않는다. 정상 조회끼리의 두 순서는 완료 시점 store 읽기로 작동하나 failed/empty 결과는 같은 보장이 없다.
- **영향:** A 완료 조건 2의 성공 시 목록/수 갱신, 조건 5의 늦은 완료 보호 누락. 범위는 페이지 로컬 **가상 데이터**이며 실제 고객 DB 손실로 확대 해석하지 않는다. 명시적으로 빈 결과를 시연하며 기존 예시를 비우는 정책 자체를 지적하는 것이 아니라, 성공한 저장 뒤 이미 대기 중인 조회가 그 결과를 지우는 순서를 지적한다.
- **최소 수정안:** 가상 저장 성공에서 대기 중인 목록 작업을 취소하고 가상 저장소의 현재 정상 목록으로 query를 확정한다. 이 구현에서는 `listTask.cancel()` 후 `setQuery(store.list("success"))` 같은 작은 처리가 두 조건을 함께 해결할 수 있다. 실제 요청 엔진·repository interface·전역 상태를 만들 필요 없다. 그 뒤 사용자가 새로 요청한 실패/빈 조회는 기존 시연 정책대로 처리한다.
- **검증 요청:** 실패 목록→저장 성공, 저장→대기 중 empty/failure 조회, 조회→저장 양쪽 순서에 대한 좁은 상태 검증을 남긴다. 성공 고객 1회·수/표·정상 재조회 유지·중복 비교 유지, 이전 query가 결과를 덮지 않음을 확인한다. executor는 같은 실제 화면 경로도 확인한다.
- **직접 근거:** 아래 Node repro가 실제 저장소와 소스에서 추출한 query updater를 검사했다. failed updater 보존, 늦은 empty 후 정상 목록 0명·동일 번호 재저장 성공을 확인했다.
- **불확실성:** React 이벤트·600ms 화면 클릭 타이밍을 reviewer가 실행한 것은 아니다. 확정 근거는 실제 순수 저장소/업데이터의 결과와 독립 timer callback의 코드 순서다. executor의 정상 결과 겹침 QA는 인정하되 이 경계의 검증으로 확대하지 않는다.

### R1 직접 비변경 repro (프로젝트 루트)

```bash
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createMockCustomerStore } from './client/src/features/customers/customer-mock.ts';
const source = readFileSync('client/src/features/customers/use-customer-mock.ts', 'utf8');
const updater = source.match(/setQuery\((\(current\) =>[\s\S]*?)\n\s*\);/)[1].replace(/,\s*$/, '');
const input = { name: '리뷰 가상 고객', phone: '010-5555-9999' };
const store = createMockCustomerStore();
const result = store.save(input, 'success');
assert.equal(result.kind, 'saved');
const update = runInNewContext(`(${updater})`, { result });
const failed = { kind: 'failed' };
assert.equal(update(failed), failed);
assert.equal(store.list('success').customers.length, 6);
console.log('saved but query remains failed');
const overlap = createMockCustomerStore();
assert.equal(overlap.save(input, 'success').kind, 'saved');
assert.equal(overlap.list('empty').customers.length, 0);
assert.equal(overlap.list('success').customers.length, 0);
assert.equal(overlap.save(input, 'success').kind, 'saved');
console.log('late empty erases saved customer and duplicate comparison');
NODE
```

실제 결과: 두 조건 assertion 확인(exit 0). 결함 존재를 확인한 repro이며 수정본 PASS 테스트가 아니다. 첫 시도는 추출된 함수 인자의 trailing comma 때문에 VM SyntaxError로 실패했고, 추출 문자열만 보정해 재실행했다. 제품 코드/파일 수정 없음.

## R2 — 신규 Props·입력 타입에 interface 사용

- **심각도:** 낮음 / P3, 프로젝트 지침 준수. 런타임 차단 사유 아님.
- **위치:** `customer-form.tsx:17`, `customer-list.tsx:26`, `customer-mock-controls.tsx:28`, `customer.ts:10,15` (모두 `client/src/features/customers/` 아래).
- **조건·근거:** 현재 `client/AGENTS.md`는 컴포넌트 Props 및 관련 입력·옵션·컨텍스트에 interface 대신 type alias를 요구한다. 신규 CustomerFormProps/CustomerListProps/CustomerMockControlsProps/CustomerInput/CustomerFieldErrors가 interface로 선언되어 있다. 생성물이나 선언 병합 예외에 해당하지 않는다.
- **영향:** 승인된 기능은 동작할 수 있으나 사용자 프로젝트의 명시적 타입 작성 규칙이 새 feature에 반영되지 않았다. 단순 개인 취향의 리팩터링 제안과 구분한다.
- **최소 수정안:** 해당 신규 선언만 `export type ... = { ... };`로 바꾸며 API·기능·파일 분리는 유지한다. 자동 생성 `routeTree.gen.ts`의 interface는 건드리지 않는다.
- **검증:** 대상 선언 검색 및 변경 파일 타입 검사. 기존 TS2882를 새 진단과 분리한다. reviewer는 선언/지침 대조만 수행했다.

## executor 검토 질문 답변

1. **hook/controls/shell 분리:** 현재 비동기 교체 범위·가상 결과 조작·화면 틀로 실제 책임이 나뉘며 전역 provider/DI나 공통 shell framework는 없다. 이번 규모에서 합치기나 재분리를 요구하지 않는다. import 경고만으로 불필요 추상화를 추가할 이유도 없다.
2. **콜백 저장 API·조회와 겹침:** callback 형태 자체는 적절하고 중복 제출/언마운트 취소가 있다. 정상 조회 결과 겹침은 완료 시점 store 읽기가 유효하나 실패/빈 조회에는 R1이 남는다. ‘loaded일 때만 반영’ 정책을 그대로 승인하지 않는다.
3. **빈 결과 0명:** loaded+빈 배열은 성공한 조회이므로 0명 적절. failed/loading에서는 개수를 숨겨 실패를 0명으로 오인시키지 않는다.
4. **LiveNotice 닫기·복귀:** 단일 결과 영역, 매 사건 noticeKey 증가, 저장 시작 시 이전 결과 비움, 닫기 후 등록 진입 버튼 복귀가 코드상 연결되어 있다. 실제 낭독·모든 포커스 동작 보장은 executor 증거/미검증과 구분한다.

## A 완료 조건 대조

| 조건 | 코드 검토 | 증거·제한 |
| --- | --- | --- |
| A1 경로·화면·기존 / 유지 | 고객 route·생성 트리 및 최소 Link, feature 소유 shell/스타일, 기존 01~08 유지 | executor dev/preview 직접 진입·새로고침·375px 증거 인용. reviewer 화면 실행 없음 |
| A2 등록 성공 | 이름 포커스·입력·저장·식별자·기본 loaded 목록 추가·폼 unmount/복귀 | failed/loading 경계 R1. 정상 성공 화면 QA와 이 경계를 구분 |
| A3 검증·중복 | 이름 trim, 문자열 번호/앞자리 0, 문자 확인, 저장 시 comparablePhone, Field 오류·첫 입력 포커스 | 기존 customer 5개/store 테스트 코드 확인. 이벤트는 executor 기록 |
| A4 저장 중·실패 | readonly·busy·닫기/취소 disabled, saveTask guard, 실패 입력 유지, noticeKey 사건 구분 | executor 중복/반복 실패 증거. React 동작 직접 미실행 |
| A5 조회·늦은 완료 | loading/loaded/failed 분기, 개수 숨김·재시도, unmount timer 취소 | R1에서 완료 간 조정 미흡. 기존 테스트는 독립 작업 취소를 보호하며 교차 query settlement는 보호하지 않음 |
| A6 접근성·좁은 화면 | label/설명/오류, 이름·오류/취소 포커스, 모바일 panel-first grid | executor AX/375px/긴 이름 및 번호 확인 인용. 낭독·타 플랫폼 미검증 |
| A7 가상 경계·회귀 | 페이지별 store, fetch/영속 저장 없음, 실제 고객 입력 금지·저장 미연결 안내, shared 수정 없음 | executor 기존 64개 및 공통 UI 대표 회귀 기록 인용 |
| A8 FE 사용자 확인 | 보고서는 A만 검토 | 사용자 화면/구조 확인 아직 필요. B/C·상속 학습 대기, 전체 DONE 금지 |

## 검증 증거 출처

### reviewer 직접

- `resume reviewer`·inbox, story hash, Git HEAD/대상 diff·신규 파일 읽기: 요청/승인/기준 대조.
- `git diff --check`: 출력 없음. whitespace 검사일 뿐 제품 동작 QA가 아니다.
- R1 store/updater Node repro: 위에 한정해 exit 0. 소스·생성물·의존성 변경 없음.
- **브라우저·E2E·dev server·빌드·전체 suite·종합 QA 미실행.**

### executor 기록 인용 (`implementation.md`, 2026-10-06)

- 전체 21파일 85/85 assertion 통과(기존 64 + 신규 21). Vitest 종료 timeout 메시지는 기준선과 같다고 기록했으나 이번 전체 명령의 종료 code는 표에 명시되지 않음. 성공 종료를 reviewer가 확인한 것으로 취급하지 않는다.
- 전체 no-fmt: 기존 `main.tsx:6` TS2882(styles.css) error 1, warnings 3; 포맷은 생성물 routeTree 1파일 불일치. 신규 진단 0이라고 기록. 기존 실패를 이번 신규 결함으로 돌리지 않는다.
- build exit 0, dev/preview S001R2 각 48/48·공통 UI 회귀 각 69/69. 결과는 독립 재실행하지 않았다.
- coverage 미구성/미실행, 실제 스크린리더·Safari/Firefox·실제 기기 미실행. 목업 QA로 서버 영속성·DB 동시성·접근 통제를 통과했다고 하지 않는다.

## 후속 경계

초안 저장 → review_ready → send/discuss 선택. 명시적 send 전 reply/ack 없음. R1/R2 수신만으로 수정이 승인되지 않는다. FE 사용자 확인 뒤에도 B/C·학습 게이트 때문에 done을 실행하지 않으며, story.md의 외부 의존성 대기 절차를 따른다. 승인된 story.md·제품 소스는 reviewer가 변경하지 않았다.
