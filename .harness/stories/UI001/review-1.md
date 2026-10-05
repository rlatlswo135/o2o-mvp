# UI001 코드 리뷰 1

## 요청·기준·상태

- 요청 ID: `20261005T091751737000Z-6461238a5b39` (첫 리뷰).
- 승인: handoff `20261005T084705804000Z-543aa97f9df3`.
- 승인 story SHA-256: `c8d85f129bca2544546cdbab70dbf9204d3f5bddc655ed2bb678f06f1af8022d`. 직접 `shasum` 결과·checkpoint·implementation 기록 일치.
- 고정 소스 기준: `files-v1`, `5f505f4abd8105f47511aefaaf39f79054f5ea92e69b1eff58f3ff6105f418b8`.
- `resume reviewer`·inbox·status에서 UI001 / reviewing / 같은 요청 확인, 오류 없음. CURRENT 포인터와 일치.
- 상태: **review_ready 초안. 아직 전송하지 않음.** send / discuss 선택 대상. 수정 승인·완료 승인이 아니다.

## 결론

새 선택·금액 로직에서 추가 확정 결함은 찾지 못했다. 네이티브 컨트롤, Field 연결, 금액 원문 보존·빈 값·안전 정수 처리는 승인 범위와 맞는다.

다만 **기존 CSS 구성 문제로 배포 스타일과 375px 완료 조건이 충족되지 않는다.** 아래 R1·R2는 executor가 이미 공개한 문제이며 신규 구현이 만든 회귀로 분류하지 않는다. 구성 수정은 현재 승인 범위 밖이므로 사용자 판단·별도 수정 승인이 필요하다. 코드 리뷰 초안 준비를 UI001 최종 완료로 해석하면 안 된다.

## 검토 범위·비교 근거

- 변경 13개 파일 전체: `client/src/shared/ui/{select.tsx,textarea.tsx,choice.tsx,segmented-control.tsx,amount-field.tsx,control-styles.ts,amount-field.test.tsx,field-controls.test.tsx,choice.test.tsx}`, `client/src/routes/{index.tsx,-selection-review.tsx,-amount-review.tsx,-review-layout.tsx}`.
- 직접 관련 정의: 기존 `field.tsx`, `input.tsx`, `theme.stylex.ts`.
- 알려진 CSS 실패의 원인 대조에 한해 `routes/__root.tsx`, `_dev/dev-stylex-inject.tsx`, `styles.css`, `client/vite.config.ts` 확인.
- 승인 `story.md`·`shared-ui-scope.md`, 구현 기록, 시안 `ui-01-inputs.png`의 03·04를 대조. 다섯 선택 종류·Textarea·금액 입력/표시의 코드상 누락 없음. 실제 렌더 외형에 대한 사용자 시안 대조는 대체하지 않음.
- Git 있음. `index.tsx` diff와 변경 설명을 대조했다. 신규 파일은 untracked여서 이전 소스 diff가 없으며 실제 전체 내용을 검토했다. 요청 hash는 소스 동결 기준이지 작업 전 코드의 백업이 아니다.
- 소문자 rename, 기존 `button.tsx`·루트 `vite.config.ts` 수정은 implementation의 착수 전 사용자 변경으로 분리했다. 기존 CSS 관련 네 파일은 `git diff HEAD -- ...`에 변경 없음. 해당 파일을 이번 구현의 회귀로 귀속하지 않음.
- 서버·무관한 기능·저장소 전체 검토 없음. 기존 Button 내부와 기존 9개 테스트의 재실행 없음.

## 계획 충족

| 완료 조건 | 검토 판단 |
| --- | --- |
| 1. 선택 값·표시 일치 / radio 단일 선택 | 네이티브 checked·name, 그룹 제어/비제어 매핑, 화면 이벤트 처리에 추가 결함 없음. dev 조작 결과는 executor 증거. Select 키보드 변경 수동 확인 남음. production 선택 모양은 R1 영향. |
| 2. disabled·이름·보이는 포커스 | 코드상 disabled 전달, label·legend, 포커스 스타일 있음. 실제 dev/AX 확인은 executor 증거. production 포커스·상태 모양은 R1 영향. |
| 3. Field 연결 | id·required·description/error·invalid 전달, 금액 단위 describedby 연결 확인. 신규 SSR 테스트 확인. |
| 4. 여러 줄 사유 | controlled 원문 전달·pre-wrap 값 표시 확인. 업무 검증은 소비자 화면에만 있으며 공통 컴포넌트에서 저장 요청 없음. |
| 5. 금액 부호·0·빈 값·오류 | 파서 직접 좁은 검증 PASS. Intl 표시와 null/undefined 분기 코드·테스트 확인. production 오른쪽 정렬은 R1 영향. |
| 6. 기존 회귀·작은 화면 | 기존 9개 포함 30개 테스트·빌드 PASS는 executor 기록 인용. 375px 원본 dev 실패는 R2. reset 임시 주입 결과는 현재 소스의 PASS가 아님. |
| 7. 시안 대조 | 종류별 조립 존재. 사용자 최종 화면 확인 남음. |

새 의존성·설정·서버 변경, 기존 Button/Field/Input 계약 변경, 계산·영속 저장·실제 테마 변경은 변경 설명과 검토 파일에서 발견하지 않았다.

## 지적

### R1 — 높음: production이 배포된 StyleX CSS를 연결하지 않음 (기존 문제 / 완료 차단)

- 위치: `client/src/routes/__root.tsx:21`, `client/src/_dev/dev-stylex-inject.tsx:14-16`.
- 실패 조건: production 분기에서 검토 화면을 열면 `../styles.css` 링크만 반환한다. executor preview 증거는 해당 요청 404·규칙 0개, 실제 생성된 `dist/client/assets/stylex.css` 미링크를 기록한다.
- 영향: 기존 컨트롤과 신규 UI 모두 스타일 누락. Switch checked 위치·Segmented 선택 표시·금액 오른쪽 정렬·설계된 포커스가 배포에서 성립하지 않는다. 빌드 성공만으로 공통 범위의 production CSS 게이트를 충족할 수 없다.
- 근거 출처: reviewer가 루트 링크와 production 분기 코드를 직접 확인. 404·실제 적용 실패·배포 산출물 규칙 존재는 **implementation.md의 executor 실행 증거 인용**이며 reviewer가 preview를 실행한 결과가 아니다. 관련 소스는 HEAD와 동일.
- 최소 수정안: **사용자 구성 수정 승인 후**, production CSS 진입점을 Vite가 생성한 StyleX stylesheet에 연결하는 기존 빌드 방식으로 바로잡는다. 임의 고정 파일명 복사나 컨트롤별 inline 스타일로 우회하지 않는다. CSS 생성과 head 연결을 함께 확인한다.
- executor 검증 요청: 승인된 수정 후 production preview에서 stylesheet 응답·규칙 적용, Switch/Segmented 상태 표시·금액 정렬·포커스를 재확인하고 원본 화면 결과를 남긴다.
- 불확실성: reviewer는 네트워크·브라우저 재현을 하지 않았다. 정확한 구성 패치는 설치된 plugin의 배포 CSS 계약 확인이 필요하다. 신규 로직 결함이나 이번 변경의 회귀라고 주장하지 않는다.

### R2 — 중간: reset 미로딩 상태에서 신규 입력 폭이 부모보다 커짐 (기존 전제 / 완료 차단)

- 위치: `client/src/shared/ui/control-styles.ts:7-12`, `client/src/shared/ui/amount-field.tsx:156-157`; 원인 연결은 `client/src/_dev/dev-stylex-inject.tsx:11`.
- 실패 조건: 현재 dev는 virtual StyleX CSS만 링크하고 `styles.css`의 전역 `box-sizing: border-box`를 로드하지 않는다. 신규 입력 base는 `width: 100%`에 padding·border를 추가하나 자체 box-sizing은 없다. content-box에서 AmountInput 외부 폭은 부모 폭 + 14px 왼쪽 padding + 38px 오른쪽 padding + 2px border가 된다.
- 영향: 단위 overlay가 부모 기준으로 배치되는 반면 입력 오른쪽 경계는 부모 밖에 놓인다. executor는 375px 화면의 금액 입력으로 페이지가 13px 넘치는 것을 측정했다. grid 최소 열·page padding 조정만으로 누락된 reset 전제를 해결하지 못한다. 작은 화면 완료 조건 미충족.
- 근거 출처: reviewer가 입력 폭·padding, theme `paddingX=14px`, 전역 reset 정의, dev 링크 분기를 직접 대조. **13px 넘침·reset 임시 주입 후 0px는 executor 증거 인용**. reviewer가 화면 측정하지 않음. 기존 Input도 같은 전제를 사용하므로 기존 전역 문제를 이번 UI 회귀로 귀속하지 않는다.
- 최소 수정안: **사용자 구성 수정 승인 후** 전역 `styles.css`를 실제 dev/production CSS 진입점에서 로드하여 기존 Input과 신규 컨트롤이 같은 border-box 전제를 갖게 한다. R1의 StyleX 연결과 별개로 global reset도 포함해야 한다. 임시 브라우저 주입은 수정·검증 완료 증거가 아니다.
- executor 검증 요청: 임시 주입 없는 원본 dev 및 preview를 375px에서 재확인. 페이지 전체 가로 넘침 없음, 입력 경계와 단위 위치, 기존 Input 회귀 없음을 기록한다.
- 불확실성: 브라우저별 정확한 넘침 크기는 reviewer 미측정. 원인 코드와 executor 실패 증거가 일치하며 새 모바일 기기 검증은 하지 않았다.

## 검증 증거·한계

**reviewer 직접 확인**

- 승인 story hash 및 resume/inbox/status 상관관계, 코드·테스트·Git diff 정적 검토.
- 비변경 unit 확인: `node --input-type=module`에서 `amount-field.tsx`의 타입·파서 구간만 읽어 `node:module.stripTypeScriptTypes`로 메모리 내 변환 후 data URL import, `node:assert/strict` 실행. 빈 값·공백·음수 두 종류·0·양수·쉼표·안전 정수 양/음 경계·범위/형식 오류 **21개 + negative-zero 확인 PASS**. 파일 쓰기·의존성·번들러 실행 없음. Node 실험 API 경고 있음. React 통합·CSS 검증을 대신하지 않음.

**executor 증거 인용**

- 변경 13개 `vp check` PASS; 전체 `vp check --no-fmt` 기존 warning 1개; 전체 `vp check` 기존 포맷 오류 FAIL.
- `vp test --run` 30/30, `vp run build` PASS. reviewer 재실행 아님.
- dev 47개 중 45 PASS, Select 키보드 자동화 한계·375px CSS 실패 및 preview 스타일 실패. 원본 실패와 임시 reset 주입 결과를 구분함.

**미실행 / 남은 게이트**

- reviewer 브라우저·E2E·dev server·preview·전체 suite·종합 QA·설치·소스/생성물 수정 없음.
- Select 실제 키보드 변경, 375px 정상 원본 화면, production 스타일, 사용자 시안 대조·최종 완료 확인 미완료. 스크린리더 청취·Safari/Firefox·다른 OS는 검증되지 않음.
- R1·R2는 알려진 실패의 코드 대조다. 새로운 전체 실행 검증 또는 수정 승인을 의미하지 않는다. 수정 여부·범위는 보고서 전송 후 executor 브리핑과 별도 사용자 승인에서 결정한다.
