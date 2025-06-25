/*
 * Pipeline Worker - Commented out due to TypeScript issues
 * Uncomment when ML features are needed
 */

// Export types for compatibility
export interface InitEventData {
  type: 'init';
  args: any[];
}

export interface RunEventData {
  type: 'run';
  id: number;
  args: any[];
}

export interface OutgoingEventData {
  type: 'progress' | 'ready' | 'result';
  data?: any;
  id?: number;
}

// Placeholder to prevent import errors
export const PipelineWorker = {
  init: () => Promise.resolve(),
};
