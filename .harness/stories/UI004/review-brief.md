# UI004 리뷰 1 브리핑

## 수신 검증

- 결과 메시지 `20261006T040744104000Z-6b33e27efc9a`(reviewer → executor, review_result), `reply_to` = 요청 `20261006T035506692000Z-2c63b55870a8`.
- `wait 20261006T035506692000Z-2c63b55870a8 --timeout 1`이 같은 결과를 반환한다. 보고서 `review-1.md`의 SHA-256 `625d9fd8…c92c`가 메시지 hash와 일치한다. baseline `601be12b…`이 checkpoint verified_baseline과 일치한다. story hash `81cf432d…`는 승인값과 같다.
- resume executor: UI004 `review_decision` / action `brief`.

## 리뷰 판정

수정 지적 1건(R1, 중간/P2). 그 밖에는 확정 결함이 없다. reviewer는 브라우저·빌드·전체 suite를 실행하지 않았고 executor 증거를 인용했다. DONE 판정이 아니다.

## executor 대조·확인

| 항목 | 리뷰 내용 | 실제 코드 대조 |
| --- | --- | --- |
| R1 같은 인라인 결과 연속 표시 | 표시 중에 같은 버튼을 다시 누르면 상태 변경도 live 갱신도 없다 | **확인.** `-feedback-review.tsx:196-199` `resultFor(tone, false)`는 `results[tone]` 객체를 그대로 반환하므로 `setInline`이 아무 일도 하지 않는다. 추가로, 긴 문구 체크 시에는 새 객체가 되어 렌더는 일어나지만 `notice.tsx:70-79`에서 같은 Notice가 같은 자리에 같은 텍스트로 남는다. 따라서 DOM 변화가 없고, 이 설정에서도 같은 문제다(리뷰가 명시한 기본 설정보다 넓다). Toast는 열린 동안 재표시를 막으므로 해당 없음 |
| 질문 1 LiveNotice 구조 | 적절. 구조만으로 모든 재표시 전달을 증명하지 못하며 R1에 해당 | 동의 |
| 질문 2 Toast 막기 | 완료 조건 5의 동작은 충족한다. 비활성으로 보이지 않는 점은 UX 판단 항목이며 결함이 아니다. Button 변경은 범위 밖 | 동의. 기록 유지 |
| 질문 3 재시도·포커스 | 적절 | 동의 |
| 질문 4 max-dependencies 경고 | 차단 지적 아님. 경고 제거만을 위한 분할·barrel 불요 | 동의. 신규 경고 사실은 보존 |
| 추가 한계 | Toast에 세로 max-height/overflow가 없다. 더 긴 내용이나 낮은 뷰포트에서는 닫기 버튼이 화면 밖으로 나갈 위험이 있다(확정 결함 아님) | 사실 확인(`toast.tsx`에 높이 제한 없음). 375×700 데모에서는 문제가 없었다. 권고로 분류 |
| 회귀 표기 | UI003 스크립트 40/41을 41/41로 재표기하지 않음 | 동의 |

## 수정안 (선택 시에만 진행)

- **F1 (R1 수정):** `LiveNotice`에 선택 prop `noticeKey`(string | number)를 추가하고 내부 Notice의 `key`로 쓴다. 빈 status/alert 컨테이너는 그대로 유지하고, 표시 사건마다 내부 Notice만 새로 삽입한다. 검토 화면 인라인 상태는 `{ notice, id }`로 바꿔 표시할 때마다 id를 증가시킨다. Toast는 재표시를 막으므로 변경하지 않는다.
  - 영향: `shared/ui/notice/notice.tsx`(선택 prop 1개, 기본 동작 동일), `routes/-feedback-review.tsx`.
  - 검증: SSR 테스트(noticeKey 유무와 무관하게 같은 마크업, 영역 구조 유지)를 추가한다. 브라우저 dev/preview에서 tone별 같은 버튼 연속 표시 시 다음을 확인한다: 컨테이너 노드 동일, 내부 Notice 노드 교체, 포커스 유지, live 영역 1곳, 닫기 후 복귀. 회귀로 전체 test·check·build·QA 스크립트를 다시 실행한다. 실제 스크린리더는 미실행으로 남긴다.
- **(권고, 지적 아님) A1:** Toast 카드에 `maxHeight`(뷰포트 기준)와 본문 세로 스크롤을 두어 닫기 버튼이 항상 화면 안에 있게 한다. 선택하지 않으면 미해결 기록만 유지한다.

## 상태

UI004 `review_decision`. 사용자 선택(accept / feedback) 전에는 소스를 수정하지 않는다.

## 사용자 결정 (2026-10-06)

- 결과 브리핑 후 선택: "수정안 고르기 (accept)".
- accept 다중 선택: **F1(R1 같은 알림 재표시 전달)**, **A1(Toast 높이 제한, 권고)** 두 항목 모두 선택. 선택 전후 요청 `20261006T035506692000Z-2c63b55870a8`·baseline `601be12b…` 재검증 일치. 보류 항목 없음.
