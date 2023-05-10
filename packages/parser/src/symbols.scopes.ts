import { IToken } from 'chevrotain';
import { Location } from './symbols.location.js';
import {
  LocalVariable,
  ProjectSymbol,
  SelfVariable,
} from './symbols.symbol.js';

/** A region of code wherein some subset of variables are accessible. */
export abstract class Scope {
  variables = new Map<string, ProjectSymbol>();

  constructor(public readonly location: Location) {}

  abstract create(offset: number): Scope;

  abstract addVariable(token: IToken): void;
}

export class LocalScope extends Scope {
  override variables = new Map<string, LocalVariable>();

  /** Create a new localscope in the same file at a new offset. */
  override create(offset: number): LocalScope {
    return new LocalScope(this.location.at(offset));
  }

  addVariable(token: IToken, isParam = false) {
    // TODO: If this variable already exists, emit a warning
    // and add it as a reference to the existing variable.
    this.variables.set(
      token.image,
      new LocalVariable(token.image, this.location.at(token), isParam),
    );
  }
}

/**
 * A region of code wherein the variables for a specific instance are
 * available via `self`.
 */
export class SelfScope extends Scope {
  override variables = new Map<string, SelfVariable>();

  /** Create a new localscope in the same file at a new offset. */
  create(offset: number): InstanceScope {
    return new InstanceScope(this.location.at(offset));
  }

  addVariable(token: IToken) {
    // TODO: If this variable already exists, emit a warning
    // and add it as a reference to the existing variable.
    this.variables.set(
      token.image,
      new SelfVariable(token.image, this.location.at(token)),
    );
  }
}

/**
 * A region of code wherein the variables for a specific instance are
 * available via `self`, where that self is an object instance.
 */
export class InstanceScope extends SelfScope {}
