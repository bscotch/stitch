export type StorylineMoteDataPointer = `data/${StorylineMotePointer}`;
export type StorylineMotePointer = ``
  | `description/description`
  | `description/text`
  | `description`
  | `icon`
  | `name/description`
  | `name/text`
  | `name`
  | `order`
  | `wip/audio`
  | `wip/balance`
  | `wip/comments/${string}/element`
  | `wip/comments/${string}/order`
  | `wip/comments/${string}`
  | `wip/comments`
  | `wip/draft`
  | `wip/integration`
  | `wip/mechanics`
  | `wip/text`
  | `wip/visuals`
  | `wip`;
