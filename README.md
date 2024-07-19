# rxjs-mergemap-array

An RxJS map operator that takes an observable of arrays as input and emits arrays where each element represents emissions from the projected observable.

The order of elements in the output array corresponds to the order of elements in the input array, and inner observables is kept active for as long as the input element exists in the input array. So if the input array has `n` values, the output array will also have `n` values. The `project` function will be called once for each _unique_ element in the input array and the output array will distribute the mapped values based on the repeated positions in the input array.

It behaves similar to `combineLatest`in that it will not emit the first value until each inner observable emits at least one value.

# When should I use it?

This map operator is useful in cases where you have an observable that emits an array where the same elements may appear in multiple places or change position over time, and you want to do continuous work for each unique element.

For example, imagine that you are subscribing to a list of uuids that each represents a database record. The order of each uuid may change within the set over time, new uuids may be added, and some may be removed. You want to do some work for each unique uuid, but you don't want to do the work multiple times for the same uuid, and you also don't want to restart the work if the uuid keep being part of the set, even if position changes, and you only want to stop doing the work when an uuid is removed from the set.

## Example

Do work for each unique element in the array, and keep doing the work for as long as the element is in the array, even if it's position changes.

```ts
const result = merge(
  of(["first", "second", "third", "second"]),
  of(["second", "third", "second", "first"]).pipe(delay(10)),
  of(["second", "third", "first"]).pipe(delay(20)),
).pipe(
  // doWork will be called once per unique element in the array for as long as the element is in the array
  mergeMapArray((uuid) => doWork(uuid)),
)

result.subscribe((array) => console.log(array))
```

## API

### mergeMapArray

```ts
declare function mergeMapArray<T, R>(project: (item: T) => Observable<R>, isEqual?: (a: T, b: T) => boolean): OperatorFunction<T[], R[]>
```

## License

MIT
