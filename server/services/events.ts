import { EventEmitter } from 'node:events';

export const submissionEvents = new EventEmitter();
submissionEvents.setMaxListeners(100);
