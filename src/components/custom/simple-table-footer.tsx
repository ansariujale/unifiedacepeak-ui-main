import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import CustomSelect from './custom-select';

const PER_PAGE_OPTIONS = [25, 50, 100, 200];
const PAGE_WINDOW = 5;

export interface SimplePagination {
  pageIndex: number;
  pageSize: number;
}

const pagerButtonClass =
  'flex h-7 w-7 items-center justify-center rounded-full border border-gray-200 bg-gray-50 text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:border-gray-100 disabled:bg-gray-50 disabled:text-gray-400 disabled:opacity-50 disabled:hover:border-gray-100 disabled:hover:bg-gray-50 disabled:hover:text-gray-400';

/* A stand-in for TableManager's own pagination footer (same classes, same
   pill-shaped per-page picker and circular pager) for the two Numbers-
   section views that render their own hand-rolled tables instead of going
   through TableManager — Call coverage and By line — and so never had a
   footer at all. A plain array-slice instead of TanStack Table underneath
   it, so it stays a light client-side pager rather than a rewrite of
   either page's table into TableManager columns. */
const SimpleTableFooter = ({
  totalItems,
  pagination,
  onPaginationChange,
  menuPortalTarget,
}: {
  totalItems: number;
  pagination: SimplePagination;
  onPaginationChange: (next: SimplePagination) => void;
  menuPortalTarget?: HTMLElement | null;
}) => {
  const { pageIndex, pageSize } = pagination;
  const pageCount = Math.max(1, Math.ceil(totalItems / pageSize));
  const canPrev = pageIndex > 0;
  const canNext = pageIndex < pageCount - 1;

  const goTo = (index: number) => onPaginationChange({ pageIndex: index, pageSize });

  let start = pageIndex - Math.floor(PAGE_WINDOW / 2);
  let end = pageIndex + Math.ceil(PAGE_WINDOW / 2);
  if (start < 0) {
    end += Math.abs(start);
    start = 0;
  }
  end = Math.min(end, pageCount);
  const pageNumbers = Array.from({ length: end - start }, (_, i) => start + i);

  return (
    <div className="z-10 flex w-full flex-col gap-2 rounded-b-xl border-t border-t-[#f0f0f0] bg-white px-[18px] pt-3 pb-1.5 text-[12.5px] text-slate-500 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-1.5">
          <div className="w-16 tableSelect tableSelect--sm">
            <CustomSelect
              options={PER_PAGE_OPTIONS.map((page) => ({ label: page, value: page }))}
              handleChange={(value: any) =>
                onPaginationChange({ pageIndex: 0, pageSize: value.value })
              }
              value={{ label: pageSize, value: pageSize }}
              menuPlacement="top"
              isSearchable={false}
              menuPortalTarget={menuPortalTarget}
            />
          </div>
          <span>per page</span>
        </span>
        <span className="whitespace-nowrap font-normal">{totalItems} record(s)</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <button type="button" onClick={() => goTo(0)} disabled={!canPrev} className={pagerButtonClass}>
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => goTo(Math.max(0, pageIndex - 1))}
          disabled={!canPrev}
          className={pagerButtonClass}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
        {pageNumbers.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => goTo(page)}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] transition-colors ${
              page === pageIndex
                ? 'border border-red-600 bg-red-600 font-bold text-white shadow-[0_1px_2px_rgba(0,0,0,.06)]'
                : 'border border-gray-200 bg-gray-50 font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-100 hover:text-gray-800'
            }`}
          >
            {page + 1}
          </button>
        ))}
        <button
          type="button"
          onClick={() => goTo(Math.min(pageCount - 1, pageIndex + 1))}
          disabled={!canNext}
          className={pagerButtonClass}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => goTo(pageCount - 1)}
          disabled={!canNext}
          className={pagerButtonClass}
        >
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default SimpleTableFooter;
