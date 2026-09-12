import {
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useEffect, useImperativeHandle, useMemo, useRef, useState, memo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  RefreshCcw,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '../ui/button';
import useDebounce from '@/hooks/use-debounce';
// import { Icon } from '@/assets/icons/icon';
import NotFound from '@/assets/images/not-found-img.svg';
import CustomSelect from './custom-select';
import Loader from './loader';
import { MemoizedTableManagerRow } from './table-manager-row';
import CommonFilter from './custom-filter';
import { normalizeSearchText } from '@/lib/utils';

const pageNumberListLimit = 5;
const perPagesArr = [25, 50, 100, 200];
const defaultSelect = (data: any) => data?.data?.data?.result?.rows;
const defaultOnSuccess = (data: any) => data;
const defaultFetcher = () => {};
const defaultGetSelectedRows = () => null;
const defaultGetRowClassName = () => '';
const defaultSubRowsMutateFn = () => null;
const defaultMakeSubRowPayload = () => null;
const defaultShowMoreData = () => null;
const defaultHandleFilterChange = () => null;
const defaultHandleReset = () => null;
const defaultHandleFilterSelect = () => null;

function TableManager({
  columns,
  onSuccess = defaultOnSuccess,
  loading = false,
  fetcherKey = '',
  fetcherFn = defaultFetcher,
  select = defaultSelect,
  customHeader = null,
  getSelectedRows = defaultGetSelectedRows,
  initiallySelectedRows = {},
  extraParams = {},
  search = '',
  staticData,
  showPagination = true,
  loaderTableClass = '',
  type = '',
  getRowClassName = defaultGetRowClassName,
  emptyTablePlaceholder = 'No Record Found!',
  tableRef,
  isHeightSet = true,
  tableMaxHeight = null,
  fitHeightToContent = false,
  hasSubRows = false,
  subRowsMutateKey = '',
  subRowsMutateFn = defaultSubRowsMutateFn,
  makeSubRowPayload = defaultMakeSubRowPayload,
  showMoreData = defaultShowMoreData,
  enabled = true,
  isFilter = false,
  filterFields = [],
  handleFilterChange = defaultHandleFilterChange,
  handleReset = defaultHandleReset,
  filterRef,
  handleFilterSelect = defaultHandleFilterSelect,
  customClass = '',
  tableWrapClassName = 'overflow-auto table-scroll rounded-xl border border-gray-200 bg-white',
  tableClassName = 'w-full text-xs xxl:text-sm text-gray-700 h-full',
  theadClassName = 'bg-gray-50 text-gray-90/80 sticky top-0 left-0 z-10',
  headerRowClassName = '',
  getHeaderCellClassName,
  getCellClassName,
  descriptionEmptyTable = '',
  emptyIcon = null,
  imageSize = 'min-w-44  max-w-44',
  clientSideSearch = false,
  renderSubComponent,
  hideFooterRefresh = false,
  recordsPosition = 'left',
  centerPager = false,
  pagerAccentClassName = 'border-ucass-blue-600 text-ucass-blue-600 bg-white',
  disablePerPageMenuPortal = false,
  hideFooterDivider = false,
  perPageMenuPortalTarget,
  perPageSelectClass,
  recordNoun,
}: Readonly<{
  columns: any;
  loading?: boolean;
  onSuccess?: (data: any) => void;
  customHeader?: any;
  getSelectedRows?: (selectedRows: any, rows: any) => void;
  fetcherKey?: any;
  fetcherFn?: (data: any) => any;
  select?: (response: any) => any;
  initiallySelectedRows?: { [key: string]: boolean };
  getTblData?: any;
  tableRef?: any;
  extraParams?: object;
  search?: string;
  loaderTableClass?: string;
  staticData?: any[];
  showPagination?: boolean;
  type?: string;
  emptyTablePlaceholder?: string;
  getRowClassName?: (row: any) => string;
  isHeightSet?: boolean;
  tableMaxHeight?: any;
  /* isHeightSet locks the table box to a fixed `height` (tableMaxHeight, or
     the measured `tableHeight` fallback) so it doesn't grow/shrink as a
     client-side search filters rows in and out. That same fixed height
     also reserves blank space below a short result set, sitting between
     the last row and the footer, when the box is taller than its content
     needs. `fitHeightToContent` swaps `height` for `max-height` — still
     capped so a long result set scrolls internally instead of growing the
     page without bound, but a short one shrinks the box to fit, closing
     that gap. */
  fitHeightToContent?: boolean;
  hasSubRows?: boolean;
  subRowsMutateKey?: string;
  subRowsMutateFn?: (payload?: any) => any;
  makeSubRowPayload?: (row: any) => any;
  showMoreData?: (row: any) => any;
  enabled?: boolean;
  isFilter?: boolean;
  filterFields?: any[];
  handleFilterChange?: (data: Record<string, any>) => void;
  handleReset?: () => void;
  filterRef?: any;
  handleFilterSelect?: any;
  customClass?: string;
  /** Full override of the outer scroll-wrapper's classes (defaults to the
      current rounded/bordered card look) — for a table that needs to sit
      flush inside its own page card instead of drawing a second one. */
  tableWrapClassName?: string;
  /** Full override of the `<table>` element's own classes. */
  tableClassName?: string;
  /** Full override of `<thead>`'s classes. */
  theadClassName?: string;
  /** Classes for the header `<tr>` — empty by default since the header
      background currently lives on `<thead>` instead. */
  headerRowClassName?: string;
  /** Full override of a header `<th>`'s classes, given its resolved text
      alignment ('left' | 'center' | 'right'). Falls back to the current
      hardcoded template when omitted, so every existing table is
      unaffected. */
  getHeaderCellClassName?: (textAlign: string) => string;
  /** Full override of a body `<td>`'s classes, given the cell instance.
      Falls back to the current hardcoded template when omitted. */
  getCellClassName?: (cell: any) => string;
  descriptionEmptyTable?: string;
  imageSize?: string;
  emptyIcon?: React.ReactNode;
  clientSideSearch?: boolean;
  renderSubComponent?: (rowOriginal: any) => React.ReactNode;
  hideFooterRefresh?: boolean;
  recordsPosition?: 'left' | 'right';
  centerPager?: boolean;
  pagerAccentClassName?: string;
  disablePerPageMenuPortal?: boolean;
  /* Drops the `sm:divide-x` line TableManager's footer normally draws
     between the per-page picker and the "N record(s)" count, and forces
     that count to the same muted slate as the rest of the footer instead
     of whatever color it would otherwise inherit — for callers whose own
     design has no such divider (the Numbers section's plain text-only
     footer). Left false, behavior is unchanged. */
  hideFooterDivider?: boolean;
  /* The "per page" react-select menu portals to document.body by default,
     which escapes this table's own overflow:hidden card — necessary so the
     menu isn't clipped, but it also means the menu no longer inherits CSS
     variables scoped to a themed ancestor (a page-specific accent color,
     say). Passing an element still inside that themed ancestor — but
     outside anything that clips — keeps both: no clipping, and the right
     theme. Left undefined, behavior is unchanged (portals to body).
     `disablePerPageMenuPortal` still takes priority when both are set. */
  perPageMenuPortalTarget?: HTMLElement | null;
  /* Rides onto the per-page select via react-select's classNamePrefix, so a
     page can style its own menu even though the menu is portaled to <body>
     and therefore outside that page's wrapper. Unset elsewhere: no change. */
  perPageSelectClass?: string;
  /* What the rows ARE, e.g. "webhook" — the footer then reads "4 webhooks"
     instead of "4 record(s)". Unset elsewhere, which keeps the old text. */
  recordNoun?: string;
}>) {
  const [rowSelection, setRowSelection] = useState(initiallySelectedRows);
  const [maxPageNumberListLimit, setMaxPageNumberListLimit] = useState(5);
  const [minPageNumberListLimit, setMinPageNumberListLimit] = useState(0);
  const [{ pageIndex, pageSize }, setPagination] = useState({
    pageIndex: 0,
    pageSize: 25,
  });
  const [perPage, setPerPage] = useState<any>({
    label: 25,
    value: 25,
  });
  /* A second's wait is there to spare the API a request per keystroke. A
     client-side search makes no request at all, so that second was only ever
     a second of the table looking broken. */
  const debouncedSearch = useDebounce(search, clientSideSearch ? 200 : 1000);
  const normalizedSearch = normalizeSearchText(debouncedSearch);
  const [paginationSearch, setPaginationSearch] = useState(normalizedSearch);
  const hasSearchChanged = normalizedSearch !== paginationSearch;
  const effectivePageIndex = hasSearchChanged ? 0 : pageIndex;
  const pagination = useMemo(
    () => ({
      pageIndex: effectivePageIndex,
      pageSize,
    }),
    [effectivePageIndex, pageSize],
  );
  const usesStaticData = staticData !== undefined;
  const hasRemoteFetcher = fetcherFn !== defaultFetcher;
  const isRemoteQueryEnabled = enabled && !usesStaticData && hasRemoteFetcher;

  const payload = {
    page: effectivePageIndex + 1,
    limit: pageSize,
    ...(clientSideSearch ? {} : { search: normalizedSearch || undefined }),
    ...(type && { type }),
    ...extraParams,
  };

  useEffect(() => {
    if (!hasSearchChanged) return;

    setPagination((current) => ({ ...current, pageIndex: 0 }));
    setPaginationSearch(normalizedSearch);
    setMinPageNumberListLimit(0);
    setMaxPageNumberListLimit(pageNumberListLimit);
  }, [hasSearchChanged, normalizedSearch]);

  const {
    data: tbldata,
    isLoading,
    refetch,
    isRefetching,
    isFetching,
  }: any = useQuery({
    queryFn: ({ queryKey }) => fetcherFn(queryKey[1] || {}),
    queryKey: [`${fetcherKey}`, { ...payload }],
    refetchOnWindowFocus: false,
    retry: false,
    enabled: isRemoteQueryEnabled,
  });

  const tableData = useMemo(() => {
    const rows = usesStaticData ? staticData || [] : select(tbldata) || [];

    if (!clientSideSearch || !normalizedSearch) return rows;

    /* Match what the table SHOWS, not what the record stores. A row whose
       `type` is `call_completed` renders as "Call Completed", so searching
       the words on screen found nothing while the underscored raw value —
       which nobody can see — was the only thing that matched. Separators
       collapse to spaces on both sides of the comparison. */
    const loosen = (value: unknown) =>
      String(value ?? '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    const needle = loosen(normalizedSearch);

    return rows.filter((row: any) =>
      Object.values(row || {}).some((value) => loosen(value).includes(needle)),
    );
  }, [tbldata, staticData, select, normalizedSearch, clientSideSearch, usesStaticData]);

  const table = useReactTable({
    onRowSelectionChange: setRowSelection,
    columns,
    // data: staticData?.length > 0 ? staticData : select(tbldata) || [],
    data: tableData,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (row: any, index: number) =>
      String(row?._id ?? row?.id ?? row?.uuid ?? row?.value ?? index),
    /* staticData is the whole dataset up front — its page count is knowable
       from its own length, unlike the API-backed path where a page count
       comes back from the server (or -1 while that's unknown). Passing -1
       here for static data left getPageOptions() with nothing to enumerate,
       so the current-page pill never rendered even though there was
       obviously exactly one page.

       Only turned on when the pagination row is actually shown, though: a
       caller passing staticData with showPagination={false} is asking to
       see every row with no paging UI at all, and switching on real
       (non-manual) pagination would start slicing that data to pageSize
       behind its back with no controls left to reach the rest. */
    pageCount: usesStaticData
      ? showPagination
        ? Math.max(1, Math.ceil(tableData.length / pageSize))
        : 1
      : tbldata?.data?.data?.result?.totalPages
        ? tbldata?.data?.data?.result?.totalPages
        : -1,
    getPaginationRowModel: getPaginationRowModel(),
    state: {
      pagination,
      rowSelection,
    },
    onPaginationChange: setPagination,
    manualPagination: !(usesStaticData && showPagination),
    enableRowSelection: true,
  });
  const hasRows = table.getRowModel().rows.length > 0;
  const showInitialLoader = !hasRows && (isLoading || loading);

  const handleNextPage = () => {
    table?.nextPage();
    if (pageIndex === table?.getPageCount() - 1) {
      return false;
    } else {
      if (pageIndex + 2 > maxPageNumberListLimit) {
        setMaxPageNumberListLimit(maxPageNumberListLimit + pageNumberListLimit);
        setMinPageNumberListLimit(minPageNumberListLimit + pageNumberListLimit);
      }
    }
  };
  const handlePreviousPage = () => {
    table?.previousPage();
    if (pageIndex === 0) {
      return;
    } else {
      if (pageIndex % pageNumberListLimit === 0) {
        setMaxPageNumberListLimit(maxPageNumberListLimit - pageNumberListLimit);
        setMinPageNumberListLimit(minPageNumberListLimit - pageNumberListLimit);
      }
    }
  };
  const handleLastPage = () => {
    table?.setPageIndex(table?.getPageCount() - 1);
    const min = table.getPageCount() - 5;
    const max = table.getPageCount();

    setMaxPageNumberListLimit(max);
    setMinPageNumberListLimit(min);
  };
  const handleFirstPage = () => {
    table?.setPageIndex(0);
    const min = 0;
    const max = 5;
    setMaxPageNumberListLimit(max);
    setMinPageNumberListLimit(min);
  };

  useEffect(() => {
    getSelectedRows(rowSelection, select(tbldata));
  }, [rowSelection, tbldata]);

  useEffect(() => {
    onSuccess(tbldata);
  }, [tbldata]);

  useImperativeHandle(
    tableRef,
    () => ({
      refetchTable: () => refetch(),
      getTableData: () => select(tbldata),
      getTableDataCounts: () => tbldata?.data?.data?.result || {},
      getTotal: () => tbldata?.data?.data?.result?.total || 0,
      clearSelection: () => setRowSelection({}),
    }),
    [tbldata, isFetching],
  );

  const [tableHeight, setTableHeight] = useState<number>(350);
  const tableScrollRef = useRef<HTMLDivElement | null>(null);

  const adjustTableHeight = () => {
    const windowHeight = window.innerHeight;
    const offsetTop = tableScrollRef.current?.getBoundingClientRect()?.top || 0;
    const nextHeight = Math.max(windowHeight - offsetTop - 58 - 8, 260);

    setTableHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
  };

  useEffect(() => {
    let resizeRaf = 0;
    const scheduleAdjustTableHeight = () => {
      if (resizeRaf) {
        window.cancelAnimationFrame(resizeRaf);
      }

      resizeRaf = window.requestAnimationFrame(() => {
        resizeRaf = 0;
        adjustTableHeight();
      });
    };

    adjustTableHeight();
    window.addEventListener('resize', scheduleAdjustTableHeight);

    const resizeObserver = new ResizeObserver(scheduleAdjustTableHeight);

    if (tableScrollRef.current) {
      resizeObserver.observe(tableScrollRef.current);
    }

    if (tableScrollRef.current?.parentElement) {
      resizeObserver.observe(tableScrollRef.current.parentElement);
    }

    return () => {
      window.removeEventListener('resize', scheduleAdjustTableHeight);
      if (resizeRaf) {
        window.cancelAnimationFrame(resizeRaf);
      }
      resizeObserver.disconnect();
    };
  }, []);
  return (
    <>
      {customHeader && (
        <div className="border-b border-b-gray-200 ">
          <div className="px-3 py-2 ">{customHeader}</div>
        </div>
      )}
      <div
        ref={tableScrollRef}
        className={`${tableWrapClassName} ${customClass}`}
        style={
          isHeightSet && showPagination
            ? fitHeightToContent
              ? { maxHeight: tableMaxHeight || `${tableHeight}px` }
              : { height: tableMaxHeight || `${tableHeight}px` }
            : {}
        }
      >
        {isFilter && (
          <CommonFilter
            fields={filterFields}
            onFilterChange={handleFilterChange}
            handleReset={handleReset}
            handleFilterSelect={handleFilterSelect}
            ref={filterRef}
          />
        )}

        <Table className={tableClassName}>
          <TableHeader className={theadClassName}>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className={headerRowClassName}>
                {hasSubRows && (
                  <TableHead
                    className={`px-2 xl:px-4 py-2 font-semibold border-b  bborder-gray-200 last-of-type:border-r-0 text-gray-900/80`}
                  ></TableHead>
                )}
                {headerGroup.headers.map((header: any, headerIndex: number) => {
                  const textAlign =
                    header.id === 'action' ? 'center' : header.column.columnDef?.meta?.textAlign;

                  return (
                    <TableHead
                      key={`${header.id}_${headerIndex}`}
                      className={
                        getHeaderCellClassName
                          ? getHeaderCellClassName(textAlign ?? 'left')
                          : `px-2 xl:px-4 py-2 font-semibold text-${textAlign ?? 'left'} border-b  border-gray-200 last-of-type:border-r-0 text-gray-900/80`
                      }
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>

          <TableBody className="divide-y divide-gray-200 bg-white h-full w-full font-normal">
            {hasRows
              ? table.getRowModel().rows.map((row) => {
                  const isSummaryRow = row.original?.isSummary;

                  if (isSummaryRow) {
                    return (
                      <TableRow key={row.id}>
                        <TableCell
                          colSpan={columns.length - 1}
                          className="px-2 xl:px-4 py-2 border-b  border-gray-200 text-right font-normal"
                        >
                          {row.original.desc}
                        </TableCell>
                        <TableCell className="px-4 py-2 border-b  border-gray-200 font-normal">
                          {row.original.total_price}
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <MemoizedTableManagerRow
                      row={row}
                      key={row?.id}
                      hasSubRows={hasSubRows}
                      subRowsMutateFn={subRowsMutateFn}
                      subRowsMutateKey={subRowsMutateKey}
                      makeSubRowPayload={makeSubRowPayload}
                      columns={columns}
                      getRowClassName={getRowClassName}
                      getCellClassName={getCellClassName}
                      showMoreData={showMoreData}
                      renderSubComponent={renderSubComponent}
                    />
                  );
                })
              : null}
          </TableBody>
        </Table>
        {showInitialLoader ? (
          <div
            className={`flex flex-col justify-center items-center gap-2 h-[calc(100%_-_45px)] w-full mx-auto ${loaderTableClass}`}
          >
            <Loader variant="blue" />
          </div>
        ) : !hasRows ? (
          emptyIcon ? (
            <div className="flex h-[calc(100%_-_45px)] w-full flex-col items-center justify-center gap-3 py-5 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-ucass-blue-600/10 text-ucass-blue-600">
                {emptyIcon}
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">{emptyTablePlaceholder}</p>
                {descriptionEmptyTable && (
                  <p className="mt-1 max-w-[320px] text-xs text-slate-500">{descriptionEmptyTable}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col justify-center items-center gap-3 py-12 h-[calc(100%_-_45px)] w-full mx-auto">
              <img src={NotFound} alt="BusyImage" className={imageSize} />
              <p className="text-md font-medium text-gray-900">{emptyTablePlaceholder}</p>
              <p className="text-sm text-gray-700">{descriptionEmptyTable}</p>
            </div>
          )
        ) : null}

        {/* {!table.getRowModel().rows?.length && !isLoading && !isFetching && (
          <div className="flex flex-col justify-center items-center gap-1 py-5 h-[calc(100%_-_45px)] w-full mx-auto">
            <Icon name="NotFound" className="text-gray-500 w-15 h-15" />
            <p className="text-sm text-gray-700">{emptyTablePlaceholder}</p>
          </div>
        )}
        {((!table.getRowModel().rows?.length && isLoading && isFetching) ||
          (!table.getRowModel().rows?.length && loading)) && (
          <div className="flex flex-col justify-center items-center gap-2 h-[calc(100%_-_45px)] w-full mx-auto">
            <Loader variant="blue" />
          </div>
        )} */}
      </div>

      {showPagination && (() => {
        const recordCount = usesStaticData
          ? tableData.length
          : tbldata?.data?.data?.result?.totalItems || tbldata?.data?.data?.result?.total || 0;
        const recordLabel = (
          <span
            className={`whitespace-nowrap font-normal ${recordsPosition === 'left' ? 'sm:pl-3' : ''} ${hideFooterDivider ? 'text-slate-500' : ''}`}
          >
            {recordCount}{' '}
            {recordNoun ? `${recordNoun}${Number(recordCount) === 1 ? '' : 's'}` : 'record(s)'}
          </span>
        );
        const perPageSelect = (
          <span className="flex items-center gap-1.5">
            <div className="w-16 tableSelect tableSelect--sm">
              <CustomSelect
                options={perPagesArr?.map((page) => ({
                  label: page,
                  value: page,
                }))}
                handleChange={(value) => {
                  setPerPage(value);
                  setPagination({
                    pageIndex: 0,
                    pageSize: value.value,
                  });
                  setMinPageNumberListLimit(0);
                  setMaxPageNumberListLimit(pageNumberListLimit);
                }}
                value={perPage}
                inputClass={perPageSelectClass}
                menuPlacement="top"
                menuPortalTarget={disablePerPageMenuPortal ? false : perPageMenuPortalTarget}
              />
            </div>
            <span>per page</span>
          </span>
        );
        const refreshButton = !hideFooterRefresh && (
          <Button
            aria-label="Refresh"
            title="Refresh"
            className="mcm-tblrefresh cursor-pointer text-gray-900/80 hover:text-primary h-6 w-6"
            type="button"
            variant={'ghost'}
            onClick={() => refetch()}
          >
            {isRefetching || isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCcw width={14} height={14} className="cursor-pointer" />
            )}
          </Button>
        );
        const pagerControls = (
          <>
            <button
              type="button"
              onClick={() => handleFirstPage()}
              disabled={!table?.getCanPreviousPage()}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handlePreviousPage()}
              disabled={!table?.getCanPreviousPage()}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            {table?.getPageOptions()?.map((page, index) => {
              let start = pageIndex - Math.floor(pageNumberListLimit / 2);
              let end = pageIndex + Math.ceil(pageNumberListLimit / 2);
              if (start < 0) {
                end += Math.abs(start);
                start = 0;
              }
              if (page < end && page >= start) {
                const isCurrent = table?.getState()?.pagination?.pageIndex === index;
                return (
                  <button
                    type="button"
                    key={page}
                    onClick={() => table?.setPageIndex(index)}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] transition-colors ${
                      isCurrent
                        ? `${pagerAccentClassName} border font-bold shadow-[0_1px_2px_rgba(0,0,0,.06)]`
                        : 'text-slate-500 font-medium hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {page + 1}
                  </button>
                );
              } else {
                return null;
              }
            })}

            <button
              type="button"
              onClick={() => handleNextPage()}
              disabled={!table?.getCanNextPage()}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleLastPage()}
              disabled={!table?.getCanNextPage()}
              className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </>
        );

        if (centerPager) {
          return (
            <div className="border-t border-slate-200 px-[18px] py-1.5">
              <div className="flex w-full flex-col items-center gap-1.5 bg-white px-2 py-1 sm:flex-row sm:justify-between">
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 sm:gap-4">
                  {perPageSelect}
                  {recordLabel}
                  {refreshButton}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">{pagerControls}</div>
              </div>
            </div>
          );
        }

        return (
        // sticky left-0 bottom-2
        <div className="z-10 flex w-full flex-col gap-2 rounded-xl border border-gray-200 bg-white px-2 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-2 font-semibold sm:gap-3">
              <div
                className={`flex flex-wrap items-center gap-3 ${hideFooterDivider ? '' : 'sm:divide-x sm:divide-gray-200'}`}
              >
                {perPageSelect}
                {recordsPosition === 'left' && recordLabel}
              </div>
              {refreshButton}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-1 sm:justify-end">
              {pagerControls}
              {recordsPosition === 'right' && recordLabel}
            </div>
          </div>
        </div>
        );
      })()}
    </>
  );
}
const MemoizedTableManager = memo(TableManager);
export default MemoizedTableManager;
