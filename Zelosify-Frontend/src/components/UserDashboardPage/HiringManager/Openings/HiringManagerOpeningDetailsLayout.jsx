'use client';

import React from 'react';
import Link from 'next/link';
import { useHiringManagerOpeningDetails } from '@/hooks/Dashboard/HiringManager/useHiringManagerOpenings';
import { ArrowLeft, FileText, CheckCircle2, MinusCircle, XCircle, Clock, Loader2, BriefcaseBusiness } from 'lucide-react';
import { Button } from '@/components/UI/shadcn/button';

export default function HiringManagerOpeningDetailsLayout({ openingId }) {
  const { opening, profiles, loading, actioning, error, shortlist, reject } = useHiringManagerOpeningDetails(openingId);

  const totalProfiles = profiles?.length || 0;
  const shortlistedProfiles = profiles?.filter(p => p.status === 'SHORTLISTED')?.length || 0;
  const rejectedProfiles = profiles?.filter(p => p.status === 'REJECTED')?.length || 0;

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <Link href="/hiring-manager/openings" className="inline-flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors">
          <ArrowLeft className="w-4 h-4" />
          My Openings
        </Link>
      </div>

      {loading ? (
        <div className="animate-pulse">
          <div className="h-8 bg-tableHeader rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-tableHeader rounded w-1/2 mb-4"></div>
          <div className="h-6 bg-tableHeader rounded-full w-20"></div>
        </div>
      ) : opening ? (
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-primary">{opening.title}</h1>
          <p className="text-sm text-secondary">{opening.description}</p>
          <div className="mt-2">
            <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
              opening.status === 'OPEN' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
              opening.status === 'CLOSED' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
              'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300'
            }`}>
              {opening.status}
            </span>
          </div>
        </div>
      ) : null}

      {error && (
        <div className="border border-red-500 bg-red-50 p-4 rounded-md text-red-700 dark:bg-red-900/20 dark:text-red-300">
          <p>{error}</p>
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-border rounded-md p-4 bg-background">
            <h3 className="text-sm font-medium text-secondary">Total Profiles</h3>
            <p className="text-2xl font-bold text-primary mt-1">{totalProfiles}</p>
          </div>
          <div className="border border-border rounded-md p-4 bg-background">
            <h3 className="text-sm font-medium text-secondary">Shortlisted</h3>
            <p className="text-2xl font-bold text-primary mt-1">{shortlistedProfiles}</p>
          </div>
          <div className="border border-border rounded-md p-4 bg-background">
            <h3 className="text-sm font-medium text-secondary">Rejected</h3>
            <p className="text-2xl font-bold text-primary mt-1">{rejectedProfiles}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 mt-2">
        <h2 className="text-lg font-semibold text-primary">Profiles Review</h2>
        <div className="flex flex-col gap-4 max-h-[70vh] overflow-y-auto pr-2 pb-4">
          {loading ? (
            Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="border border-border rounded-md p-4 bg-background animate-pulse h-48 flex flex-col gap-4">
                <div className="flex justify-between">
                  <div className="h-6 bg-tableHeader rounded w-1/3"></div>
                  <div className="h-6 bg-tableHeader rounded w-20"></div>
                </div>
                <div className="h-8 bg-tableHeader rounded w-1/4"></div>
                <div className="h-4 bg-tableHeader rounded w-3/4"></div>
                <div className="mt-auto flex gap-2">
                  <div className="h-8 bg-tableHeader rounded w-24"></div>
                  <div className="h-8 bg-tableHeader rounded w-24"></div>
                </div>
              </div>
            ))
          ) : profiles?.length === 0 ? (
            <div className="text-center py-12 text-secondary border border-border border-dashed rounded-md bg-background/50">
              No profiles submitted for this opening yet.
            </div>
          ) : (
            profiles?.map((profile) => {
              const isPending = profile.recommendationBadge === 'PENDING';
              
              let recommendationIcon;
              let recommendationClass = '';
              let recommendationText = '';

              switch (profile.recommendationBadge) {
                case 'RECOMMENDED':
                  recommendationIcon = <CheckCircle2 className="w-4 h-4" />;
                  recommendationClass = 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300';
                  recommendationText = 'Recommended';
                  break;
                case 'BORDERLINE':
                  recommendationIcon = <MinusCircle className="w-4 h-4" />;
                  recommendationClass = 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300';
                  recommendationText = 'Borderline';
                  break;
                case 'NOT_RECOMMENDED':
                  recommendationIcon = <XCircle className="w-4 h-4" />;
                  recommendationClass = 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
                  recommendationText = 'Not Recommended';
                  break;
                case 'PENDING':
                default:
                  recommendationIcon = <Clock className="w-4 h-4" />;
                  recommendationClass = 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
                  recommendationText = 'AI Processing...';
                  break;
              }

              return (
                <div key={profile.id} className="border border-border rounded-md bg-background flex flex-col">
                  {/* Top Header Row */}
                  <div className="p-4 border-b border-border flex justify-between items-start">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-2 text-primary font-medium">
                        <FileText className="w-5 h-5 text-secondary" />
                        {profile.resumeFilename || 'resume.pdf'}
                      </div>
                      <div className="text-xs text-secondary pl-7">
                        Uploaded: {formatDate(profile.createdAt)}
                      </div>
                    </div>
                    <div>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                        profile.status === 'SUBMITTED' ? 'bg-blue-100 text-blue-700' :
                        profile.status === 'SHORTLISTED' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {profile.status}
                      </span>
                    </div>
                  </div>

                  {/* Recommendation Body */}
                  <div className="p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${recommendationClass}`}>
                        {recommendationIcon}
                        {recommendationText}
                      </span>
                      
                      {!isPending && (
                        <>
                          <div className="text-sm font-medium text-foreground">
                            Score: {Math.round((profile.recommendationScore ?? 0) * 100)}%
                          </div>
                          <div className="text-sm text-secondary">
                            Confidence: {Math.round((profile.recommendationConfidence ?? 0) * 100)}%
                          </div>
                        </>
                      )}
                    </div>

                    {isPending ? (
                      <div className="animate-pulse flex flex-col gap-2 mt-2">
                        <div className="h-4 bg-tableHeader rounded w-3/4"></div>
                        <div className="h-4 bg-tableHeader rounded w-1/2"></div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm italic text-secondary border-l-2 border-border pl-3 mt-1">
                          "{profile.recommendationReason}"
                        </p>
                        <div className="text-xs text-secondary mt-1">
                          Processing: {profile.recommendationLatencyMs}ms
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div className="p-4 border-t border-border bg-tableHeader/30 flex gap-3">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={profile.status === 'SHORTLISTED' || actioning === profile.id}
                      onClick={() => shortlist(profile.id)}
                      className="gap-2"
                    >
                      {actioning === profile.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      Shortlist
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={profile.status === 'REJECTED' || actioning === profile.id}
                      onClick={() => reject(profile.id)}
                      className="gap-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                    >
                      {actioning === profile.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                      Reject
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
