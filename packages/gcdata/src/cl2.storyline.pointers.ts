export type StorylineMoteDataPointer = `data/${StorylineMotePointer}`;
export type StorylineMotePointer = ``
  | `description/description`
  | `description/skip`
  | `description/text`
  | `description`
  | `icon`
  | `name/description`
  | `name/skip`
  | `name/text`
  | `name`
  | `order`
  | `scramble_description/description`
  | `scramble_description/skip`
  | `scramble_description/text`
  | `scramble_description`
  | `scramble_icon`
  | `wip/notes/${string}/element/author`
  | `wip/notes/${string}/element/text`
  | `wip/notes/${string}/element/timestamp`
  | `wip/notes/${string}/element`
  | `wip/notes/${string}/order`
  | `wip/notes/${string}`
  | `wip/notes`
  | `wip/staging`
  | `wip`;
