# UI003 리뷰 1 브리핑

## 수신 검증

- 결과 메시지 `20261006T021456337000Z-a4c9d920e665` (review_result, reviewer → executor, UI003).
- `reply_to` = 리뷰 요청 `20261006T020259072000Z-1386d9c40435`. `wait --timeout 1` 결과가 같다.
- baseline `9660d6a9…cd965`가 checkpoint `verified_baseline`과 일치한다.
- 보고서 `review-1.md`의 SHA-256 `b644300d…2e7d`가 메시지의 hash와 일치한다.
- `resume executor`: UI003 / review_decision / brief. 오류 없음. 리뷰 중 소스 변경 없음(`git status` 대상 5파일 동일).

## 리뷰 판정

reviewer는 **확정 결함·수정 지적(R 계열) 없음**으로 판정했다. 완료 조건 1~8에 대해 정적 근거를 확인했고, 실행 증거는 executor 기록을 인용했다. 아래 세 가지를 수정 지적이 아닌 미확정 위험·한계로 남겼다.

## executor 대조·확인

| # | reviewer 항목 | executor 대조 결과 | 권고 |
| --- | --- | --- | --- |
| 1 | 입력 선택 중 배경까지 끌어 놓으면 닫힐 가능성(`closeOutside`) | **재현됨**(2026-10-06 dev, headless Chrome CDP 신뢰 마우스 이벤트, scratchpad `repro-drag.mjs`). 입력 안·패널 아래·제목에서 각각 눌러 배경에서 떼면 3건 모두 닫혔고, 결과는 "취소 · 확인 동작 없음", 입력한 사유는 사라졌다. 원인: flame Content는 dialog 요소에서 받은 click이면 닫는다(`dist/index.js` handleClick). 누른 곳과 뗀 곳이 다르면 브라우저는 공통 조상인 dialog에 click을 보낸다. 완료 조건 3의 "본문·입력 클릭은 닫지 않는다"는 의도에 어긋나는 사용성 결함으로 본다 | **수정 권장(F1)** |
| 2 | Safari/Firefox·실기기·스크린리더 미실행 | 사실과 맞다. implementation.md 미실행 항목과 같다 | 수동 확인 단계에서 가능한 범위만 확인하고 기록 유지 |
| 3 | 자동 테스트는 SSR 연결만 보호하고 이벤트·state·스크롤·포커스는 보호하지 않음 | 사실과 맞다. story 검증 계획의 의도대로 브라우저 증거로 분리했다. DOM 테스트 도구는 제외 범위다 | 조치 없음(기록 유지) |

## 수정안 (선택 시에만 진행)

- **F1 — 배경에서 시작하고 끝난 클릭만 닫기**
  - 변경: `client/src/shared/ui/dialog/dialog.tsx`만 수정한다.
    - flame `closeOutside`를 끈다.
    - `DialogContent`가 `<dialog>`에 `onPointerDown`·`onClick`을 전달한다. pointerdown과 click이 모두 dialog 요소 자체(=backdrop)에서 일어났을 때만 `event.currentTarget.close()`를 호출한다.
    - 닫힘은 native close 이벤트를 거쳐 기존 `onClose`·스크롤 복구 경로를 그대로 탄다.
  - 유지: flame 라이브러리 수정, 새 의존성, 새 modal manager는 없다. 공개 API도 바뀌지 않는다.
  - 검증: 기존 브라우저 QA 38항목(배경 클릭 닫기 포함)을 재실행한다. 위 drag 3시나리오에서 열린 상태와 입력 유지를 확인한다. test·build·check를 다시 돌린다.
  - 위험: 낮음. 바뀌는 것은 배경 클릭 판정 하나다. 키보드·Escape·버튼 닫기 경로는 영향이 없다.
- 2·3은 수정안 없음.

## 상태

수신만으로 수정하지 않았다. 첫 리뷰이므로 **결과 브리핑 후 선택**(accept / feedback)을 받는다. accept는 수정안 선택창을 여는 것이며, F1은 거기서 고를 때만 fixing으로 진행한다.

## 사용자 결정 (2026-10-06)

- 결과 브리핑 후 선택: **수정안 고르기(accept)**.
- 수정안 다중 선택: **F1(배경에서 시작·끝난 클릭만 닫기) 선택**. 선택 후 같은 요청 ID로 wait를 다시 검증했고 기준 변동은 없다.
- 리뷰 항목 2·3은 수정안이 없어 기록만 유지한다(보류·조치 없음).
