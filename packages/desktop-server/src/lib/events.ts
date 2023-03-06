import type { OmitByValue, PickByValue } from '@bscotch/utility/browser';
import { EventEmitter } from 'events';

export type EventEmitterConfig = { [name: string | symbol]: any };

export type EventListener<Payload> = undefined extends Payload
  ? () => void
  : (payload: Payload) => void;

export type EventsWithoutPayloads<Config extends EventEmitterConfig> =
  PickByValue<Config, undefined>;
export type EventsWithPayloads<Config extends EventEmitterConfig> = OmitByValue<
  Config,
  undefined
>;

export interface Emitter<T extends EventEmitterConfig> extends EventEmitter {
  addListener<Name extends keyof T>(
    eventName: Name,
    listener: EventListener<T[Name]>,
  ): this;

  on<Name extends keyof T>(
    eventName: Name,
    listener: EventListener<T[Name]>,
  ): this;

  once<Name extends keyof T>(
    eventName: Name,
    listener: EventListener<T[Name]>,
  ): this;

  removeListener<Name extends keyof T>(
    eventName: Name,
    listener: EventListener<T[Name]>,
  ): this;

  off<Name extends keyof T>(
    eventName: Name,
    listener: EventListener<T[Name]>,
  ): this;

  removeAllListeners<Name extends keyof T>(event?: Name): this;

  listeners<Name extends keyof T>(eventName: Name): Function[];

  rawListeners<Name extends keyof T>(eventName: Name): Function[];

  emit<Name extends keyof EventsWithoutPayloads<T>>(eventName: Name): boolean;
  emit<Name extends keyof EventsWithPayloads<T>>(
    eventName: Name,
    payload: T[Name],
  ): boolean;

  listenerCount<Name extends keyof T>(eventName: Name): number;

  prependListener<Name extends keyof T>(
    eventName: Name,
    listener: EventListener<T[Name]>,
  ): this;

  prependOnceListener<Name extends keyof T>(
    eventName: Name,
    listener: EventListener<T[Name]>,
  ): this;

  eventNames(): Array<keyof T & (string | symbol)>;
}

export function createEventEmitter<T extends EventEmitterConfig>(): Emitter<T> {
  return new EventEmitter({ captureRejections: true }) as Emitter<T>;
}
