// State names for the player and lurker state machines.

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
