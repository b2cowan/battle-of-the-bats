'use client';
/** The Resolve Temporary Facilities window. Moved out of the schedule page as it was (Stage 3 Part 0, a pure move). */
import React from 'react';
import { AlertCircle, Check, RefreshCw, X } from 'lucide-react';
import type { ScheduleFacilityLane, Venue } from '@/lib/types';
import styles from '../schedule-admin.module.css';

export default function ResolveFacilitiesModal({
  setResolveFacilitiesOpen, modalTitleStyle, unresolvedFacilityLanes, unresolvedLaneGameCounts, facilityLaneSelections,
  setFacilityLaneSelections, venues, resolveFacilitiesError, resolvingFacilities, resolveTemporaryFacilities,
}: {
  setResolveFacilitiesOpen: (open: boolean) => void;
  modalTitleStyle: React.CSSProperties;
  unresolvedFacilityLanes: ScheduleFacilityLane[];
  unresolvedLaneGameCounts: Map<string, number>;
  facilityLaneSelections: Record<string, string>;
  setFacilityLaneSelections: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  venues: Venue[];
  resolveFacilitiesError: string | null;
  resolvingFacilities: boolean;
  resolveTemporaryFacilities: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={() => setResolveFacilitiesOpen(false)}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3 style={modalTitleStyle}>
            Resolve Temporary Facilities
          </h3>
          <button className="btn btn-ghost btn-data" onClick={() => setResolveFacilitiesOpen(false)}><X size={16} /></button>
        </div>
        <div className={styles.resolveFacilityList}>
          {unresolvedFacilityLanes.map(lane => (
            <div key={lane.id} className={styles.resolveFacilityRow}>
              <div>
                <strong>{lane.label}</strong>
                <span>{unresolvedLaneGameCounts.get(lane.id) ?? 0} games</span>
              </div>
              <select
                className={styles.formSelect}
                value={facilityLaneSelections[lane.id] ?? ''}
                onChange={e => setFacilityLaneSelections(prev => ({ ...prev, [lane.id]: e.target.value }))}
              >
                <option value="">Select venue or facility...</option>
                {venues.map(venue => (
                  <React.Fragment key={venue.id}>
                    <option value={`venue:${venue.id}`}>{venue.name}</option>
                    {(venue.facilities?.length ?? 0) > 0 && (
                      <optgroup label={venue.name}>
                        {venue.facilities!.map(facility => (
                          <option key={facility.id} value={`facility:${facility.id}`}>{facility.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </React.Fragment>
                ))}
              </select>
            </div>
          ))}
        </div>
        {resolveFacilitiesError && (
          <div className={styles.errorBanner} style={{ margin: '0.75rem 0 0' }}>
            <AlertCircle size={16} /> {resolveFacilitiesError}
          </div>
        )}
        <div className="modal-footer">
          <button type="button" className="btn btn-ghost btn-data" onClick={() => setResolveFacilitiesOpen(false)}>Cancel</button>
          <button
            type="button"
            className="btn btn-primary btn-data"
            onClick={resolveTemporaryFacilities}
            disabled={resolvingFacilities || unresolvedFacilityLanes.some(lane => !facilityLaneSelections[lane.id])}
          >
            {resolvingFacilities ? <><RefreshCw className="spin" size={14} /> Updating...</> : <><Check size={14} /> Update Games</>}
          </button>
        </div>
      </div>
    </div>
  );
}
