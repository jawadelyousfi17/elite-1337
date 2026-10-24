/** Page buttons to show: every page up to 7, otherwise first, last and the pages around the current one, with gaps. */
export function pageItems(page: number, pages: number): (number | 'gap')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, 'gap', pages];
  if (page >= pages - 3) return [1, 'gap', pages - 4, pages - 3, pages - 2, pages - 1, pages];
  return [1, 'gap', page - 1, page, page + 1, 'gap', pages];
}
