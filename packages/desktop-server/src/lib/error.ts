import { TRPCError } from '@trpc/server';

export function trpcAssert(
  condition: unknown,
  message: string,
  code: TRPCError['code'] = 'BAD_REQUEST',
): asserts condition {
  if (!condition) {
    throw new TRPCError({
      code,
      message,
    });
  }
}
