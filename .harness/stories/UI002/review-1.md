# UI002 코드 리뷰 1

## 요청·고정 기준

- 요청 ID: `20261005T112412618000Z-b013d0649a10` (첫 리뷰).
- 승인 handoff: `20261005T105912356000Z-835628c8c20d`.
- 승인 story SHA-256: `73d7addfba5cf17ae2807f361c566735a36fa3a5cd99181d62b4b47989b77d93`. 직접 `shasum` 결과·checkpoint·implementation 일치.
- 소스 기준: `files-v1`, `e9b69a5ca716bccbd82ed7dc810a8197d9be0462d3d43a153851d96d57e3cb6e`.
- 작업 전 Git HEAD: `fb260a1`, 현재 HEAD도 일치. `resume reviewer`와 inbox에서 같은 요청·UI002 / reviewing 확인. CURRENT 포인터 일치.
- 리뷰 초안. send / discuss 선택용이며 수정·최종 완료 승인이 아니다. 전송 여부는 런타임 회신 기록을 따른다.

## 결론

**차단할 제품 코드 결함은 발견하지 못했다.** 네이티브 표·caption/헤더 관계, 소비자 소유 radio 선택, 선택 행 스타일, 다섯 Badge 의미·여섯 문구, 기존 금액 util 재사용이 승인 범위와 맞는다. 토큰은 추가만 되었고 기존 API·CSS 진입점 변경은 없다.

낮은 심각도 R1: 계획에 명시된 선택 행 표시 분기의 자동 회귀 검증이 빠졌다. 현재 강조 동작은 executor 브라우저 증거가 있으므로 기능 실패로 분류하지 않는다. 사용자 시안 대조·좁은 화면·키보드 확인과 최종 완료 선택은 별도로 남는다.

## 검토·미검토 범위

- 변경 7파일 전체 검토:
  - `client/src/shared/ui/table/{table.tsx,table.test.tsx}`
  - `client/src/shared/ui/badge/{badge.tsx,badge.test.tsx}`
  - `client/src/shared/ui/theme.stylex.ts`
  - `client/src/routes/{index.tsx,-table-review.tsx}`
- 직접 관련 정의만 추가 확인: `shared/ui/internal/control-styles.ts`의 숨김 caption 스타일, `amount-field/amount-field.util.ts`의 금액 표시, `routes/-review-layout.tsx`의 현재 값 배치.
- 기준 문서: 승인 story, shared-ui-scope, ui-structure, implementation. 시안 `ui-02-feedback.png`의 05를 열어 코드상 항목 대조. 실제 렌더 외형의 사용자 대조를 대신하지 않는다.
- Git 있음. index·theme diff 대조: 05 섹션 추가, 기존 토큰 이름/값 보존. 신규 5파일은 untracked이므로 실제 전체 내용을 변경 설명과 대조했다. hash는 동결 검증이지 작업 전 백업이 아니다.
- 관련 CSS 진입점·금액 util·공통 배치·internal 스타일의 HEAD diff 없음. UI001 이전 리뷰의 CSS 실패를 현재 UI002 결함으로 재사용하지 않는다. 현재 dev/preview 정상 결과는 executor 증거다.
- server, 다른 기능, UI001 전체 소스 재리뷰 없음. 브라우저·E2E·dev server·preview·전체 테스트·빌드·포맷·설치 실행 없음. 작은 실행 repro가 필요한 기능 의문은 없어 직접 unit도 실행하지 않았다.

## 계획 충족

| 완료 조건 | 코드 대조 / 검증 한계 |
| --- | --- |
| 1 표 이름·헤더·셀·오른쪽 금액·0원 | caption과 region aria-labelledby 연결, thead/tbody/tr/th/td 유지, scope=col 기본값. 금액 셀 align=end·formatAmount·data+원, 0을 truthy 분기로 숨기지 않음. 실제 AX/정렬은 executor 증거. |
| 2 한 행 선택·현재 값·radio 의미 | 같은 name, 고객명 label, selectedId로 checked·TableRow selected·현재 값 모두 파생. Table에 선택 상태 manager·grid 역할·aria-selected 강제 없음. 클릭/화살표 결과는 executor 증거. 자동 강조 분기 보호는 R1. |
| 3 다섯 의미·여섯 문구 | info/success/neutral/warning/danger 스타일·문구 존재. 기호만 aria-hidden, 기본 neutral, 공통 업무 enum 없음, 자체 live region 없음. 대비 수치는 executor 증거이며 reviewer 측정 아님. |
| 4 375px·표 안 스크롤·키보드 | wrapper overflowX=auto·maxWidth=100%·tabIndex=0·이름·focus-visible 있음. 표 안 radio 포커스 스타일 있음. 실제 페이지 폭/스크롤·잘림은 executor 증거. |
| 5 기존 01~04 회귀·계층 | 변경은 승인 파일에 한정, token 추가만. 기존 컴포넌트/CSS/금액 util 미변경. shared는 React/StyleX·UI 내부만 의존. 기존 30개 포함 테스트 PASS와 dev/preview 회귀 결과는 executor 인용. |
| 6 시안 대조·완료 분리 | 가상 세 행·선택 강조·금액 정렬·여섯 문구 조립 존재. 명시적 radio는 승인 story 요구이므로 시안과 다르다는 이유로 결함 처리하지 않음. 사용자 대조·최종 완료 확인 남음. |

새 의존성·설정·서버 변경, 업무 계산/저장/API·검색/정렬·column schema·실제 테마 변경은 검토 변경에서 발견하지 않았다.

## 지적

### R1 — 낮음 / 비차단: 선택 행 강조 분기의 자동 회귀 검증 누락

- 위치: `client/src/shared/ui/table/table.test.tsx:16-23,53-57` (대상 분기: `table.tsx`의 `TableRow`, `selected && styles.selectedRow`).
- 확정 사실: fixture에 selected 행과 기본 행은 있으나 assertion은 이름/구조와 금지 ARIA 속성만 확인한다. 선택/비선택 행 스타일 차이는 검증하지 않는다. 승인 story의 자동 검증 계획에 선택 행 표시 분기가 명시되어 있다.
- 실패 조건: 향후 `selected && styles.selectedRow`가 빠지거나 항상 적용되는 회귀가 발생해도 현재 4개 Table 테스트의 assertion은 이를 잡지 않는다. 이는 정적 테스트 대조에 따른 검증 공백 판단이며 실제 mutation test를 실행한 주장은 아니다.
- 영향: checked·현재 선택 값은 정상인데 행 강조만 누락되거나 모든 행이 강조되는 회귀가 자동 검사에서 통과할 수 있다. 현재 제품이 그 상태라는 뜻은 아니다.
- 최소 수정안: 기존 SSR 테스트에 selected=true와 false/default의 행 class 구성이 다르고 false/default는 같은지 확인하는 작은 assertion 하나를 추가한다. 생성 class 이름을 하드코딩하거나 새 DOM 도구·추상화를 추가하지 않는다. CSS 규칙의 실제 색/적용 검증은 기존 executor 브라우저 증거와 구분한다.
- 검증 요청: executor가 별도 사용자 수정 승인 후 작은 Table 테스트로 해당 분기를 보호하고 기존 선택 강조 검증과 함께 기록한다. reviewer가 소스를 수정하거나 테스트를 자동 적용하지 않는다.
- 증거·불확실성: reviewer가 전체 Table 테스트와 분기를 직접 읽음. 현재 선택 강조 정상 동작은 implementation의 dev/preview 결과 인용. 테스트 보강 전후 실행·mutation 검증은 reviewer 미실행.

## 증거 출처·남은 게이트

**reviewer 직접:** 역할/흐름·승인 문서 읽기, resume/inbox·story hash·HEAD 확인, 변경 소스/테스트·직접 관련 정의·Git diff 정적 대조, 시안 05 항목 확인. 제품 실행 PASS는 선언하지 않는다.

**executor implementation.md 인용:**

- 변경 7파일 `vp check` PASS, 전체 `vp check --no-fmt` 오류 0/기존 경고 1. 전체 `vp check`는 기존 포맷 3파일 FAIL 그대로.
- `vp test --run`: 10파일 38/38(기존 30+신규 8) PASS. `vp run build` PASS, routeTree 변경 없음.
- 원본 dev/preview: 표 이름·AX/헤더, 단일 선택·포커스, 여섯 문구·다섯 색/대비, 375px 표 영역 스크롤·페이지 폭 검사 PASS. reviewer 재실행/측정 아님.
- 기존 47개 검사 중 46 PASS, Select 키보드 자동화 한계 1건. 표 내부 허용 스크롤 영역은 페이지 넘침 검사에서 분리했다고 기록됨.

**미검증/미완료:** 사용자 시안 05 대조·키보드 행 선택·좁은 화면 직접 확인, 사용자 최종 완료 확인. 스크린리더 실청취·Safari/Firefox·다른 OS는 executor도 미실행. AX 검사·SSR 테스트만으로 이 환경까지 검증됐다고 주장하지 않는다. UI002 리뷰 결과는 공통 UI 전체나 S001 완료를 뜻하지 않는다.
