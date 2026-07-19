'use client';

import React from 'react';
import Link from 'next/link';
import { BriefcaseBusiness } from 'lucide-react';
import { useHiringManagerOpenings } from '@/hooks/Dashboard/HiringManager/useHiringManagerOpenings';
import { Button } from '@/components/UI/shadcn/button';

export default function HiringManagerOpeningsLayout() {
  const { openings, loading, error, reload } = useHiringManagerOpenings();

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BriefcaseBusiness className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold text-primary">My Contract Openings</h1>
            <p className="text-sm text-secondary">
              {loading ? 'Loading...' : `Showing ${openings?.length || 0} assigned openings`}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="border border-red-500 bg-red-50 p-4 rounded-md text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={reload} className="mt-2">Retry</Button>
        </div>
      )}

      <div className="border border-border rounded-md overflow-hidden bg-background">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-tableHeader text-secondary text-xs uppercase font-medium">
              <tr>
                <th className="px-6 py-4">Title</th>
                <th className="px-6 py-4">Location</th>
                <th className="px-6 py-4">Contract Type</th>
                <th className="px-6 py-4">Posted Date</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Profiles</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 6 }).map((_, index) => (
                  <tr key={index} className="animate-pulse">
                    <td className="px-6 py-4"><div className="h-4 bg-tableHeader rounded w-3/4"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-tableHeader rounded w-1/2"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-tableHeader rounded w-1/2"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-tableHeader rounded w-1/2"></div></td>
                    <td className="px-6 py-4"><div className="h-6 bg-tableHeader rounded-full w-20"></div></td>
                    <td className="px-6 py-4"><div className="h-4 bg-tableHeader rounded w-full"></div></td>
                  </tr>
                ))
              ) : openings.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-secondary">
                    No openings assigned to you.
                  </td>
                </tr>
              ) : (
                openings.map((opening) => (
                  <tr key={opening.id} className="hover:bg-tableHeader/50 transition-colors text-foreground">
                    <td className="px-6 py-4">
                      <Link 
                        href={`/hiring-manager/openings/${opening.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {opening.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">{opening.location || '-'}</td>
                    <td className="px-6 py-4">{opening.contractType || '-'}</td>
                    <td className="px-6 py-4">{formatDate(opening.createdAt)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        opening.status === 'OPEN' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                        opening.status === 'CLOSED' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                        'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
                      }`}>
                        {opening.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-secondary">
                      {opening.profilesCount || 0} total ({opening.shortlistedCount || 0} ✓ / {opening.rejectedCount || 0} ✗)
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
