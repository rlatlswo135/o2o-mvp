# UI004 코드 리뷰 1

## 요청·승인·고정 기준

- 요청: `20261006T035506692000Z-2c63b55870a8` (첫 리뷰, executor → reviewer).
- 소스: `files-v1 / 601be12befe5b0096a9cb55de3f553b35ed4ee7a0fd57ac0eb5f2fb48d2461d2`.
- story.md SHA-256: `81cf432da3fa9bdb17415caa5346d0acde841f6b9d83263434d0c183b2655c09`; 실제 hash와 handoff 승인 일치.
- 승인 인계: `20261006T024531435000Z-98f43431fdce`; 계획 출처: `20261006T022710116000Z-796f13c22fdd`.
- `resume reviewer`·inbox 요청과 CURRENT.md는 UI004/reviewing 및 같은 요청을 가리킨다. 승인·포인터·소스 기준 불일치 없음.
- Git HEAD `1f85d8b`에는 UI003 완료본이 아직 포함되지 않았다. 이번 변경은 implementation.md의 선언과 실제 신규 파일·Git diff를 대조했다. 기존 미커밋 `dialog/`, `-dialog-review.tsx`, theme의 overlay, index의 06 섹션은 UI003 변경으로 분리했다. UI004 착수 당시 미커밋 트리의 별도 diff는 없어 기존 변경 귀속은 구현 기록에 의존한다. 소스 hash는 이전 코드 백업이 아니다.

## 판정

**수정 지적 1건: R1 / 중간(P2), 동일 인라인 결과의 연속 표시가 live region 갱신을 만들지 않는다.**

그 밖의 검토 범위에서 확정 결함 없음. 브라우저·전체 QA PASS 또는 DONE 판정이 아니다. 수정·사용자 수동 확인·최종 완료는 별도 승인 절차다.

## 검토·미검토 범위

- 신규 공통 UI 5종(`empty-state`, `error-state`, `skeleton`, `notice`, `toast`) 구현·테스트 10파일 전체.
- `routes/-feedback-review.tsx`, `-feedback-review.util.ts`, `-feedback-review.util.test.ts`, `routes/index.tsx`.
- 직접 관련 Badge의 기호 매핑, Button의 disabled/aria-disabled 동작, SegmentedControl의 name 생성, Table의 읽기 전용 조립·id 생성.
- 승인된 story.md, implementation.md, 공통 범위·구조 및 시안 `ui-02-feedback.png`의 07·08.
- 서버·다른 업무 코드·UI001~UI003 전체 재리뷰는 하지 않았다. 새 의존성·설정·CSS 진입점·공통 토큰 변경은 이번 구현 기록 및 변경 목록에서 없음.

## R1 — 동일 인라인 결과 연속 표시가 상태 no-op이 된다

- **심각도:** 중간 / P2. 동적 알림 전달·반복 조작 경계, 완료 조건 4 관련.
- **위치:** `client/src/routes/-feedback-review.tsx:196-199,254-258`; 연결부 `client/src/shared/ui/notice/notice.tsx:70-79`.
- **실패 조건:** 기본 설정(긴 문구 체크 해제)에서 “성공 알림”을 표시한 뒤 닫지 않고 같은 버튼을 다시 누른다. 경고·실패도 동일하다.
- **원인:** `resultFor(tone, false)`는 고정 `results[tone]` 객체를 그대로 반환한다. 두 번째 `setInline`에 현재 state와 `Object.is`가 같은 객체를 전달하므로 새 사건이 상태 변경으로 표현되지 않는다. LiveNotice의 해당 status/alert 내용에도 새 텍스트·노드 삽입이 없다.
- **영향:** 활성화 가능한 표시 버튼을 눌러도 두 번째 결과 알림의 live 갱신이 발생하지 않는다. 첫 알림 및 **닫기 후** 재표시는 가능하지만, 열려 있는 인라인 알림의 같은 결과 재표시를 보호하지 못한다. Toast는 의도적으로 재표시를 막으므로 이 지적 대상이 아니다.
- **최소 수정안:** 인라인 소비자에 표시 사건을 구분하는 작은 revision/key를 두고, 빈 status/alert 컨테이너는 유지하면서 해당 사건의 내부 Notice를 새로 삽입하도록 연결한다. 단순 객체 복사만으로는 동일 텍스트 DOM이 그대로 남을 수 있으므로 충분한 수정이 아니다. 전역 저장소·큐·새 의존성은 필요 없다.
- **검증 요청:** executor가 각 tone에서 같은 버튼 연속 활성화 시 컨테이너 동일성 유지 + 내부 알림 갱신, 포커스 유지·단일 live 영역·닫기 후 복귀를 확인한다. 가능한 경우 실제 스크린리더 전달도 확인하며, 미실행이면 미실행으로 남긴다. 새 revision 분기는 작은 자동 검증을 남긴다.
- **직접 근거:** 아래 비변경 Node repro로 현재 소스의 `results`·`resultFor`를 메모리에서 평가했다. success/warning/danger 모두 두 번 반환한 객체가 동일함을 확인했다. React의 동일 state/동일 DOM 갱신 문제는 코드 분석 근거다.
- **불확실성:** reviewer는 React 이벤트·DOM·스크린리더를 실행하지 않았다. 특정 보조기기의 실제 발화 결과를 재현했다고 주장하지 않는다. 확정한 문제는 동일 표시 요청에 새 state/live 내용 변경이 없다는 점이다.

### R1 직접 repro (프로젝트 루트, 파일 생성·변경 없음)

```bash
node --input-type=module <<'NODE'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
const source = readFileSync('client/src/routes/-feedback-review.tsx', 'utf8');
const results = source.match(/const results: Record<NoticeTone, NoticeContent> = (\{[\s\S]*?\n\});/)[1];
const detail = source.match(/const longDetail =\s*("[^"]*");/)[1];
const helper = source.match(/function resultFor\(tone: NoticeTone, long: boolean\): NoticeContent (\{[\s\S]*?\n\})/)[1];
const resultFor = runInNewContext(`const results = ${results}; const longDetail = ${detail}; (function resultFor(tone, long) ${helper})`);
for (const tone of ['success', 'warning', 'danger']) {
  assert.equal(Object.is(resultFor(tone, false), resultFor(tone, false)), true);
  console.log(`${tone}: same object`);
}
NODE
```

실제 실행 결과: 3 tone 모두 동일 객체. 위 코드는 결함 조건을 확인하는 repro이며, 수정본 PASS 테스트는 아니다.

## 실행자 검토 질문에 대한 답

1. **LiveNotice 단일 전달·비중첩:** `notice.tsx:70-79`의 상시 빈 status/alert 및 tone별 한 영역 배치는 적절하다. Notice/Toast wrapper는 추가 live 의미가 없다. 다만 구조 존재만으로 모든 재표시의 전달을 증명하지 못하며 동일 인라인 사건은 R1에 해당한다.
2. **열린 Toast 표시 막기:** `-feedback-review.tsx:267-280,333-349`의 guard는 현재 결과 교체를 막으며 마지막 성공한 표시 트리거도 보존한다. 이유 문구·aria-describedby로 제한을 설명하므로 완료 조건 5의 동작 요구는 충족한다. 활성처럼 보이는 버튼 및 disabled 상태 미노출은 UX/접근성 개선 판단 항목이지 현재 결과가 교체되는 확정 결함은 아니다. 기존 Button의 aria-disabled 덮어쓰기는 기존 계약이므로 이번 리뷰가 자동 수정·범위 확대를 승인하지 않는다.
3. **재시도 정리·포커스:** util의 pending timer 가드·cancel, 수동 선택/언마운트 정리 및 사라지는 재시도 버튼 대신 조회 region 포커스는 작은 가상 예시에 맞는다. 네트워크 재시도 엔진으로 확장하지 않았다. 관련 3개 fake-timer 테스트는 중복·취소·재시작 분기를 보호한다(읽기만 수행).
4. **max-dependencies 2 warnings:** 조립 파일의 import 수 경고다. 현재 구체적 런타임 위험이 없어 차단 지적으로 만들지 않는다. 경고 제거만을 위한 barrel·framework·불필요 파일 분할은 요구하지 않는다. 신규 warning이라는 사실은 보존한다.

## 계획 충족·확인 사항

| 조건 | 코드 검토 | 실행 증거 출처·한계 |
| --- | --- | --- |
| 1 네 조회 상태 | query별 상호 배타 분기, Skeleton busy·읽을 수 있는 label/장식 숨김, data에 공통 Table/Badge·별도 선택 radio 없음 | executor dev/preview 네 상태·AX·id/그룹 회귀 기록 인용 |
| 2 재시도 | start 가드·800ms timer·cancel, 수동 변경/언마운트 정리, region 포커스 | util 테스트 코드 확인. executor 1회·늦은 완료 차단 증거 인용; reviewer 이벤트 실행 없음 |
| 3 빈 액션 | 공통 제목·설명과 조건부 children, 액션 유/무 예시, 로컬 count만 변경 | executor 키보드/클릭·실제 등록 없음 기록 인용 |
| 4 알림 | 의미별 기호·텍스트·색, 정적 Notice live 없음, LiveNotice 한 영역 배치, 표시 핸들러 focus 호출 없음 | R1은 연속 같은 인라인 사건 누락. SSR은 구조만 확인, 실제 낭독은 미검증 |
| 5 닫기·유지 | 선택 대상 제거·유효한 트리거/다음 닫기로 복귀, Toast timer/본문 onClick 없음·guard 유지 | executor 반복 닫기/재표시·6초 유지·본문 비닫힘 증거 인용 |
| 6 작은 화면·긴 문구 | 줄바꿈·고정 폭 제한·정적 Skeleton/Toast, 페이지 하단 여유 | executor 375×700·긴 예시·reduced-motion 에뮬레이션 증거. 임의 길이/더 낮은 뷰포트는 미검증 |
| 7 회귀·경계 | 기존 01~06 조립 유지, shared에 업무/route 의존 없음, 토큰 재사용 | 기존 45개 유지·UI003 drag/닫힘 등은 executor 증거. UI003 별도 스크립트 40/41 중 섹션 수는 예정된 차이로 기록됨; 41/41로 재표기하지 않음 |
| 8 시안·완료 | 07 표현·08 세 알림 및 안내를 코드/시안과 대조. 상태 선택형 배치·기존 Button 재사용은 범위에 부합 | 구현 화면 직접 미확인. 사람 아이콘 생략·기존 버튼 크기·수동 Toast 방향·두 시안 대응표는 사용자 확인 필요. S001 완료 아님 |

## 검증 증거와 미검증 위험

### reviewer 직접 수행

- `resume reviewer`, `inbox reviewer`: 동일 요청·승인·소스 기준 확인.
- story.md `shasum -a 256`: 승인 hash 일치.
- 대상 Git diff·신규 파일/테스트 정적 검토, 직접 소비자 참조 검색.
- `git diff --check`: 출력 없음. whitespace 검사이지 제품 QA가 아니다.
- R1 메모리 기반 Node repro만 실행. 파일·소스·생성물 변경 없음.
- **브라우저·E2E·dev server·빌드·전체 suite·종합 QA 미실행.**

### executor 기록 인용 (`implementation.md`, 2026-10-06)

- 신규 6파일 18개, 전체 17파일 63개 assertion 통과 기록. Vitest 종료 timeout은 기존과 같다고 기록했으며, 현재 전체 명령 exit code는 구현 표에 명시되지 않았다. reviewer가 성공 종료를 독립 확인한 것으로 취급하지 않는다.
- 전체 check 기존 포맷 3파일 FAIL, 기존 warning 1 + 신규 max-dependencies 2. build 성공 기록.
- dev/preview 각 59/59, CSS·AX·포커스·가상 재시도·작은 화면·기존 Dialog 회귀 증거. scratchpad 검증은 reviewer 미재실행.
- 실제 스크린리더·Safari·Firefox·실기기·실제 OS reduced-motion 설정 미실행.

### 추가 한계 (수정 지적 아님)

- `toast.tsx:28-40`에는 세로 max-height/overflow가 없다. 현재 긴 예시보다 더 긴 내용이나 낮은 뷰포트에서 카드 높이가 사용 가능한 높이를 넘으면 상단 닫기가 화면 밖으로 갈 위험은 있다. 현재 375×700 데모 실패로 확인하지 않았으므로 확정 결함으로 판정하지 않는다. 실제 업무 소비 전에 내용 크기·뷰포트 경계를 검증한다.
- devtools와 Toast 겹침, 좁은 화면에서 Toast의 콘텐츠 가림은 executor 미해결 기록을 유지한다. production에서 같은 문제를 재현한 것으로 취급하지 않는다.

## 인계 경계

보고서 저장 → review_ready → `c2h_review_next` send/discuss 선택. 명시적 send 전 reply/ack 없음. 소스·승인된 story.md는 변경하지 않는다. R1 또는 권고가 전달되어도 수정·DONE 승인으로 간주하지 않는다.
