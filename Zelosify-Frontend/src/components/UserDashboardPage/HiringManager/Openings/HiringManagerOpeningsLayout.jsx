'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { BriefcaseBusiness, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Button } from '@/components/UI/shadcn/button';
import { Input } from '@/components/UI/shadcn/input';
import { useHiringManagerOpenings } from '@/hooks/Dashboard/HiringManager/useHiringManagerOpenings';

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(value));
}

export default function HiringManagerOpeningsLayout() {
  const [searchTerm, setSearchTerm] = useState('');
  const { openings, pagination, loading, error, loadOpenings } = useHiringManagerOpenings();

  const filteredOpenings = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return openings;
    return openings.filter((o) =>
      [o.title, o.location, o.contractType, o.status]
        .filter(Boolean)
        .some((v) => v.toLowerCase().includes(term))
    );
  }, [openings, searchTerm]);

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="w-full px-4 py-5">

        {/* Header */}
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-tableHeader">
              <BriefcaseBusiness className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-semibold">My Contract Openings</h1>
              <p className="text-sm text-secondary">
                {pagination.total} {pagination.total === 1 ? 'opening' : 'openings'} assigned to you
              </p>
            </div>
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" />
            <Input
              className="pl-9"
              placeholder="Search openings"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-md border border-border">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-tableHeader">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-medium text-primary">Title</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-primary">Location</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-primary">Contract Type</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-primary">Posted Date</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-primary">Status</th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-primary">Profiles</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">

                {/* Skeleton rows */}
                {loading && Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-4">
                        <div className="h-4 w-28 animate-pulse rounded bg-tableHeader" />
                      </td>
                    ))}
                  </tr>
                ))}

                {/* Data rows */}
                {!loading && filteredOpenings.map((opening) => (
                  <tr key={opening.id} className="hover:bg-tableHeader">
                    <td className="px-4 py-4 text-sm">
                      <Link
                        className="font-medium text-foreground hover:underline"
                        href={`/hiring-manager/openings/${opening.id}`}
                      >
                        {opening.title}
                      </Link>
                    </td>
                    <td className="px-4 py-4 text-sm text-secondary">{opening.location || '-'}</td>
                    <td className="px-4 py-4 text-sm text-secondary">{opening.contractType || '-'}</td>
                    <td className="px-4 py-4 text-sm text-secondary">{formatDate(opening.postedDate)}</td>
                    <td className="px-4 py-4 text-sm">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                        opening.status === 'OPEN'
                          ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                          : opening.status === 'CLOSED'
                          ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                      }`}>
                        {opening.status}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-secondary">
                      {opening.profilesCount || 0} total ({opening.shortlistedCount || 0} ✓ / {opening.rejectedCount || 0} ✗)
                    </td>
                  </tr>
                ))}

                {/* Empty state */}
                {!loading && filteredOpenings.length === 0 && (
                  <tr>
                    <td className="px-4 py-10 text-center text-sm text-secondary" colSpan={6}>
                      No openings assigned to you.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination Controls — identical to IT Vendor */}
        <div className="mt-4 flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1 || loading}
            onClick={() => loadOpenings(pagination.page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
            Prev
          </Button>
          <span className="text-sm text-secondary">
            Page {pagination.page} of {pagination.totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages || loading}
            onClick={() => loadOpenings(pagination.page + 1)}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

      </div>
    </main>
  );
}
