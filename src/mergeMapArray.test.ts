import {concat, firstValueFrom, of, Subject, timer} from 'rxjs'
import {delay, toArray} from 'rxjs/operators'
import {describe, expect, it} from 'vitest'

import {mergeMapArray} from './mergeMapArray'

describe('mergeMapArray()', () => {
  it('works with an empty array as input', async () => {
    const subject = new Subject<{id: number}[]>()

    const observable = subject.asObservable().pipe(
      mergeMapArray(() => timer(1000)),
      toArray(),
    )
    const promise = firstValueFrom(observable)
    subject.next([])
    subject.complete()
    expect(await promise).toMatchInlineSnapshot(`
      [
        [],
      ]
    `)
  })

  it('orders the output array based on the input array', async () => {
    const one = {id: 1}
    const two = {id: 2}
    const three = {id: 3}

    const subject = new Subject<{id: number}[]>()

    const observable = subject.asObservable().pipe(
      mergeMapArray((item) =>
        concat(of(`id=${item.id} #1`), of(`id=${item.id} #2`).pipe(delay(20))),
      ),
      toArray(),
    )
    const promise = firstValueFrom(observable)
    subject.next([one, two, three])
    subject.next([three, two, one])
    subject.complete()
    expect(await promise).toMatchInlineSnapshot(`
      [
        [
          "id=1 #1",
          "id=2 #1",
          "id=3 #1",
        ],
        [
          "id=3 #1",
          "id=2 #1",
          "id=1 #2",
        ],
        [
          "id=3 #1",
          "id=2 #2",
          "id=1 #2",
        ],
        [
          "id=3 #2",
          "id=2 #2",
          "id=1 #2",
        ],
      ]
    `)
  })

  it("stops the inner observable when it's source value is removed from the input array", async () => {
    const one = {id: 1}
    const two = {id: 2}
    const three = {id: 3}

    const subject = new Subject<{id: number}[]>()

    const observable = subject.asObservable().pipe(
      mergeMapArray((item) =>
        concat(of(`id=${item.id} #1`), of(`id=${item.id} #2`).pipe(delay(20))),
      ),
      toArray(),
    )
    const promise = firstValueFrom(observable)
    subject.next([one, two, three])
    subject.next([one, two])

    subject.complete()
    expect(await promise).toMatchInlineSnapshot(`
      [
        [
          "id=1 #1",
          "id=2 #1",
          "id=3 #1",
        ],
        [
          "id=1 #1",
          "id=2 #1",
        ],
        [
          "id=1 #2",
          "id=2 #1",
        ],
        [
          "id=1 #2",
          "id=2 #2",
        ],
      ]
    `)
  })

  it('works with duplicate elements', async () => {
    const one = {id: 1}
    const two = {id: 2}
    const three = {id: 3}

    const subject = new Subject<{id: number}[]>()

    const observable = subject.asObservable().pipe(
      mergeMapArray((item) => {
        return concat(of(`id=${item.id} #1`), of(`id=${item.id} #2`).pipe(delay(20)))
      }),
      toArray(),
    )
    const promise = firstValueFrom(observable)
    subject.next([one, two, three, one, two, three])
    subject.next([one, two])

    subject.complete()
    expect(await promise).toMatchInlineSnapshot(`
      [
        [
          "id=1 #1",
          "id=2 #1",
          "id=3 #1",
          "id=1 #1",
          "id=2 #1",
          "id=3 #1",
        ],
        [
          "id=1 #1",
          "id=2 #1",
        ],
        [
          "id=1 #2",
          "id=2 #1",
        ],
        [
          "id=1 #2",
          "id=2 #2",
        ],
      ]
    `)
  })

  it('works with multiple emissions', async () => {
    const one = {id: 1}
    const two = {id: 2}
    const three = {id: 3}

    const subject = new Subject<{id: number}[]>()

    const observable = subject.asObservable().pipe(
      mergeMapArray((item) => {
        return concat(of(`id=${item.id} #1`), of(`id=${item.id} #2`).pipe(delay(20)))
      }),
      toArray(),
    )
    const promise = firstValueFrom(observable)
    subject.next([one, two, one, two])
    subject.next([one])
    subject.next([one, two, three])
    subject.next([one, three])
    subject.next([one, two])
    subject.complete()
    expect(await promise).toMatchInlineSnapshot(`
      [
        [
          "id=1 #1",
          "id=2 #1",
          "id=1 #1",
          "id=2 #1",
        ],
        [
          "id=1 #1",
        ],
        [
          "id=1 #1",
          "id=2 #1",
          "id=3 #1",
        ],
        [
          "id=1 #1",
          "id=3 #1",
        ],
        [
          "id=1 #1",
          "id=3 #1",
        ],
        [
          "id=1 #1",
          "id=2 #1",
        ],
        [
          "id=1 #1",
          "id=2 #1",
        ],
        [
          "id=1 #2",
          "id=2 #1",
        ],
        [
          "id=1 #2",
          "id=2 #2",
        ],
      ]
    `)
  })

  it('supports custom isEqual', async () => {
    const one = {id: 1}
    const anotherone = {id: 1}

    const subject = new Subject<{id: number}[]>()

    const observable = subject.asObservable().pipe(
      mergeMapArray(
        (item) => {
          return concat(
            of(`id=${item.id} #1`),
            of(`id=${item.id} #2`).pipe(delay(20)),
            of(`id=${item.id} #3`).pipe(delay(100)),
          )
        },
        (a, b) => a.id === b.id,
      ),
      toArray(),
    )
    const promise = firstValueFrom(observable)
    subject.next([anotherone])
    subject.next([one])
    subject.next([anotherone, one])
    await new Promise((resolve) => setTimeout(resolve, 100))
    subject.next([anotherone])
    await new Promise((resolve) => setTimeout(resolve, 100))
    subject.complete()
    expect(await promise).toMatchInlineSnapshot(`
      [
        [
          "id=1 #1",
        ],
        [
          "id=1 #2",
          "id=1 #2",
        ],
        [
          "id=1 #3",
        ],
      ]
    `)
  })
})

it('waits for all mapped values to emit', async () => {
  const one = {id: 1}
  const anotherone = {id: 2}
  const third = {id: 3}

  const subject = new Subject<{id: number}[]>()

  const observable = subject.asObservable().pipe(
    mergeMapArray((item) =>
      item.id === 2
        ? of(`id=${item.id} #1`).pipe(delay(20))
        : item.id === 3
          ? of(`id=${item.id} #1`).pipe(delay(20))
          : of(`id=${item.id} #1`),
    ),
    toArray(),
  )
  const promise = firstValueFrom(observable)
  subject.next([one, anotherone])
  subject.next([one])
  await new Promise((resolve) => setTimeout(resolve, 100))
  subject.next([one, anotherone])
  await new Promise((resolve) => setTimeout(resolve, 100))
  subject.next([one, anotherone, third])
  await new Promise((resolve) => setTimeout(resolve, 100))
  subject.complete()
  expect(await promise).toMatchInlineSnapshot(`
    [
      [
        "id=1 #1",
      ],
      [
        "id=1 #1",
        "id=2 #1",
      ],
      [
        "id=1 #1",
        "id=2 #1",
        "id=3 #1",
      ],
    ]
  `)
})
