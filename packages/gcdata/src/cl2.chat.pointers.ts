export type ChatMoteDataPointer = `data/${ChatMotePointer}`;
export type ChatMotePointer = ``
  | `moments/${string}/element/${string}/element/emoji`
  | `moments/${string}/element/${string}/element/speaker`
  | `moments/${string}/element/${string}/element/text/skip`
  | `moments/${string}/element/${string}/element/text/text`
  | `moments/${string}/element/${string}/element/text`
  | `moments/${string}/element/${string}/element`
  | `moments/${string}/element/${string}/order`
  | `moments/${string}/element/${string}`
  | `moments/${string}/element`
  | `moments/${string}/order`
  | `moments/${string}`
  | `moments`
  | `name`
  | `wip/notes/${string}/element/author`
  | `wip/notes/${string}/element/text`
  | `wip/notes/${string}/element/timestamp`
  | `wip/notes/${string}/element`
  | `wip/notes/${string}/order`
  | `wip/notes/${string}`
  | `wip/notes`
  | `wip/staging`
  | `wip`;
