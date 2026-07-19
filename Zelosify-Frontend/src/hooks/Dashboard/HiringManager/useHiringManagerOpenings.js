'use client';
import { useCallback, useEffect, useState } from 'react';
import { getHiringManagerOpenings, getHiringManagerOpeningProfiles, shortlistProfile, rejectProfile } from '@/utils/Dashboard/HiringManager/hiringManagerApi';

export function useHiringManagerOpenings(initialPage = 1) {
  const [openings, setOpenings] = useState([]);
  const [pagination, setPagination] = useState({
    page: initialPage,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadOpenings = useCallback(async (page) => {
    try {
      setLoading(true);
      setError('');
      const data = await getHiringManagerOpenings({ page, limit: 10 });
      setOpenings(data.items || []);
      setPagination(data.pagination);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load openings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadOpenings(initialPage); }, [initialPage, loadOpenings]);

  return { openings, pagination, loading, error, loadOpenings };
}


export function useHiringManagerOpeningDetails(openingId) {
  const [data, setData] = useState(null); // { opening, profiles }
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(null); // profileId being actioned
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!openingId) return;
    try {
      setLoading(true); setError('');
      const result = await getHiringManagerOpeningProfiles(openingId);
      setData(result);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load profiles');
    } finally {
      setLoading(false);
    }
  }, [openingId]);

  useEffect(() => { load(); }, [load]);

  const shortlist = async (profileId) => {
    try { setActioning(profileId); setError('');
      await shortlistProfile(profileId); await load();
    } catch (err) { setError(err?.response?.data?.message || err.message || 'Failed to shortlist'); }
    finally { setActioning(null); }
  };

  const reject = async (profileId) => {
    try { setActioning(profileId); setError('');
      await rejectProfile(profileId); await load();
    } catch (err) { setError(err?.response?.data?.message || err.message || 'Failed to reject'); }
    finally { setActioning(null); }
  };

  return { opening: data?.opening ?? null, profiles: data?.profiles ?? [], loading, actioning, error, shortlist, reject };
}
