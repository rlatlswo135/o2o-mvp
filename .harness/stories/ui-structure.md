# 공통 UI 사용 계약 — UI001~UI004 완료

## 다음 작업에서 읽을 범위

UI001~UI004의 사용자 최종 완료 확인은 각 checkpoint가 정본이다. 이 문서는 현재 사용할 결과·경계만 요약하며 당시 승인 범위·QA 증거를 변경하지 않는다. 공통 UI 완료는 S001 고객 기능 완료가 아니다.
완료 스토리 상세는 기본으로 다시 읽지 않는다. 관련 결함·계약 변경·근거 확인 때만 아래 링크의 필요한 부분을 읽는다.

## 파일 배치·의존 규칙

- `client/src/shared/ui/<component>/<component>.tsx`와 관련 테스트를 함께 둔다. 소문자 파일명 유지.
- 전용 util은 같은 폴더의 `<component>.util.ts`. 실제 필요할 때만 분리한다.
- `theme.stylex.ts`는 shared/ui 최상위. `internal/`은 UI 내부 공통 스타일이며 밖에서 import하지 않는다.
- 폴더별·최상위 `index.ts` barrel 없음. `@/shared/ui/<component>/<component>.tsx` 등 직접 경로 사용. 내부 상대 import는 기존 프로젝트 규칙을 따른다.
- `choice/choice.tsx`는 Checkbox·RadioGroup·Radio·Switch를 묶는다. 이름만 맞추려 다시 쪼개지 않는다.
- routes → features → shared. shared는 routes/features·업무 규칙에 의존하지 않는다. 문구·상태·옵션·콜백은 소비자가 소유한다.
- `/`의 검토 조립과 `-selection-review.tsx`, `-amount-review.tsx`, `-review-layout.tsx` 등 `-` 파일은 예시다. 새 업무 라우트나 도메인 API로 취급하지 않는다.
- 기존 StyleX 토큰·dev/production CSS 진입점 유지. 기존 Button·Field·Input 계약 변경은 별도 범위 확인이 필요하다.

## 사용할 수 있는 결과

기본 경로는 `client/src/shared/ui/`다. 실제 소비 시 관련 컴포넌트의 현재 타입·구현만 추가로 읽는다.

| 결과 | 폴더/계약 | 완료·상세 근거 |
| --- | --- | --- |
| 기존 기반 | `button/`, `field/`, `input/`, `theme.stylex.ts` 유지 | [기존 S001 기록](S001/implementation.md) |
| 선택·사유·금액 | `select/`, `textarea/`, `choice/`, `segmented-control/`, `amount-field/`; `amount-field.util.ts`의 parseAmount/formatAmount 재사용 | [UI001 DONE](UI001/checkpoint.md), [상세](UI001/implementation.md) |
| 목록·상태 | `table/`, `badge/`; 행 선택·상태값은 소비자 소유 | [UI002 DONE](UI002/checkpoint.md), [상세](UI002/implementation.md) |
| 중요 행동 확인 | `dialog/`; 배경 drag 오닫힘 방지, 확인 버튼은 테두리형 유지 | [UI003 DONE](UI003/checkpoint.md), [상세](UI003/implementation.md) |
| 조회 상태 | `empty-state/`, `skeleton/`, `error-state/`; 재시도/조회는 소비자 소유 | [UI004 DONE](UI004/checkpoint.md), [상세](UI004/implementation.md) |
| 처리 결과 | `notice/`의 Notice·LiveNotice, `toast/`; 표시·닫기·포커스는 소비자 소유 | [UI004 상세](UI004/implementation.md) |

Notice는 정적 표현, live 전달은 LiveNotice 한 곳에서 담당한다. 성공/경고는 status, 실패는 alert. 같은 결과의 재전달은 소비자가 `noticeKey`를 바꾼다. 중복 live 영역을 만들지 않는다.
Toast는 로컬 상태·수동 닫기이며 전역 store/provider/queue/자동 소멸 타이머가 없다. 설치된 flame-ui Toast로 임의 교체하지 않는다. 닫기 후 포커스 복귀는 소비자가 처리한다.

## 남은 제약 — 완료와 별개로 유지

- UI 완료 기록 시점 전체 check의 기존 포맷 실패·경고, Vitest 종료 timeout 기록이 있다. 현재 전체 PASS를 뜻하지 않는다. 새 작업에서 실제 기준선을 확인한다.
- 실제 스크린리더 낭독, Safari/Firefox·실기기·실제 OS reduced-motion은 미검증이다. Chrome DOM/AX·에뮬레이션 결과를 그 환경의 검증으로 확대하지 않는다.
- UI004 검토 화면의 max-dependencies 경고 2개, 열린 Toast의 다른 표시 버튼 비활성 시각 표현 한계, devtools 겹침과 작은 화면 가림 제약이 남아 있다. 긴 Toast 텍스트는 스크롤되지만 타 브라우저 키보드 스크롤은 미확인이다.
- S001R2에서 논의한 등록 모달 전환·저장 중 닫힘 차단·코드 닫기 보강은 이 완료본의 제공 계약이 아니다. 디자인·구조 변경은 별도 승인 사항이다.

전체 시안 대응·당시 범위는 [shared-ui-scope.md](shared-ui-scope.md). 이 요약은 새 테스트 실행 결과가 아니며 원본 story·review·QA·implementation은 그대로 보존한다.
