'use client';
import { useCallback, useEffect, useState } from 'react';
import { getHiringManagerOpenings, getHiringManagerOpeningProfiles, shortlistProfile, rejectProfile } from '@/utils/Dashboard/HiringManager/hiringManagerApi';

export function useHiringManagerOpenings() {
  const [openings, setOpenings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true); setError('');
      const data = await getHiringManagerOpenings();
      setOpenings(data || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load openings');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return { openings, loading, error, reload: load };
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
