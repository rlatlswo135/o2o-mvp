# UI003 — 중요한 행동을 확인하거나 취소한다

## 사용자 요구와 가치

시안 `ui-02-feedback.png`의 06 영역을 구현한다. 가상 행동을 요청하면 Dialog에서 제목·대상·설명을 읽고 사유를 입력한 뒤 확인/취소한다. 실제 예약 취소·저장 요청은 수행하지 않는다.

## 범위

[공통 범위·검증·완료 게이트](../shared-ui-scope.md)와 [현재 UI 구조](../ui-structure.md)를 적용한다.

- 도메인 독립 공통 Dialog: 트리거·제목·설명·본문·액션·닫기, overlay·모달 의미·포커스 관리.
- 기존 Button·Field·Input으로 시안의 사유 입력·돌아가기·위험 행동 확인 예시를 조립한다. 긴 사유 예시는 필요하면 기존 Textarea를 재사용한다. 기존 Button danger 스타일을 유지하고 시안의 채움 버튼을 이유로 variant를 재설계하지 않는다.
- 기존 `/` 검토 화면에 06 영역을 추가한다. 가상 대상 요약·사유·확인/취소 결과는 소비자 로컬 상태이며 공통 Dialog에 업무 문구·필수 사유 규칙을 넣지 않는다.
- 확인 결과는 현재 사유와 함께 한 번 표시하고 닫는다. 취소·닫기·Escape·배경 클릭은 확인 동작 없이 닫힌다. 단순 결과 텍스트를 사용하고 Notice/Toast는 UI004로 남긴다.
- 설치된 flame-ui 1.0.1 Dialog의 네이티브 `<dialog>` 동작을 재사용하고 StyleX로 시안의 흰 패널·경계·위험 표시·배경·배치를 적용한다. 별도 focus-trap 라이브러리나 modal manager를 만들지 않는다.

## 대상 파일 / 구조

- `client/src/shared/ui/dialog/dialog.tsx`: 최소 공통 조립·스타일·접근성 연결. 실제 자체 분기/연결에 필요한 `dialog.test.tsx`를 같은 폴더에 둔다.
- `client/src/routes/-dialog-review.tsx`(후보), `routes/index.tsx`: 06 영역 조립. 기존 `-review-layout.tsx` 재사용, 필요한 배치 확장만 허용한다.
- 기존 `theme.stylex.ts`의 의미 토큰을 재사용한다. overlay 등 실제 필요한 값만 추가하며 기존 토큰 이름·값과 UI001/UI002 API·동작은 유지한다.
- 소문자 컴포넌트별 폴더·직접 경로 import·barrel 없음. `internal/`은 UI 내부 전용이다. CSS 진입점·기존 공통 입력·Table/Badge·설정은 수정 대상이 아니다.

## 제외 범위

실제 예약 취소/API·저장, 중첩 modal·Drawer·alertdialog 별도 컴포넌트·전역 modal manager·controlled open 프레임워크, 로딩/서버 오류 업무 흐름, 새 의존성·DOM 테스트 도구·설정 변경·server/ 수정·커밋·푸시, 기존 Button/Field/Input 또는 UI001/UI002 재설계.

## 의존성 / 남은 결정

- UI002 done·사용자 완료 확인·planning_request `20261005T113815501000Z-2ead20f9eb04` 검증됨. UI001/기존 Button·Field·Input이 기능 기반이고 UI002 완료본은 회귀 확인 대상이다. handoff 전 구현 미승인이다.
- flame-ui 실제 API는 `Dialog` root의 `closeOutside`, `keepMounted`, `onOpen`, `onClose` 및 `Trigger`/`Content`/`Closer`이다. 선언에 없는 controlled open·initialFocus props를 있다고 가정하지 않는다.
- 설치본은 `showModal()`을 호출할 때 본문이 아직 없을 수 있다(`keepMounted=false`에서 children을 state로 나중에 렌더). 이번 기본은 `keepMounted=true`로 콘텐츠를 먼저 유지하고 안전한 취소 버튼의 초기 포커스를 브라우저로 확인한다. 닫힌 native dialog를 CSS가 노출하거나 내부 컨트롤이 Tab 순서에 남게 하지 않는다.
- 트리거·액션은 flame render-prop의 open/close를 기존 Button에 명시적으로 연결하는 최소 조립을 우선한다. clone 경로가 기존 클릭 처리와 충돌하는지 추측하지 않고 실제 구현을 따른다.
- 제목·설명 id와 dialog의 aria-labelledby/aria-describedby를 연결한다. 모달 의미·배경 접근 차단·Tab 제한·포커스 복귀는 native showModal을 우선 사용하고 자동 보장됐다고 주장하지 않는다.
- 기본 닫기: 취소·닫기·Escape·배경 클릭은 취소로 처리, 본문/입력 클릭은 닫지 않는다. 확인 액션에서만 확인 콜백을 호출하며 공통 onClose는 모든 닫힘 통지이지 확인 승인이 아니다. 확인 후 닫힘을 다시 취소 결과로 덮지 않는다.
- 데모는 다시 열 때 사유·이번 결과를 소비자가 초기화한다. 같은 세션에서 내용 입력은 닫기 전까지 유지한다. 초기 포커스는 취소 버튼, 닫으면 열었던 트리거로 복귀한다. 닫기 아이콘에는 접근 가능한 이름을 제공한다.
- 남은 차단 결정 없음. 위 동작이 설치본으로 충족되지 않으면 기존 계약을 바꾸거나 라이브러리를 수정하지 말고 한계와 최소 보완안을 사용자에게 제시한다.

## 완료 조건

1. Given 닫힌 Dialog When 키보드/마우스로 열기 Then 시안의 제목·대상·설명·사유·확인/취소·닫기를 볼 수 있고 보조기기가 이름·설명을 식별한다. 최초 포커스는 취소 버튼이며 배경 조작은 막힌다.
2. Given 열린 Dialog When Tab/Shift+Tab Then 포커스가 Dialog 안에 머물고 입력·닫기·확인/취소 모두 접근 가능하며 포커스가 보인다.
3. Given 열린 Dialog When 취소·닫기·Escape·배경 클릭 Then 확인 콜백 없이 취소 결과로 닫히고 트리거에 포커스가 돌아간다. 본문·입력 클릭은 Dialog를 닫지 않는다.
4. Given 사유 입력 When 확인 Then 소비자가 현재 원문을 받고 확인 결과를 한 번 표시한 뒤 닫는다. onClose가 이 결과를 취소로 덮지 않고 실제 저장/취소 요청은 발생하지 않는다.
5. Given 닫기 후 When 다시 열기 Then 정상적으로 열리고 소비자의 초기값이 적용되며 초기 포커스·닫힘·복귀가 반복 동작한다. 닫힌 Dialog는 보이지 않고 Tab으로 내부에 들어가지 않는다.
6. Given 긴 내용/375px 화면 When Dialog 조작 Then 본문은 필요한 만큼 스크롤되며 확인/취소에 접근할 수 있다. 배경 스크롤이 함께 움직이지 않고 닫기 후 배경 스크롤·포커스가 복구된다. 페이지 전체 가로 넘침 없음.
7. Given 기존 01~05 검토 예시 When Dialog 추가 Then UI001/UI002 선택·금액·표 가로 스크롤·Badge 및 기존 39개 테스트에 회귀가 없다. shared/ui는 도메인/route에 의존하지 않는다.
8. Given 구현 결과 When 사용자 시안 06 대조 Then 중요한 행동 확인 영역에 누락이 없음을 확인한다. UI004 또는 S001 완료로 확장하지 않는다.

## 검증 계획

- executor client에서 `vp check`, 변경 파일 검사, `vp test --run`, `vp run build` 실행. UI002 마지막 증거는 10파일 39테스트 PASS·build 성공, 전체 check 기존 포맷 3파일 실패·기존 경고 1개. 실제 현재 결과를 다시 확인하고 신규 실패와 구분한다.
- 최소 자동: 자체 제목/설명 연결·닫힘 결과 분기 등 실제 로직을 확인한다. SSR 검증이 불가능한 모달 열기·포커스·native close event는 자동 테스트 통과로 위장하지 않고 아래 브라우저 증거에 남긴다. prop 전달뿐인 테스트·불필요 util은 추가하지 않는다.
- executor dev/production preview에서 원본 CSS·모달 AX 이름/설명, 최초 열기/반복 열기, 모든 닫기 경로, 확인 한 번/취소와 구분, 본문 클릭, Tab/Shift+Tab·포커스 복귀·배경 차단·스크롤 잠금/복구, 375px 및 긴 내용 확인.
- 수동 사용자 확인 필요: 시안 06 대조, 사유 입력 후 확인, 모든 취소 경로, 포커스 복귀·좁은 화면. 스크린리더 청취·다른 브라우저 등 미실행은 기록하고 AX 결과와 구분한다.
- 학습: 신규 필수 아님(사용자 선택 없음). S001 기존 학습 게이트 유지.

## 완료 게이트 / 기록

정확한 revision 구현 승인 → executor QA → 고정 기준 코드 리뷰와 사용자 결정 → 수동 사용자 확인 → 사용자 최종 완료 확인. 자동 DONE 금지. 코드리뷰/Fix·QA/Fix 각각 3회, 동일 실패 연속 2회면 blocked.

`checkpoint.md`는 런타임만 갱신한다. 진행은 `implementation.md`, 리뷰는 `review-N.md`·`review-brief.md`, 완료 인계 수락은 `planning.md`. 승인 후 본 파일 동결.
