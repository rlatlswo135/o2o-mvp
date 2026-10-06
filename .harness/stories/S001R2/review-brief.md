# S001R2 리뷰 1 브리핑 — A(FE 화면·가상 동작)만

## 수신 검증

- 결과 메시지 `20261006T071011877000Z-e062bde3af9f`(reviewer → executor, review_result), `reply_to` = 요청 `20261006T070037704000Z-80bde91f87c3`.
- `wait 20261006T070037704000Z-80bde91f87c3 --timeout 1`이 같은 결과를 반환했다.
- 해시 대조:
  - 보고서 `review-1.md` SHA-256 `1c255b4d…42c4`가 메시지 hash와 일치한다.
  - baseline `099e2fc7…c351`이 checkpoint verified_baseline과 일치한다.
  - story hash `dcde0526…c8b`는 승인값과 같다.
- resume executor: S001R2 `review_decision` / action `brief`.

## 리뷰 판정

- 지적 2건:
  - R1 중간/P2: 조회 실패 또는 대기 중일 때 저장 성공이 목록에 반영되지 않고, 늦은 조회가 결과를 덮는다.
  - R2 낮음/P3: 신규 Props·입력 타입이 interface로 되어 있다.
- 그 밖에 확정 결함 없음.
- reviewer는 브라우저·빌드·전체 suite를 실행하지 않았다. executor 증거를 인용했고, R1은 Node repro로 확인했다.
- **A 기준만 검토했으며 전체 S001 DONE이 아니다.**

## executor 대조·확인

| 항목 | 리뷰 내용 | 실제 코드 대조 |
| --- | --- | --- |
| R1-A 실패 화면에서 저장 성공 | query가 failed이면 저장 성공 updater가 현재 상태를 그대로 둔다. 성공 알림은 “목록 맨 위에 추가”인데 표·수가 없다 | **확인.** `use-customer-mock.ts:62-67`은 `current.kind === "loaded"`일 때만 반영한다. failed는 그대로 남는다. 같은 원인으로, 대기 중인 조회가 `조회 실패` 결과로 끝나는 경우에도 새 고객이 보이지 않는다 |
| R1-B 저장 후 대기 중 빈 조회 | 저장 완료 시 query가 loading이면 반영을 건너뛴다. 뒤늦은 `list("empty")`가 저장소를 비워 성공 고객과 중복 비교 대상이 사라진다 | **확인.** `startList`는 시작 시 outcome만 고정하고, 완료 시 `store.list(outcome)`을 실행한다. `customer-mock.ts:39-40`에서 empty는 저장소를 비운다. 저장 성공과 이미 대기 중이던 조회를 조정하는 코드가 없다. 제 QA “저장·조회 겹침”은 정상 목록 결과만 확인했으므로 이 경계를 다루지 못했다 |
| R2 interface 사용 | `client/AGENTS.md:3`은 컴포넌트 Props와 관련 입력·옵션·컨텍스트 타입에 type alias를 요구한다 | **확인.** 대상은 `CustomerFormProps`, `CustomerListProps`, `CustomerMockControlsProps`, `CustomerInput`, `CustomerFieldErrors`다. 구현 전에 client/AGENTS.md 규칙을 반영하지 못한 제 누락이다. `Customer`(도메인 데이터)는 reviewer가 대상에서 뺐고, 규칙 문구에도 해당하지 않아 그대로 둔다 |
| 질문 1 파일 분리 | 실제 책임이 나뉘어 있어 합치기·재분리를 요구하지 않는다 | 동의, 유지 |
| 질문 2 콜백 API·겹침 | 콜백 형태는 적절하다. “loaded일 때만 반영” 정책은 승인하지 않는다(R1) | 동의 |
| 질문 3 빈 결과 0명 | 적절. 실패·로딩에서는 개수를 숨긴다 | 동의 |
| 질문 4 LiveNotice 닫기·복귀 | 코드상 연결되어 있다. 실제 낭독은 미검증 | 동의 |

## 수정안 (선택 시에만 진행)

### F1 (R1 수정)

저장 성공 시 대기 중인 목록 조회를 취소하고, 가상 저장소의 현재 정상 목록으로 query를 확정한다(`listTask.cancel()` 후 `setQuery(store.list("success"))`). 기존 “loaded일 때만 맨 앞 추가” updater를 대체한다.

- 그 뒤 사용자가 새로 요청한 실패/빈 조회는 기존 시연대로 처리한다.
- 대가: 저장 완료 시점에 대기 중이던 `다시 조회`는 취소되고 목록으로 확정된다. `조회 중` 버튼도 함께 해제된다.
- 영향: `features/customers/use-customer-mock.ts`만 수정. API·화면·파일 구조는 그대로다.
- 검증:
  - QA 스크립트에 다음 시나리오를 추가해 dev/preview에서 확인한다.
    - 실패 화면 → 저장 성공: 표·수·성공 고객 1회.
    - 저장 → 대기 중 empty 조회 / failure 조회: 성공 고객 유지, 이후 정상 재조회에서도 유지, 같은 번호 재저장 시 중복.
    - 조회 → 저장 순서.
  - 기존 48 + 회귀 69, 전체 test·check·build를 다시 실행한다.
  - 훅 단위 이벤트 테스트는 DOM 테스트 패키지 미설치 방침 때문에 브라우저 QA로 대신한다.

### F2 (R2 수정)

위 5개 선언만 `export type X = { … };`로 바꾼다. 필드·이름·기능은 그대로다.

- 영향: `customer.ts`, `customer-form.tsx`, `customer-list.tsx`, `customer-mock-controls.tsx`.
- 검증: 대상 선언 검색(features 안 남은 interface는 `Customer`뿐), `vp check` 신규 진단 0, test 통과.

## 상태

S001R2 `review_decision`. 사용자 선택(accept / feedback) 전에는 소스를 수정하지 않는다.

## 사용자 결정 (2026-10-06)

- 결과 브리핑 후 선택: "수정안 고르기 (accept)".
- accept 다중 선택: **F1(R1 저장 성공 후 목록 확정)**, **F2(R2 Props·입력 타입을 type으로)**.
- 선택 응답에 자유 입력이 함께 있었다: mock 모듈들을 테스트 모듈로 몰아넣어 달라는 요청과 솔직한 의견 요청.
  - executor 설명: 테스트 파일은 이미 번들에서 빠지고 있다(dist 검사로 확인). mock은 화면이 쓰는 실행 코드라 테스트로 옮길 수 없다.
  - 논의 결과 사용자 결론: "be까지 해서 컨트롤러까지 나와봐야" 판단한다. 파일 구조(`mock/` 격리, 모듈별 폴더, MSW 전환 등)는 **BE 컨트롤러가 나온 뒤 결정하도록 보류**하고 이번에는 바꾸지 않는다.
- 최종 확인: 사용자 “ㄱㄱ”(구조는 그대로 두고 F1·F2만 적용하는 제안에 대한 응답).
- 선택 전후 재검증: 요청 `20261006T070037704000Z-80bde91f87c3`, 결과 `20261006T071011877000Z-e062bde3af9f`, baseline `099e2fc7…c351`, review-1 hash `1c255b4d…`, story hash `dcde0526…` 모두 일치.
- 보류: 구조 재배치(리뷰 수정안 아님, BE 이후 결정). 그 밖의 미선택 수정안 없음.
