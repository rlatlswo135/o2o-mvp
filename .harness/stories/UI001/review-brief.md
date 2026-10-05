# UI001 리뷰 브리핑 1

## 수신·검증

- 결과 메시지: `20261005T101941002000Z-265931c4de0a` (reviewer → executor), `reply_to` = 요청 `20261005T091751737000Z-6461238a5b39`.
- `node .harness/bin/c2h.mjs wait 20261005T091751737000Z-6461238a5b39 --timeout 1` exit 0. 보고서 `review-1.md` SHA-256 `eed97971fc42ba8ef6b6f980b5eef454b56c07d3c2fce7deece86a1871767774`가 메시지 hash와 일치.
- 고정 소스 기준 `5f505f4abd8105f47511aefaaf39f79054f5ea92e69b1eff58f3ff6105f418b8`이 checkpoint `verified_baseline`과 일치. resume 오류 없음(소스 drift 없음).
- 리뷰 수신은 수정 승인이 아니다. 이 브리핑 작성 중 소스를 수정하지 않았다.

## 결론 요약

- 신규 컴포넌트 로직(선택 매핑·Field 연결·금액 파서) 추가 결함 없음. reviewer가 파서 21개 경계 + -0을 별도 실행해 PASS.
- 지적 2건(R1 높음, R2 중간)은 모두 **기존 CSS 구성** 문제이며 이번 변경의 회귀로 분류되지 않았다. 다만 완료 조건(production 스타일·375px)을 막는다.

## 지적별 실제 코드 대조

### R1 — 높음: production에서 StyleX CSS가 연결되지 않음

- 확인: `client/src/routes/__root.tsx:21` `<DevStyleXInject cssHref="../styles.css" />`, `client/src/_dev/dev-stylex-inject.tsx:14-16` production 분기는 `<link href="../styles.css">`만 반환. 두 파일 HEAD와 동일(이번 작업 미수정). executor preview 측정: `/styles.css` 404·규칙 0, `dist/client/assets/stylex.css`는 생성되나 미링크.
- 원인 보강(executor 확인): `@stylexjs/unplugin` README — 프로덕션에서 수집한 CSS를 **번들러가 만든 기존 CSS asset에 덧붙이고**, CSS asset이 없으면 별도 `stylex.css`를 만든다. 앱 코드가 `styles.css`를 import하지 않아 CSS asset이 없으므로 고아 `stylex.css`가 생기고, HTML은 존재하지 않는 `../styles.css`를 가리킨다.
- 판단: 지적 타당. 승인 범위(설정·구성 변경 제외) 밖이라 별도 승인 필요.

### R2 — 중간: dev에서 전역 reset 미로딩 → 신규 입력이 부모보다 넓음

- 확인: `control-styles.ts:8-10` `width: 100%` + `paddingInline`, `amount-field.tsx:157` 오른쪽 padding 38px, box-sizing 미지정. dev는 `/virtual:stylex.css`만 링크(`dev-stylex-inject.tsx:11`)하고 `styles.css`의 `* { box-sizing: border-box }`가 없다. 375px에서 금액 입력이 13px 넘침(executor 측정), 기존 전화번호 Input도 부모보다 30px 넓음(화면 밖으로는 안 나감).
- 판단: 지적 타당. R1과 같은 뿌리(전역 CSS 진입점 부재).

## 수정안

| ID | 수정안 | 범위·영향 | 검증 |
| --- | --- | --- | --- |
| R1+R2 (권장, 묶음) | `__root.tsx`에서 `styles.css`를 Vite 자산으로 import(TanStack Start 관례: `import appCss from "../styles.css?url"` → head `links`로 연결)하고 `DevStyleXInject`의 고정 `../styles.css` 링크를 제거·정리. 프로덕션에서는 StyleX 규칙이 이 CSS asset에 합쳐져 reset과 함께 해시 파일로 링크되고, dev에서는 `styles.css` + `/virtual:stylex.css`가 함께 로드된다. | **구성 변경**(`routes/__root.tsx`, `_dev/dev-stylex-inject.tsx`) — 사용자 구성 영역이라 별도 승인 필요. 새 의존성 없음. 모든 기존 UI에 영향(의도한 수정). | build 후 `dist`에 StyleX 규칙이 합쳐진 CSS asset 확인, preview에서 stylesheet 200·규칙 적용, Switch/Segmented 선택 표시·금액 정렬·포커스, dev/preview 375px 원본 화면 넘침 0. 세부 방식은 적용 시 plugin 실제 동작으로 확인. |
| R2-대안 (범위 내) | 신규 `controlStyles.base`와 `AmountDisplay`에 `boxSizing: "border-box"`를 지정해 전역 reset과 무관하게 폭을 맞춘다. | 승인 범위 안(신규 파일만). 기존 Input은 그대로라 dev에서 Input만 30px 넓은 불일치가 남음. R1은 해결하지 못함. | 원본 dev 375px 넘침 0, 테스트·check 재실행. |

선택하지 않은 항목은 보류한다. R1+R2 묶음을 고르면 구성 수정에 대한 명시적 승인으로 기록한 뒤 진행한다.

## 남은 게이트(수정과 별개)

- Select 키보드 변경 수동 확인(macOS 네이티브 메뉴로 자동화 불가).
- 사용자 시안 03·04 대조와 최종 화면 확인.
- 스크린리더 청취·Safari/Firefox·다른 OS 미검증.

## 결정 기록

- 2026-10-05 브리핑 저장. 사용자가 결과 브리핑 후 선택에서 accept 선택(승인 아님).
- 2026-10-05 `/accept` 다중 선택 UI에서 사용자가 **R1+R2: CSS 진입점 연결**만 선택. 이것이 구성 파일(`client/src/routes/__root.tsx`, `client/src/_dev/dev-stylex-inject.tsx`) 수정의 명시적 승인이다. 새 의존성·서버·다른 설정 변경은 포함하지 않는다.
- 미선택·보류: **R2-대안**(신규 컨트롤 box-sizing 개별 지정). 적용하지 않는다.
- 선택 직후 재검증: 같은 요청 wait exit 0, story·review-1 hash 불변, resume review_decision, 브리핑 수정안 변경 없음.
