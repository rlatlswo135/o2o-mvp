# S001 실행 revision S001R2 — 계획·UI004 완료 인계 수락

## 완료 요청 검증

- 요청 `20261006T041635308000Z-c8e7d91206a1`: planning_request, UI004, executor → planner, approved true. resume의 UI004/done/plan_next·inbox·done checkpoint의 completion.message_id 일치. status errors 없음.
- 승인 story SHA-256 `81cf432da3fa9bdb17415caa5346d0acde841f6b9d83263434d0c183b2655c09` 일치.
- 완료 baseline `5e010e7e4f02df758b1ac2554de4882bae4feb955748cb780f336ca4f3125ce9`가 요청·checkpoint와 일치하며 implementation.md 사용자 확인 기준과 맞다. review-brief의 F1/A1 선택·반영·최종 사용자 확인 기록을 읽었다.
- executor 증거: 17파일 64/64·build·dev/preview 69/69. 실제 낭독/타 브라우저/실기기 미실행·전체 format 실패·경고·Vitest 종료 timeout은 보존. planner 직접 제품 실행 결과 아님.
- index의 UI004 DONE은 근거와 맞고 과거 ‘리뷰 send 대기’·‘세 UI 완료’ 요약은 최신 완료 상태로 맞췄다. UI001~UI004 묶음 완료는 S001 완료가 아니다.

## 사용자 논의·계획 근거

- 다음 기존 우선순위는 S001 고객 등록 → 목록 확인. S001/story.md·fe-structure.md·implementation/review/qa 및 v1-scope·디자인 자료를 읽었다. 과거 S001은 shared/ui 첫 단계 승인만 있고 업무 화면·통합·상속 학습은 미완료다.
- 사용자는 완성된 첫 업무 화면을 먼저 만들고 한 스토리에 FE와 직접 BE 구현을 모두 포함하길 요청했다. FE는 executor/reviewer, BE는 사용자 직접 진행이며 별도 가이드·검토 가능. 이 방향에 ‘오케이 좋다’로 동의했다. 구현 승인으로 해석하지 않는다.
- 이전 별도 FE 스토리 제안은 채택하지 않는다. 논리 업무 스토리는 S001 하나이며 28개 목록·후속 의존성 유지. 기존 승인된 S001/story.md를 바꾸지 않기 위해 하네스 저장 ID만 S001R2로 두고 현재 실행 revision에 전체 목표와 A만의 승인 경계를 담았다.
- `/customers`는 기존 확정 경로. 시안의 고객 목록·등록 패널·잉크 블루 방향, 좁은 화면 조립과 오류 흐름을 완성한다. 수정/삭제/검색/전체 메뉴·실제 API·서버 대행 구현 제외. 메모리 가상 동작은 중간 검토이며 새로고침 유지 요구를 충족했다고 하지 않는다.
- BE 과제는 화면 행동→도메인 규칙→검증 기준으로 안내하고 API/테이블 정답을 먼저 고정하지 않는다. 서버는 기본 scaffold만 로컬에서 확인됐으며 외부 준비 상태는 추측하지 않는다.
- 새 실행 revision은 기존 S001의 deep-guide/eli5/quiz 게이트를 상속한다. FE 문서로 통합·BE 학습·검증을 대체하지 않는다.

## 하네스 대기·제약

- 현 runtime은 `.harness/stories/<ID>/story.md`를 해시로 고정한다. 별도 파일을 새 범위인 것처럼 보여주고 기존 S001/story.md를 handoff하지 않는다.
- `blocked`는 지원되며 리뷰 회신 처리 후 외부 의존성 대기를 기록할 수 있다. FE 사용자 확인 뒤 전체 done·다음 스토리 자동 전환을 금지하고 BE 작업 대기로 남긴다.
- blocked 해제는 명시 승인이 필요하고, review 이후 `implementing` 전이·과거 review baseline과 달라진 소스의 재사용에는 제한이 있다. FE 뒤 사용자 서버 변경을 과거 검증 완료로 가장하지 않는다. 후속 연결 때 실제 상태·변경 기준을 확인하고 재개 방법을 결정하며, 막히면 멈춘다. 이번 계획이 하네스 수정 승인은 아니다.

## 수락·planning

- S001R2 planning 저장: hash `dcde0526aa0b26b53b907351337af1816b4cb5ddcc3a0c3cb457df7a619d4c8b`, planning_from `20261006T041635308000Z-c8e7d91206a1`.
- 기존 S001/story.md hash `87a1ae477cf36505d4816a4187dddd73fbbcf482ffcffe9e44ca9c2cd7eb8f82`와 UI004 승인 hash를 보존했다. 제품 소스·의존성·생성물·서버·하네스 runtime 변경/실행 에이전트/커밋/푸시 없음.
- 영향 분석: [스토리 영향 분석](impact.md). 계획·index·상대 링크·CURRENT/checkpoint/hash 검증 후 위 완료 요청 하나만 ack 완료(`archived` 응답). 재확인 resume은 S001R2/planning/action plan. 현재 구현 approval 없음.

검증은 문서·런타임 읽기/계획 저장만 수행. FE 제품 검증은 승인 후 executor 담당이다.

## FE 확인 안내 수락·사용자 BE 가이드 (2026-10-06)

- executor 정보 메시지 `20261006T074528230000Z-48b8b7737ff8`을 읽고 현재 `resume planner = S001R2/blocked` 및 implementation.md의 사용자 FE 확인·review-brief.md의 F1/F2 선택·반영과 대조했다. 일반 message이며 완료 planning_request나 새 구현 승인이 아니다.
- FE 증거는 executor 기록(test 85/85, build, dev/preview 54/54·회귀 69/69)을 인용하며 planner가 재실행하지 않았다. 디자인 디테일과 mock/feature 구조는 사용자 보류 결정을 유지한다.
- 사용자의 “ㅇㅇ작성해줘”는 같은 S001의 BE 직접 구현 가이드 작성 요청이다. [be-guide.md](be-guide.md)에 화면 행동→서버 책임, 현재 scaffold 근거, 사용자가 정할 DB 접근/샵/입력 정책, 구현 순서·실제 DB 동시성/실패 검증·연결 인계 자료를 작성했다. API/테이블 정답을 임의 확정하거나 서버를 구현하지 않았다.
- 현재 server 소스·package/scripts·tests와 FE 고객 흐름을 직접 읽었다. server 전용 AGENTS.md/CLAUDE.md는 찾지 못했다. 설치·서버 실행·테스트·마이그레이션·제품 소스 변경 없음. 승인된 story.md·checkpoint·phase는 유지한다.
- index의 과거 리뷰 선택 대기 요약을 현재 FE 확인/사용자 BE 대기로 맞추고 가이드 링크를 추가했다. 이 수락·작성 기록 저장과 문서 링크/공백·승인 hash/blocked 유지 검증 후 해당 정보 메시지 하나만 ack 완료(`archived` 응답). 최초 문서 검사 명령의 인용부호 오류는 수정해 재실행·통과했다. 제품 검증을 실행한 것은 아니다. 가이드 작성은 상속 deep-guide/eli5/quiz나 통합 완료를 대체하지 않는다.

## 하네스 유지보수 (2026-10-06)

- 사용자가 원본 테스트 후 이 프로젝트에도 즉시 적용하도록 요청했다. 현재는 새 스토리 planning이 아니라 S001R2/blocked의 BE 대기다. 새 구현·blocked 해제·DONE 승인이 아니다.
- 갱신 전 inbox 3개 모두 비어 있고 status errors 없음. 현재 파일 기준과 verified_baseline 일치를 확인한 뒤 `--install-only --maintenance`로 갱신했다. 역할 CLI 실행·재시작·tmux 키 주입 없음.
- [유지보수 기록](maintenance.json)은 설치 리소스 변경 전후 지문을 기록한다. 이후 specs 문서 이동·프로젝트 지침 갱신도 소스 지문을 바꾸므로 resume은 현재 기준으로 재검증 필요 여부를 판단한다. 기존 verified_baseline·승인·checkpoint·전송된 리뷰는 그대로 둔다.
- UI004 당시 영향 분석을 Git HEAD의 기존 문서에서 [UI004/impact.md](../UI004/impact.md)로 복구했다. 이 스토리 분석은 [impact.md](impact.md)로 이동하고 두 planning 링크를 분리했다. 공용 specs/IMPACT_LATEST.md는 더 이상 없다.
- index는 한 줄 목록으로 정리하고 이전 내용을 [보존본](../index-history.md)에 남겼다. 공통 UI 사용 계약·제약은 [ui-structure.md](../ui-structure.md), 현재 FE 인계 요약은 implementation.md 상단을 사용한다. 과거 승인·리뷰·QA 원본을 압축/교체하지 않았다.
- 제품 코드·서버·패키지·models.json 변경 없음. 제품 QA를 재실행하거나 새 PASS로 주장하지 않는다. BE 이후 실제 연결은 별도 범위 승인·검증 필요. 기존 수정 승인(F1/F2)으로 통합 작업을 시작하지 않는다.
