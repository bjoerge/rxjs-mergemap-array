import {filter, merge, mergeMap, Observable, scan, share, takeUntil} from 'rxjs'
import {map, withLatestFrom} from 'rxjs/operators'

type State<T> = {
  current: T[]
  added: T[]
  removed: T[]
}

const INITIAL_STATE: State<never> = {
  current: [],
  added: [],
  removed: [],
}

const EMPTY_ARRAY: never[] = []
/**
 * Operator that takes an array as input and emits a new array with the value of the projected observable for each item in the input array.
 * It creates a new inner observable for each unique element in the input array, and it will keep the subscription to the inner observable for as long as the input array includes the element.
 * The operator will emit the projected values in the same order as the input array, and if the order of elements in the input array changes, it will move items in the output array to match the new order.
 * @param project - Function that takes an item from the input array and returns an observable that emits the projected value.
 * @param isEqual - Optional function to compare items in the input array. Defaults to strict equality.
 * @public
 */
export function mergeMapArray<T, R>(
  project: (item: T) => Observable<R>,
  isEqual: (a: T, b: T) => boolean = (a, b) => a === b,
): (source: Observable<T[]>) => Observable<R[]> {
  return (input: Observable<T[]>): Observable<R[]> => {
    const sharedInput = input.pipe(share())
    const state$ = sharedInput
      .pipe(
        scan((state: State<T>, next: T[]) => {
          const added = next.filter(
            (item) => !state.current.find((current) => isEqual(current, item)),
          )

          const removed = state.current.filter(
            (item) => !next.find((current) => isEqual(current, item)),
          )

          return {
            current: next,
            added: uniqueBy(added, isEqual),
            removed: uniqueBy(removed, isEqual),
          }
        }, INITIAL_STATE),
      )
      .pipe(
        share(),
        filter((state) => state.added.length > 0 || state.removed.length > 0),
      )

    // emits elements as they are added to the input array
    const removed$ = state$.pipe(mergeMap((state) => state.removed))

    // emits elements as they are removed from the input array
    const added$ = state$.pipe(mergeMap((state) => state.added))

    // special case for empty input array since it won't trigger any emission on the "add element" stream
    const empty = sharedInput.pipe(
      filter((arr) => arr.length === 0),
      map(() => EMPTY_ARRAY),
    )

    const mapped = added$.pipe(
      mergeMap((element) => {
        const removed = removed$.pipe(filter((k) => isEqual(k, element))).pipe(share())
        return merge(
          removed.pipe(map(() => ({type: 'remove', element}) as const)),
          project(element).pipe(
            takeUntil(removed),
            map((projected) => ({type: 'emit', element, projected}) as const),
          ),
        )
      }),
      withLatestFrom(sharedInput),
      scan((acc: (undefined | {item: T; emitted: boolean; value: R})[], [event, inputArray]) => {
        return inputArray.flatMap((item) => {
          if (isEqual(item, event.element)) {
            return event.type === 'remove' ? [] : {item, emitted: true, value: event.projected}
          }
          // find the entry from the previous emission and move it to the right place
          return acc.find((v) => v && isEqual(v.item, item))
        })
      }, []),
      filter((v) => v.every((item) => item?.emitted)),
      map((v) => v.map((item) => item!.value)),
    )

    return merge(empty, mapped)
  }
}

function uniqueBy<T>(array: T[], predicate: (a: T, b: T) => boolean): T[] {
  const deduped: T[] = []
  let hasDuplicates = false
  for (const item of array) {
    const exists = deduped.find((previous) => predicate(previous, item))
    if (exists) {
      hasDuplicates = true
    } else {
      deduped.push(item)
    }
  }
  return hasDuplicates ? deduped : array
}
