import { useCallback, useEffect, useRef, useState } from "react";

import type { CustomerListQuery } from "./customer-list.tsx";
import type { ListOutcome, SaveOutcome, SaveResult } from "./customer-mock.ts";
import type { CustomerInput } from "./customer.ts";

import { createDelayedTask, createMockCustomerStore } from "./customer-mock.ts";

const mockDelayMs = 600;

/**
 * 고객 화면의 가상 조회·저장 상태. 실제 BE 연결 때 이 훅의 조회·저장만 실제 요청으로 바꾼다.
 * 결과(outcome)는 요청을 시작할 때 고른 값을 쓰고, 목록은 완료 시점의 가상 데이터를 읽는다.
 * 저장 성공은 대기 중인 조회보다 우선한다.
 * 화면을 벗어나면 대기 중인 조회·저장을 취소해 늦은 완료가 상태를 바꾸지 않게 한다.
 */
export function useCustomerMock() {
  const [store] = useState(createMockCustomerStore);
  const [listTask] = useState(() => createDelayedTask(mockDelayMs));
  const [saveTask] = useState(() => createDelayedTask(mockDelayMs));

  const [query, setQuery] = useState<CustomerListQuery>({ kind: "loading" });
  const [saving, setSaving] = useState(false);
  const [listOutcome, setListOutcomeState] = useState<ListOutcome>("success");
  const [saveOutcome, setSaveOutcomeState] = useState<SaveOutcome>("success");
  const listOutcomeRef = useRef<ListOutcome>("success");
  const saveOutcomeRef = useRef<SaveOutcome>("success");

  const setListOutcome = useCallback((outcome: ListOutcome) => {
    listOutcomeRef.current = outcome;
    setListOutcomeState(outcome);
  }, []);
  const setSaveOutcome = useCallback((outcome: SaveOutcome) => {
    saveOutcomeRef.current = outcome;
    setSaveOutcomeState(outcome);
  }, []);

  const startList = useCallback(() => {
    const outcome = listOutcomeRef.current;
    return listTask.start(() => setQuery(store.list(outcome)));
  }, [listTask, store]);

  useEffect(() => {
    startList();
    return () => listTask.cancel();
  }, [listTask, startList]);
  useEffect(() => () => saveTask.cancel(), [saveTask]);

  /** 목록을 다시 조회한다. 조회 중이면 중복 요청하지 않는다. */
  const reload = useCallback(() => {
    if (startList()) setQuery({ kind: "loading" });
  }, [startList]);

  /**
   * 가상 저장. 완료되면 onResult로 결과를 알린다.
   * 저장 중 재요청은 시작하지 않고 false를 돌려주며 저장소를 바꾸지 않는다.
   */
  const save = useCallback(
    (input: CustomerInput, onResult: (result: SaveResult) => void) => {
      const outcome = saveOutcomeRef.current;
      const started = saveTask.start(() => {
        const result = store.save(input, outcome);
        setSaving(false);
        // 성공한 저장이 실패 화면이나 대기 중이던 조회(빈 결과 포함)에 묻히지 않도록
        // 대기 중 조회를 취소하고 저장 직후의 목록으로 확정한다.
        if (result.kind === "saved") {
          listTask.cancel();
          setQuery(store.list("success"));
        }
        onResult(result);
      });
      if (started) setSaving(true);
      return started;
    },
    [listTask, saveTask, store],
  );

  return {
    query,
    reload,
    saving,
    save,
    listOutcome,
    setListOutcome,
    saveOutcome,
    setSaveOutcome,
  };
}
