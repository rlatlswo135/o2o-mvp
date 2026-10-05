# 공통 UI 현재 파일 배치 — UI001 사용자 확정 반영

## 적용 근거와 경계

UI001 [구현 기록](UI001/implementation.md)의 '사용자 요청 수정 1' 및 사용자 완료 확인이 근거다. 과거 S001/fe-structure.md와 승인된 UI001/story.md는 수정하지 않는다. 이 문서는 현재 폴더 배치를 후속 UI 계획에 전달하며, 당시 승인 범위나 업무 경계를 변경하지 않는다.

## 규칙

- `client/src/shared/ui/<component>/<component>.tsx`와 관련 테스트를 함께 둔다. 소문자 파일명 유지.
- 컴포넌트 전용 util은 같은 폴더에 `<component>.util.ts`로 두고 실제 필요할 때만 분리한다.
- `theme.stylex.ts`는 shared/ui 최상위. `internal/`은 UI 내부 공통 스타일이며 shared/ui 밖에서 import하지 않는다.
- 폴더별·최상위 `index.ts` barrel 없음. 소비자는 `@/shared/ui/<component>/<component>.tsx` 등 직접 경로 사용. 내부 상대 import는 기존 프로젝트 규칙을 따른다.
- 기존 `choice/choice.tsx`는 Checkbox·RadioGroup·Radio·Switch를 묶는다. 이름만 맞추려 다시 쪼개지 않는다.
- 검토 조립은 기존 routes/index.tsx와 `-selection-review.tsx`, `-amount-review.tsx`, `-review-layout.tsx` 패턴을 재사용한다. `-` 조립 파일을 새 업무 라우트로 만들지 않는다.
- 의존 방향은 routes → features → shared, shared는 routes/features에 의존하지 않는다. 구조 확정이 신규 기능의 구현 승인은 아니다.

## 기존 기반

`button/`, `field/`, `input/`, `select/`, `textarea/`, `choice/`, `segmented-control/`, `amount-field/` 구현이 있다. 금액 변환은 `amount-field/amount-field.util.ts`의 parseAmount/formatAmount를 사용한다. UI001에서 연결된 dev/production CSS 진입점은 후속 작업에서 유지한다.

확인: `rg --files client/src/shared/ui client/src/routes`. 실제 동작 증거는 UI001 implementation.md를 따르며 이 문서의 파일 확인은 제품 QA가 아니다.
