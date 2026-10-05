# UI003 코드 리뷰 1

## 요청·고정 기준

- 요청 ID: `20261006T020259072000Z-1386d9c40435` (첫 리뷰, executor → reviewer).
- 소스 기준: `files-v1 / 9660d6a952828de10c7388a0befbb535eb4abf2fe9f245875d988d41027cd965`.
- 승인된 story.md SHA-256: `2bd79a847df94254635ddede5dc04a8504734c3ea9e65898afeafc2445a86777`.
- 승인: handoff `20261005T114719226000Z-bc4b18b1499f`; 계획 출처 `20261005T113815501000Z-2ead20f9eb04`.
- `resume reviewer` 및 `status`: UI003 / reviewing / review, 요청 ID·승인·기준 일치, errors 없음. CURRENT.md도 같은 스토리·단계를 가리킨다.
- 비교 기준: Git HEAD `1f85d8b`. UI001/UI002 완료본은 HEAD에 포함되어 있으며 이번 수정 2파일·신규 3파일을 구현 기록과 대조했다. fingerprint는 변경 전 코드의 백업이 아니므로 비교에는 Git과 구현 설명을 사용했다.

## 판정

**검토 범위 내 확정 결함·수정 지적 없음.** R 계열 수정 지적은 발행하지 않는다. 실행 검증 전체 PASS 또는 스토리 DONE 판정은 아니다. 사용자 수동 확인과 최종 완료 승인은 남아 있다.

## 검토 범위

다음 5파일 전체를 읽었다.

- `client/src/shared/ui/dialog/dialog.tsx`
- `client/src/shared/ui/dialog/dialog.test.tsx`
- `client/src/routes/-dialog-review.tsx`
- `client/src/routes/index.tsx`
- `client/src/shared/ui/theme.stylex.ts`

구체적 연결 확인에 필요한 flame-ui 1.0.1 Dialog 구현·타입, 기존 Button·Field·Input 및 직접 소비자 참조를 확인했다. 승인된 story.md, 공통 범위·구조, implementation.md, 시안 `ui-02-feedback.png`의 06 영역을 대조했다. 무관한 저장소 전체 코드, 서버, 다른 공통 UI의 내부 구현은 검토하지 않았다.

## 코드 근거·계획 충족

| 완료 조건 | 정적 확인과 근거 | 실행 증거·남은 한계 |
| --- | --- | --- |
| 1 열기·이름·초기 포커스 | `dialog.tsx:31-35,93-117`: showModal 직후 소비자 초기화·취소 ref 포커스, 제목/설명 id 연결. `-dialog-review.tsx:59-65,84-92`: 취소 ref와 사유 Field/Input 연결 | executor는 dev/preview에서 AX 이름·설명·modal, 초기 취소 포커스·배경 차단을 확인했다고 기록. reviewer는 직접 실행하지 않음 |
| 2 키보드·보이는 포커스 | native showModal 유지, 닫기 버튼 focus-visible 스타일과 기존 Button/Input 재사용. 별도 focus-trap 없음 | executor의 Tab/Shift+Tab·focus ring 증거 인용. Chrome에서 마지막 요소 다음 브라우저 UI로 한 번 이동하는 native 동작도 기록됨. 페이지 요소로 빠지는 결함으로 단정하지 않음 |
| 3 취소·닫힘 | `dialog.tsx:37-45,108-112`: 공통 닫힘은 통지·스크롤 복구. flame-ui `dist/index.js:166-191`: Closer→close(), native close event→onClose, 내부 section 클릭 전파 차단. `-dialog-review.tsx:42-44`: 확인 없는 닫힘은 취소 | executor는 Escape/X/돌아가기/배경과 본문 클릭·포커스 복귀를 확인했다고 기록. 입력에서 배경으로 끌어 놓는 경계 동작은 아래 미확정 위험 참조 |
| 4 확인 원문·한 번 표시 | `-dialog-review.tsx:45-48,104-112,122-126`: 현재 reason 기록·횟수 증가 후 close. 함수형 onClose 업데이트는 기존 confirmed 결과를 유지. 소비자만 업무 문구·결과를 소유 | executor는 입력한 원문과 1회 확인, 400ms 후 결과 유지 확인을 기록. 변경 코드에 API·영속 저장·HTML 삽입 sink 없음; 사유는 React 텍스트로 렌더 |
| 5 반복·닫힌 상태 | `dialog.tsx:45,130-137`: keepMounted, dialog에 display 강제 없음. `-dialog-review.tsx:37-40`: 재열기 초기화 | executor의 반복 열기·초기화·닫힌 상태 display:none/Tab 미진입 증거 인용. SSR 테스트는 open 속성 부재만 확인하며 DOM 동작을 증명하지 않음 |
| 6 작은 화면·긴 내용·스크롤 | `dialog.tsx:25-57,132-153` 및 body/actions 스타일: 열린 동안 html overflow 잠금, close·unmount 시 기존 값 복구, 뷰포트 제한·본문 스크롤·액션 비축소 | executor는 375×640 및 긴 안내, 본문 스크롤·배경 잠금/복구·가로 넘침 없음을 기록. iOS Safari 잠금·Windows 스크롤바 이동은 미검증 |
| 7 회귀·공통 경계 | index에 기존 섹션을 유지하며 06만 추가. theme에는 overlay 토큰만 추가. shared/ui/dialog에 route·feature·업무 규칙 의존 없음. 기존 UI API·설정·CSS 진입점 변경 없음 | 기존 39개 포함 45개 assertion 통과는 executor 기록. 프로세스 exit 1을 전체 test 명령 PASS로 취급하지 않음. UI001/UI002 전체 브라우저 회귀는 미재실행 |
| 8 시안 06 | 위험 표시·제목·닫기·대상·사유·설명·하단 구분/버튼이 코드에 존재. danger Button 유지와 단순 결과 텍스트는 승인 범위에 부합 | executor 화면 대조 기록 인용. reviewer는 시안 이미지만 읽었으며 구현 화면을 직접 대조하지 않음. 사용자 시안 확인 필요 |

## 미확정 위험·검토 한계 (수정 지적 아님)

1. **입력 선택 중 배경까지 끌어 놓기** — `dialog.tsx:45`가 flame-ui `closeOutside`를 그대로 사용한다. 설치본 `dist/index.js:177-191`은 dialog에서 받은 click을 닫기로 처리하고 내부 section click만 막는다. 입력→배경 drag의 click target이 dialog가 되면 사유 입력 중 취소될 가능성이 있다. executor도 미확인 가능성으로 기록했다. **확정 재현 없음, 심각도 미판정.** 필요하면 executor가 실제 입력 선택/drag로 검증하고, 재현 시 backdrop에서 시작·끝난 클릭만 닫도록 최소 보완안을 별도 승인받는다. 라이브러리 수정·새 modal manager를 지금 요구하지 않는다.
2. **플랫폼별 native 동작** — Safari/Firefox, 실기기, 스크린리더 실청취는 양쪽 모두 미실행. native 포커스 복귀·html overflow 잠금의 전 환경 보장을 하지 않는다. 중첩 모달·동시 스크롤 잠금 관리자 검토는 명시적 제외 범위다.
3. **자동 테스트 보호 범위** — 신규 6개는 SSR 제목/설명 연결·조건부 표시·닫힌 markup·닫기 이름·트리거 의미를 보호한다. 이벤트·확인/취소 state·스크롤 복구·초기 포커스는 이 테스트로 검증되지 않는다. executor 브라우저 증거와 분리한다.

## 검증 증거 출처

### reviewer 직접 확인

- `node .harness/bin/c2h.mjs resume reviewer`, `inbox reviewer`, `status`: 요청·승인·phase·기준 검증, errors 없음.
- `shasum -a 256 .harness/stories/UI003/story.md`: 승인 hash 일치.
- `git status --short`, `git rev-parse --short HEAD`, 대상 Git diff·신규 파일 읽기: 구현 기록의 변경 파일과 일치.
- `git diff --check`: 출력 없음. whitespace 확인이지 제품 동작 테스트가 아니다.
- 위 파일 정적 검토. **unit/repro, 브라우저, E2E, dev server, 빌드, 전체 suite·종합 QA 직접 실행 없음.** 구체적 결함을 확정하기 위한 추가 좁은 실행은 필요하지 않았다.

### executor 기록 인용 (`implementation.md`, 2026-10-06)

- 변경 5파일 check: 0 errors / 0 warnings. 전체 `vp check`: 기존 포맷 3파일 실패. 전체 no-fmt: 기존 warning 1개.
- test: 11파일 45/45 assertion 통과. 종료 시 `close timed out … 2 Vite servers` 및 exit 1, 기준선에서도 동일했다고 기록. 명령 전체 성공으로 재표기하지 않음.
- build 성공, dev/production preview 각 38/38 브라우저 확인 기록. 실행 스크립트는 세션 scratchpad이므로 reviewer가 재실행·독립 검증하지 않았다.
- 사용자 수동 확인·최종 완료 승인은 미완료.

## 인계 경계

보고서 초안 저장 후 review_ready로 기록한다. 실행자에게 보내기는 `c2h_review_next`의 명시적 send 선택 때만 수행한다. 결과 수신은 수정 승인·DONE이 아니다. 소스·승인된 story.md는 수정하지 않았다.
