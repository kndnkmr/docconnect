// React hook: live doctor counts per specialty ({ name: count } or null).
// One request per page load, shared by every component; a saved copy is
// used straight away so the order doesn't jump for returning visitors.
// See specialtyAvailability.js.
import { useEffect, useState } from 'react';
import { doctorAPI } from '../services/api';
import { readSavedCounts, saveCounts } from './specialtyAvailability';

const store = typeof window !== 'undefined' ? window.localStorage : null;
let current = store ? readSavedCounts(store) : null;
let request = null;
const listeners = new Set();

function load() {
  if (!request) {
    request = doctorAPI.specialtyCounts()
      .then((res) => {
        const counts = res?.data?.counts;
        if (counts && typeof counts === 'object') {
          current = counts;
          if (store) saveCounts(store, counts);
          listeners.forEach((fn) => fn(counts));
        }
      })
      .catch(() => { request = null; /* try again on the next page */ });
  }
  return request;
}

export default function useSpecialtyCounts() {
  const [counts, setCounts] = useState(current);
  useEffect(() => {
    listeners.add(setCounts);
    if (current) setCounts(current);
    load();
    return () => { listeners.delete(setCounts); };
  }, []);
  return counts;
}
