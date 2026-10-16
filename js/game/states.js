/**
 * The two state machines' state names, shared by the modules that read them.
 */

export const PLAYER_STATE = Object.freeze({
  MECH: 'mech',
  DRIVE: 'drive',
  HACKING: 'hacking',
});

export const LURKER_STATE = Object.freeze({
  PATROL: 'patrol',
  ALERT: 'alert',
  PURSUE: 'pursue',
  RETURN: 'return',
});
