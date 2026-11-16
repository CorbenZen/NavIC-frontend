import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Hook for managing table state (sort, filter, pagination) with URL persistence.
 * State is synced to/from URL query parameters for shareable links.
 */
export function useTableState({
  pageKey = 'page',
  pageSizeKey = 'pageSize',
  sortKey = 'sort',
  sortDirKey = 'sortDir',
  filterPrefix = 'filter.',
  defaultPageSize = 25,
  defaultSort = null,
  defaultSortDir = 'asc',
  savedFiltersKey = 'savedTableFilters',
  pageSizeOptions = [10, 25, 50, 100],
}) {
  const [page, setPage] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const p = parseInt(params.get(pageKey), 10);
      return Number.isFinite(p) && p >= 0 ? p : 0;
    }
    return 0;
  });

  const [pageSize, setPageSize] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const ps = parseInt(params.get(pageSizeKey), 10);
      return Number.isFinite(ps) && pageSizeOptions.includes(ps) ? ps : defaultPageSize;
    }
    return defaultPageSize;
  });

  const [sort, setSort] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get(sortKey) || defaultSort;
    }
    return defaultSort;
  });

  const [sortDir, setSortDir] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get(sortDirKey) || defaultSortDir;
    }
    return defaultSortDir;
  });

  const [filters, setFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const result = {};
      for (const [key, value] of params.entries()) {
        if (key.startsWith(filterPrefix)) {
          result[key.slice(filterPrefix.length)] = value;
        }
      }
      return result;
    }
    return {};
  });

  const [savedFilters, setSavedFilters] = useState(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(savedFiltersKey);
        return stored ? JSON.parse(stored) : {};
      } catch {
        return {};
      }
    }
    return {};
  });

  const isInitialMount = useRef(true);

  // Sync state to URL
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const params = new URLSearchParams(window.location.search);
    params.set(pageKey, String(page));
    params.set(pageSizeKey, String(pageSize));
    if (sort) params.set(sortKey, sort);
    else params.delete(sortKey);
    params.set(sortDirKey, sortDir);
    // Remove old filter params
    for (const key of params.keys()) {
      if (key.startsWith(filterPrefix)) params.delete(key);
    }
    // Add current filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== '' && value !== null && value !== undefined) {
        params.set(`${filterPrefix}${key}`, String(value));
      }
    }
    const newUrl = `${window.location.pathname}?${params.toString()}${window.location.hash}`;
    window.history.replaceState({}, '', newUrl);
  }, [page, pageSize, sort, sortDir, filters, pageKey, pageSizeKey, sortKey, sortDirKey, filterPrefix]);

  // Persist saved filters to localStorage
  useEffect(() => {
    localStorage.setItem(savedFiltersKey, JSON.stringify(savedFilters));
  }, [savedFilters, savedFiltersKey]);

  const handleSort = useCallback((column) => {
    if (sort === column) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSort(column);
      setSortDir('asc');
    }
    setPage(0);
  }, [sort]);

  const handleFilterChange = useCallback((key, value) => {
    setFilters((prev) => {
      const next = { ...prev };
      if (value === '' || value === null || value === undefined) {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next;
    });
    setPage(0);
  }, []);

  const handlePageChange = useCallback((newPage) => {
    setPage(newPage);
  }, []);

  const handlePageSizeChange = useCallback((newPageSize) => {
    setPageSize(newPageSize);
    setPage(0);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setPage(0);
  }, []);

  const saveFilter = useCallback((name, filterState) => {
    setSavedFilters((prev) => ({
      ...prev,
      [name]: { ...filterState, savedAt: Date.now() },
    }));
  }, []);

  const deleteSavedFilter = useCallback((name) => {
    setSavedFilters((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const applySavedFilter = useCallback((name) => {
    const filter = savedFilters[name];
    if (filter) {
      setFilters(filter.filters || {});
      setPage(filter.page || 0);
      setPageSize(filter.pageSize || defaultPageSize);
      setSort(filter.sort || defaultSort);
      setSortDir(filter.sortDir || defaultSortDir);
    }
  }, [savedFilters, defaultPageSize, defaultSort, defaultSortDir]);

  const sortedData = useCallback((data, getSortValue) => {
    if (!sort) return data;
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...data].sort((a, b) => {
      const aVal = getSortValue ? getSortValue(a, sort) : a[sort];
      const bVal = getSortValue ? getSortValue(b, sort) : b[sort];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return dir;
      if (bVal == null) return -dir;
      if (aVal < bVal) return -dir;
      if (aVal > bVal) return dir;
      return 0;
    });
  }, [sort, sortDir]);

  const paginatedData = useCallback((data) => {
    const start = page * pageSize;
    return data.slice(start, start + pageSize);
  }, [page, pageSize]);

  const getSortProps = useCallback((column) => ({
    'aria-sort': sort === column ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none',
    onClick: () => handleSort(column),
    style: { cursor: 'pointer', userSelect: 'none' },
  }), [sort, sortDir, handleSort]);

  const getSortIndicator = useCallback((column) => {
    if (sort !== column) return null;
    return sortDir === 'asc' ? ' ▲' : ' ▼';
  }, [sort, sortDir]);

  return {
    page,
    setPage: handlePageChange,
    pageSize,
    setPageSize: handlePageSizeChange,
    sort,
    sortDir,
    setSort: handleSort,
    filters,
    setFilters: handleFilterChange,
    clearFilters,
    savedFilters,
    saveFilter,
    deleteSavedFilter,
    applySavedFilter,
    pageSizeOptions,
    sortedData,
    paginatedData,
    totalPages: (total) => Math.ceil(total / pageSize),
    getSortProps,
    getSortIndicator,
  };
}

/**
 * Hook for column sorting with aria attributes.
 */
export function useColumnSort({ sort, sortDir, onSort }) {
  return useMemo(() => ({
    getSortProps: (column) => ({
      'aria-sort': sort === column ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none',
      onClick: () => onSort(column),
      style: { cursor: 'pointer', userSelect: 'none' },
    }),
    getSortIndicator: (column) => {
      if (sort !== column) return null;
      return sortDir === 'asc' ? ' ▲' : ' ▼';
    },
  }), [sort, sortDir, onSort]);
}