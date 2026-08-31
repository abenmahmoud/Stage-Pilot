export type SupportQueueNavigationItem = {
  publicCode: string;
};

export type SupportQueueNavigation = {
  previousCode: string | null;
  nextCode: string | null;
  position: number;
  total: number;
};

export function resolveSupportQueueNavigation(
  requests: SupportQueueNavigationItem[],
  selectedCode: string | null
): SupportQueueNavigation {
  const selectedIndex = selectedCode
    ? requests.findIndex((request) => request.publicCode === selectedCode)
    : -1;

  if (selectedIndex < 0) {
    return {
      previousCode: null,
      nextCode: null,
      position: 0,
      total: requests.length,
    };
  }

  return {
    previousCode: requests[selectedIndex - 1]?.publicCode ?? null,
    nextCode: requests[selectedIndex + 1]?.publicCode ?? null,
    position: selectedIndex + 1,
    total: requests.length,
  };
}
