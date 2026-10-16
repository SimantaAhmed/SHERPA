/**
 * 
 * Base state class for our finite state machine
 * (pseudo-abstract class in JS)
 * ensure State instances cannot be created
 * and enter, update, and exit are implemented 
 * 
 */

export class State {

  // Disallow creating an instance of State itself
  constructor() {
    if (new.target === State) {
      throw new Error("Cannot instantiate abstract class State");
    }
  }

  // Called when an entity enters this State
  enter() { throw new Error("enter() must be implemented"); }

  // Called every update while the entity is in this state
  update() { throw new Error("update() must be implemented"); }

  // Called when an entity exits this state
  exit() { throw new Error("exit() must be implemented"); }

}