# UI002 구현 기록

## 인계 수락

- 수락: 2026-10-05. executor가 planner `implementation_request` `20261005T105912356000Z-835628c8c20d`을 수신·검증했다.
- 승인 근거: 런타임 checkpoint `approval.kind = handoff`, `story_hash = 73d7addfba5cf17ae2807f361c566735a36fa3a5cd99181d62b4b47989b77d93`. `shasum -a 256 .harness/stories/UI002/story.md`가 같은 hash. 계획 출처 `planning_from = 20261005T105204104000Z-f41fd5f31b9b`(UI001 완료 인계).
- 승인 범위: story.md, [공통 범위](../shared-ui-scope.md), [현재 UI 구조](../ui-structure.md)의 UI002 범위만. 커밋·푸시·새 의존성·설정·server/ 변경 없음.
- 작업 시작 기준: HEAD `fb260a1`("story UI001 완료 + UI002 플래닝"), `client/` 작업 트리 변경 없음.

## 변경 파일

| 파일 | 내용 |
| --- | --- |
| `client/src/shared/ui/table/table.tsx` | `Table`(caption 필수·`hideCaption`, `role="region"`+`aria-labelledby`=caption id+`tabIndex=0` 가로 스크롤 영역), `TableHead`, `TableBody`, `TableRow`(`selected` → 강조 배경만, aria-selected 없음), `TableHeaderCell`(기본 `scope="col"`, `align`), `TableCell`(`align`). 네이티브 props·children 조립. 첫 행 위 구분선 제거·머리글 아래선. 셀 nowrap. |
| `client/src/shared/ui/table/table.test.tsx` | caption↔region 이름 연결, 숨긴 caption 유지, `scope=col`·thead/tbody 구조, aria-selected·grid 역할 없음(4개). |
| `client/src/shared/ui/badge/badge.tsx` | `Badge`(`tone`: info/success/neutral/warning/danger, 기본 neutral). 문구는 children, 보조 기호(•/✓/!/없음)는 `aria-hidden`. live region 없음. `badgeMark(tone)` 매핑 공개(테스트용). |
| `client/src/shared/ui/badge/badge.test.tsx` | 의미→기호 매핑, 기호 숨김+문구 유지, live region 없음, 기본 neutral(4개). |
| `client/src/shared/ui/theme.stylex.ts` | 토큰 추가만: `neutralText`, `selectedSurface`, `infoSurface`, `success`, `successSurface`, `warning`, `warningSurface`. 기존 토큰 이름·값 변경 없음. `neutralText`는 기존 `textMuted`가 `neutralSurface` 위에서 4.5:1 미달(약 4.1)이라 추가. |
| `client/src/routes/-table-review.tsx` | 05 검토 조립: 가상 세 행(김서연/이지우/박수빈), 첫 열 label 안 네이티브 radio(name 공유, 이름=고객명), 선택 상태는 화면 소유, 금액 `formatAmount`+`<data>`+"원", 상태 Badge, "다른 의미색" Badge 3개, 현재 선택 행 표시. 기존 `-review-layout.tsx` 재사용(수정 없음). |
| `client/src/routes/index.tsx` | 05 섹션(Table · Badge) 추가. |

수정하지 않음: 기존 Button/Field/Input·UI001 컴포넌트, `amount-field.util.ts`, CSS 진입점(`__root.tsx`, `_dev/`), 설정·의존성·server/.

설계 메모: 행 선택 radio는 Table이 아니라 소비자가 렌더한다(Table은 강조 표현만). 기존 `Radio`는 `name`을 RadioGroup에서만 받고 RadioGroup의 fieldset을 tbody/tr 사이에 넣을 수 없어 재사용하지 않고, 검토 화면에 네이티브 radio + 같은 포커스·accent 스타일을 두었다.

## 검증 (client/)

| 명령 / 확인 | 결과 |
| --- | --- |
| `vp check <변경 7개 파일>` | 포맷 PASS, 0 경고 / 0 오류 |
| `vp check --no-fmt` (전체 34파일) | 0 errors / 1 warning(기존 `_dev/dev-stylex-inject.tsx:8`) |
| `vp check` (전체) | FAIL(기존, 변동 없음): `package.json`, `routeTree.gen.ts`, `router.tsx` 포맷 |
| `vp test --run` | 10 파일 38/38 PASS(기존 30 + 신규 8) |
| `vp run build` | PASS. CSS 산출물 `dist/client/assets/styles-DIT6f-Nc.css` 단일. `routeTree.gen.ts` 변경 없음 |

브라우저(headless Chrome + CDP, 원본 화면·주입 없음, 세션 scratchpad 스크립트):

| 완료 조건 | preview(4173) | dev(3100) |
| --- | --- | --- |
| 1 표 구조·이름·헤더, 금액 오른쪽 정렬·0원 표시 | PASS: AX table "예약 목록 예시", region 같은 이름, th scope=col 4개, AX cell, `120,000원/30,000원/0원` text-align end | PASS |
| 2 행 선택(마우스·키보드) 하나만 강조, 현재 값 일치, radio 이름·checked | PASS: 초기 이지우만 강조, radio 클릭·고객명 label 클릭·ArrowUp 이동 시 강조·현재 값 일치, checked 1개, AX radio "이지우" checked, name 공유, 포커스 outline solid, aria-selected·grid 없음 | PASS |
| 3 여섯 문구·다섯 의미, 색 없이 문구로 구분, live region 없음 | PASS: `예정/완료/취소/확인 필요/처리 실패/사용 안 함`, 색 조합 5종, 대비 5.06~6.22:1, 상태 셀 AX 이름에 기호 없음, 기호 StaticText 노출 없음, live region 없음 | PASS |
| 4 375px 표 영역만 가로 스크롤, 키보드 조회, 페이지 넘침·조작부 잘림 없음 | PASS: page scrollWidth 375=client, region scrollWidth 346>307, radio 모두 보임, region Tab 포커스(outline solid)·→ 키로 scrollLeft 39 | PASS |
| 5 01~04 회귀 | 기존 47개 검사 46 PASS(이전과 동일, Select 키보드 자동화 한계 1건). 기존 375px 검사는 의도된 표 스크롤 영역 내부 요소를 제외하도록 검사 스크립트만 보정 | 동일 |
| 6 시안 05 대조 | 사용자 확인 필요. executor 스크린샷 대조: 표·선택 행 강조·금액 정렬·여섯 문구 존재 | — |
| 콘솔 오류 | 없음 | 없음 |

## 미해결 / 수동 확인

- 사용자 시안 05 대조, 키보드 행 선택, 좁은 화면 직접 확인.
- 01~04의 Select 키보드 변경은 UI001과 같이 수동 확인 항목(자동화 한계).
- 시안에는 행 선택 radio가 보이지 않지만 story가 명시적 조작부를 요구해 첫 열에 radio를 두었다.

## 미실행

- 스크린리더 실청취(AX 트리 결과로 대체 완료 주장하지 않음), Safari·Firefox·다른 OS.
- 커밋·푸시 없음.

## 리뷰 인계

- 2026-10-05 사용자가 실행 완료 선택에서 review 선택. `node .harness/bin/c2h.mjs review UI002` → 요청 ID `20261005T112412618000Z-b013d0649a10`.
- 인계 후 소스 동결. 리뷰 결과 수신 전 소스 수정·커밋 없음.

## 리뷰 1 반영 (fixing → implementation_done)

- 리뷰 결과 `20261005T113233588000Z-95c21461fcad`([review-1.md](review-1.md), [브리핑](review-brief.md)). 차단 결함 없음, R1 낮음(비차단).
- 사용자 `/accept` 선택: **R1(선택 행 강조 분기 자동 검증)**. 코드리뷰 Fix 횟수 1 / 3.
- 변경: `client/src/shared/ui/table/table.test.tsx`에 테스트 1개 추가 — 기본·`selected`·`selected={false}` 행의 SSR `class`를 비교해 selected만 다르고 기본/false는 같음을 확인. class 이름 하드코딩·DOM 도구 없음. 제품 코드 변경 없음.

| 명령 / 확인 | 결과 |
| --- | --- |
| `vp check table.test.tsx` | 포맷·lint·type PASS |
| `vp test --run` | 10 파일 39/39 PASS(+1) |
| 회귀 감지 확인 | `table.tsx`에서 `selected && styles.selectedRow`를 임시 제거 → 새 테스트 FAIL 확인 후 원본 복원(SHA-256 `cf5c5ef8…` 동일), 전체 39/39 재확인 |
| `vp check --no-fmt` (전체) | 0 errors / 1 warning(기존) |
| `vp check` (전체) | FAIL(기존 포맷 3파일, 변동 없음) |
| `vp run build` | PASS, `styles-DIT6f-Nc.css` 동일(제품 코드 무변경) |

- 실제 색 적용은 기존 dev/preview 브라우저 증거(선택 행만 `rgb(237, 243, 251)`)이며 이번 SSR 테스트는 분기 보호만 담당한다. 제품 코드 변경이 없어 브라우저 재실행은 하지 않았다.
- 남은 수동 확인: 시안 05 대조, 키보드 행 선택, 좁은 화면, 01~04 Select 키보드.

## 사용자 완료 확인

- 2026-10-05 사용자 완료 선택에서 **확인 완료 · 스토리 종료** 선택. 선택지 안내("시안 05 대조, 키보드 행 선택, 좁은 화면을 확인하셨다면")에 따른 현재 수정본(R1 반영본)의 수동 확인·만족 최종 승인으로 기록한다.
- 완료 게이트 판단:
  - 정확한 revision 구현 승인: handoff `20261005T105912356000Z-835628c8c20d`, story hash 일치. ✔
  - executor QA: check·test 39/39·build, dev/preview 브라우저 UI002 21/21·01~04 46/47 기록. ✔ (Select 키보드는 수동 확인 항목)
  - 고정 기준 리뷰·사용자 리뷰 결정: review-1 수신·브리핑, `/accept`로 R1 선택·반영. ✔ 재리뷰는 FLOW상 필수 아님(R1 반영은 테스트 파일만 변경).
  - 사용자 수동 확인·최종 완료 확인: 위 선택. ✔
  - 학습: 신규 필수 아님(story.md).
- 남은 항목(완료를 막지 않음): 스크린리더 실청취·Safari/Firefox·다른 OS 미검증, 전체 `vp check` 기존 포맷 3파일, 커밋·푸시 없음. UI002 완료는 공통 UI 전체나 S001 완료가 아니다.
