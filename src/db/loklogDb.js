import Dexie from 'dexie';

export const db = new Dexie('LokLogDB');

db.version(1).stores({
  // Shifts Table
  // id: UUID (Primary Key) or unique string from server
  // date: Index for calendar lookups
  // user_id: To separate users if needed later
  // updated_at: Timestamp for Last-Write-Wins sync
  // dirty: 1 if needs sync, 0 if synced
  shifts: '++id, date, user_id, updated_at, dirty',

  // Segments Table
  // id: Auto-increment Key
  // shift_id: Foreign Key to link to Shift (currently we store segments INSIDE the shift object for V1 simplicity as per plan,
  // but plan said "Segments Table...".
  // HOWEVER: The FUTURE_PLAN.md said: "Guest Rides and Waiting Times... kept as JSON arrays inside the shifts table... is acceptable for V1."
  // It also defined a `segments` table.
  // Given the complexity of Sync ("Last Write Wins" on the whole day is easier if it's one record),
  // I will check the user's preference or stick to the plan.
  // The plan explicitly defined a `segments` table. I will stick to that to be robust.
  // segments: '++id, shift_id, from_code, to_code'
});
