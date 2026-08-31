export type SupportQueuePayloadRow = {
  publicCode: string;
};

export type SupportQueueServiceRow = {
  service: string | null;
};

export type SupportQueuePayloadPagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export function hasUniqueSupportQueueRows(rows: SupportQueuePayloadRow[]): boolean {
  return new Set(rows.map((row) => row.publicCode)).size === rows.length;
}

export function hasUniqueSupportQueueServices(rows: SupportQueueServiceRow[]): boolean {
  const keys = rows.map((row) => row.service ?? "__unassigned__");
  return new Set(keys).size === keys.length;
}

export function hasCoherentSupportQueuePagination(
  requestCount: number,
  pagination: SupportQueuePayloadPagination
): boolean {
  if (
    !Number.isInteger(requestCount)
    || requestCount < 0
    || !Number.isInteger(pagination.page)
    || pagination.page < 1
    || !Number.isInteger(pagination.pageSize)
    || pagination.pageSize < 1
    || !Number.isInteger(pagination.total)
    || pagination.total < 0
    || !Number.isInteger(pagination.totalPages)
    || pagination.totalPages < 1
  ) {
    return false;
  }

  const expectedTotalPages = Math.max(1, Math.ceil(pagination.total / pagination.pageSize));
  if (
    pagination.totalPages !== expectedTotalPages
    || pagination.page > pagination.totalPages
    || requestCount > pagination.pageSize
    || requestCount > pagination.total
  ) {
    return false;
  }

  return pagination.total === 0
    ? pagination.page === 1 && requestCount === 0
    : requestCount > 0;
}
