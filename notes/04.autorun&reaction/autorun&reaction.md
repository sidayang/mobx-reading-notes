# Mobx Source Code Reading Note 4

## autorun / reaction function

### Notice

To make this note more clear to get understood, noncritical codes in some functions may be truncated. Complete codes can be found via those hyperlinks.

### Demo

```ts
class DemoStore {
  @mobx.observable
  observedArray = ["a", "b", "c", "d"];
}
const demoStoreInstance = new DemoStore();

console.log(demoStoreInstance.observedArray);

mobx.autorun((reaction) =>
  console.log(demoStoreInstance.observedArray.join(","))
);

mobx.reaction(
  () => demoStoreInstance.observedArray.length,
  (length, reaction) => {
    console.log({ length, reaction });
  }
);

demoStoreInstance.observedArray[1] = "b1";
demoStoreInstance.observedArray.push("e");
demoStoreInstance.observedArray = ["a2", "b2", "c2", "d2"];
```

mobx.computed is

[src/api/autorun.ts#L28](https://github.com/mobxjs/mobx/blob/5.13.0/src/api/autorun.ts#L28)

```ts
export function autorun(
  view: (r: IReactionPublic) => any,
  opts: IAutorunOptions = EMPTY_OBJECT
): IReactionDisposer {
  if (process.env.NODE_ENV !== "production") {
    invariant(
      typeof view === "function",
      "Autorun expects a function as first argument"
    );
    invariant(
      isAction(view) === false,
      "Autorun does not accept actions since actions are untrackable"
    );
  }

  const name: string =
    (opts && opts.name) || (view as any).name || "Autorun@" + getNextId();
  const runSync = !opts.scheduler && !opts.delay;
  let reaction: Reaction;

  if (runSync) {
    // normal autorun
    reaction = new Reaction(
      name,
      function (this: Reaction) {
        this.track(reactionRunner);
      },
      opts.onError
    );
  } else {
    const scheduler = createSchedulerFromOptions(opts);
    // debounced autorun
    let isScheduled = false;

    reaction = new Reaction(
      name,
      () => {
        if (!isScheduled) {
          isScheduled = true;
          scheduler(() => {
            isScheduled = false;
            if (!reaction.isDisposed) reaction.track(reactionRunner);
          });
        }
      },
      opts.onError
    );
  }

  function reactionRunner() {
    view(reaction);
  }

  reaction.schedule();
  return reaction.getDisposer();
}
```

Essentially, what `autorun` does is to create a `Reaction` and then invoke its `schedule` method, where `runReactions`, `onInvalidate` get called in order.

`onInvalidate` is `this.track(reactionRunner)`, which is passed as the second argument in `Reaction`'s initialization

[src/core/reaction.ts#L54](https://github.com/mobxjs/mobx/blob/5.13.0/src/core/reaction.ts#L54)

```ts
export class Reaction implements IDerivation, IReactionPublic {
  observing: IObservable[] = []; // nodes we are looking at. Our value depends on these nodes
  dependenciesState = IDerivationState.NOT_TRACKING;

  constructor(
    public name: string = "Reaction@" + getNextId(),
    private onInvalidate: () => void,
    private errorHandler?: (error: any, derivation: IDerivation) => void
  ) {}

  schedule() {
    if (!this._isScheduled) {
      this._isScheduled = true;
      globalState.pendingReactions.push(this);
      runReactions();
    }
  }

  /**
   * internal, use schedule() if you intend to kick off a reaction
   */
  runReaction() {
    if (!this.isDisposed) {
      startBatch();
      this._isScheduled = false;
      if (shouldCompute(this)) {
        this._isTrackPending = true;

        try {
          this.onInvalidate();
          if (
            this._isTrackPending &&
            isSpyEnabled() &&
            process.env.NODE_ENV !== "production"
          ) {
            // onInvalidate didn't trigger track right away..
            spyReport({
              name: this.name,
              type: "scheduled-reaction",
            });
          }
        } catch (e) {
          this.reportExceptionInDerivation(e);
        }
      }
      endBatch();
    }
  }

  track(fn: () => void) {
    if (this.isDisposed) {
      return;
      // console.warn("Reaction already disposed") // Note: Not a warning / error in mobx 4 either
    }
    startBatch();
    const notify = isSpyEnabled();
    let startTime;
    if (notify && process.env.NODE_ENV !== "production") {
      startTime = Date.now();
      spyReportStart({
        name: this.name,
        type: "reaction",
      });
    }
    this._isRunning = true;
    const result = trackDerivedFunction(this, fn, undefined);
    this._isRunning = false;
    this._isTrackPending = false;
    if (this.isDisposed) {
      // disposed during last run. Clean up everything that was bound after the dispose call.
      clearObserving(this);
    }
    if (isCaughtException(result))
      this.reportExceptionInDerivation(result.cause);
    if (notify && process.env.NODE_ENV !== "production") {
      spyReportEnd({
        time: Date.now() - startTime,
      });
    }
    endBatch();
  }
}
```

[src/core/derivation.ts#L163](https://github.com/mobxjs/mobx/blob/5.13.0/src/core/derivation.ts#L163)

1. `derivation` is the reaction instance, whose `derivation.observing` is `[]`
2. `f` is the function passed to `autorun`, and in this case it's `reaction => console.log(demoStoreInstance.observedArray.join(","))`
3. `context` is `undefined`

```ts
export function trackDerivedFunction<T>(
  derivation: IDerivation,
  f: () => T,
  context: any
) {
  // pre allocate array allocation + room for variation in deps
  // array will be trimmed by bindDependencies
  changeDependenciesStateTo0(derivation);
  derivation.newObserving = new Array(derivation.observing.length + 100);
  derivation.unboundDepsCount = 0;
  derivation.runId = ++globalState.runId;
  const prevTracking = globalState.trackingDerivation;
  globalState.trackingDerivation = derivation;
  let result;
  if (globalState.disableErrorBoundaries === true) {
    result = f.call(context);
  } else {
    try {
      result = f.call(context);
    } catch (e) {
      result = new CaughtException(e);
    }
  }
  globalState.trackingDerivation = prevTracking;
  bindDependencies(derivation);
  return result;
}
```

current `reaction` is assigned to `globalState.trackingDerivation`, which will be retrieved later

`reaction => console.log(demoStoreInstance.observedArray.join(","))` get called when we call `f.call(context)`

From previous notes, we knew that accessing `demoStoreInstance.observedArray` will trigger the getter in [new&decorator.md#L234](../03.new&decorator/new&decorator.md#L234).

Then `demoStoreInstance[$mobx].read('observedArray')`, where the `read` method in `Class ObservableObjectAdministration`, which is `demoStoreInstance[$mobx].values.get(key)!.get()`, where `demoStoreInstance[$mobx].values.get(key)` is the instance of `ObservableValue`.

[src/types/observablevalue.ts#L121](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observablevalue.ts#L121)

```ts
export class ObservableValue<T> extends Atom
  implements
    IObservableValue<T>,
    IInterceptable<IValueWillChange<T>>,
    IListenable {
  public get(): T {
    this.reportObserved();
    return this.dehanceValue(this.value);
  }
}
```

the `reportObserved` is inherited from `Atom`, and `Atom` import this function from [src/core/observable.ts#L133](https://github.com/mobxjs/mobx/blob/5.13.0/src/core/observable.ts#L133)

`observalbe` in paramaters is the `ObservableValue`, which is `demoStoreInstance[$mobx].values.get('observedArray')` in this case.

`globalState.trackingDerivation` is the `reaction` we assigned just now, in this way, we link the `reaction` and `demoStoreInstance[$mobx].values.get('observedArray')`

```ts
export function reportObserved(observable: IObservable): boolean {
  const derivation = globalState.trackingDerivation;
  if (derivation !== null) {
    /**
     * Simple optimization, give each derivation run an unique id (runId)
     * Check if last time this observable was accessed the same runId is used
     * if this is the case, the relation is already known
     */
    if (derivation.runId !== observable.lastAccessedBy) {
      observable.lastAccessedBy = derivation.runId;
      // Tried storing newObserving, or observing, or both as Set, but performance didn't come close...
      derivation.newObserving![derivation.unboundDepsCount++] = observable;
      if (!observable.isBeingObserved) {
        observable.isBeingObserved = true;
        observable.onBecomeObserved();
      }
    }
    return true;
  } else if (observable.observers.size === 0 && globalState.inBatch > 0) {
    queueForUnobservation(observable);
  }
  return false;
}
```

after this, the value of `demoStoreInstance.observedArray` would get accessed and from Note 1 we know that `demoStoreInstance.observedArray` is a proxy, so `demoStoreInstance.observedArray.join()` will go to a [proxy](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observablearray.ts#L92) and a [proxy join](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observablearray.ts#L477)

```ts
[
  "concat",
  "every",
  "filter",
  "forEach",
  "indexOf",
  "join",
  "lastIndexOf",
  "map",
  "reduce",
  "reduceRight",
  "slice",
  "some",
  "toString",
  "toLocaleString",
].forEach((funcName) => {
  arrayExtensions[funcName] = function () {
    const adm: ObservableArrayAdministration = this[$mobx];
    adm.atom.reportObserved();
    const res = adm.dehanceValues(adm.values);
    return res[funcName].apply(res, arguments);
  };
});
```

by `adm.atom.reportObserved()`, we link this `atom` to the current `reaction`

continue the remaining part after `f.call`

[src/core/derivation.ts#L192](https://github.com/mobxjs/mobx/blob/5.13.0/src/core/derivation.ts#L192)

```ts
function bindDependencies(derivation: IDerivation) {
  // invariant(derivation.dependenciesState !== IDerivationState.NOT_TRACKING, "INTERNAL ERROR bindDependencies expects derivation.dependenciesState !== -1");
  const prevObserving = derivation.observing;
  const observing = (derivation.observing = derivation.newObserving!);
  let lowestNewObservingDerivationState = IDerivationState.UP_TO_DATE;

  // Go through all new observables and check diffValue: (this list can contain duplicates):
  //   0: first occurrence, change to 1 and keep it
  //   1: extra occurrence, drop it
  let i0 = 0,
    l = derivation.unboundDepsCount;
  for (let i = 0; i < l; i++) {
    const dep = observing[i];
    if (dep.diffValue === 0) {
      dep.diffValue = 1;
      if (i0 !== i) observing[i0] = dep;
      i0++;
    }

    // Upcast is 'safe' here, because if dep is IObservable, `dependenciesState` will be undefined,
    // not hitting the condition
    if (
      ((dep as any) as IDerivation).dependenciesState >
      lowestNewObservingDerivationState
    ) {
      lowestNewObservingDerivationState = ((dep as any) as IDerivation)
        .dependenciesState;
    }
  }
  observing.length = i0;

  derivation.newObserving = null; // newObserving shouldn't be needed outside tracking (statement moved down to work around FF bug, see #614)

  // Go through all old observables and check diffValue: (it is unique after last bindDependencies)
  //   0: it's not in new observables, unobserve it
  //   1: it keeps being observed, don't want to notify it. change to 0
  l = prevObserving.length;
  while (l--) {
    const dep = prevObserving[l];
    if (dep.diffValue === 0) {
      removeObserver(dep, derivation);
    }
    dep.diffValue = 0;
  }

  // Go through all new observables and check diffValue: (now it should be unique)
  //   0: it was set to 0 in last loop. don't need to do anything.
  //   1: it wasn't observed, let's observe it. set back to 0
  while (i0--) {
    const dep = observing[i0];
    if (dep.diffValue === 1) {
      dep.diffValue = 0;
      addObserver(dep, derivation);
    }
  }

  // Some new observed derivations may become stale during this derivation computation
  // so they have had no chance to propagate staleness (#916)
  if (lowestNewObservingDerivationState !== IDerivationState.UP_TO_DATE) {
    derivation.dependenciesState = lowestNewObservingDerivationState;
    derivation.onBecomeStale();
  }
}
```

`addObserver` is from

[src/core/observable.ts](https://github.com/mobxjs/mobx/blob/5.13.0/src/core/observable.ts)

`observable` here is those observalbes, which are `ObservalbeValue` and `Atom` that linked with current `reaction` just now.

`node` is current reaction.

so we assign current reaction as `observers` of those observables

```ts
export function addObserver(observable: IObservable, node: IDerivation) {
  // invariant(node.dependenciesState !== -1, "INTERNAL ERROR, can add only dependenciesState !== -1");
  // invariant(observable._observers.indexOf(node) === -1, "INTERNAL ERROR add already added node");
  // invariantObservers(observable);

  observable.observers.add(node);
  if (observable.lowestObserverState > node.dependenciesState)
    observable.lowestObserverState = node.dependenciesState;

  // invariantObservers(observable);
  // invariant(observable._observers.indexOf(node) !== -1, "INTERNAL ERROR didn't add node");
}
```

By then, we finished this statement

```ts
mobx.autorun((reaction) =>
  console.log(demoStoreInstance.observedArray.join(","))
);
```

and the creation of `mobx.reaction` is similar to that of `mobx.autorun`.

Then `demoStoreInstance.observedArray[1] = "b1";`
The same as just now, proxy `demoStoreInstance.observedArray` get called, then
(src/types/observablearray.ts#L437)[https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observablearray.ts#L437]

1. `index` is the index we are accessing, 1
2. `newValue` is `"b1"`

```ts
set(index: number, newValue: any) {
  const adm: ObservableArrayAdministration = this[$mobx];
  const values = adm.values;
  if (index < values.length) {
    // update at index in range
    checkIfStateModificationsAreAllowed(adm.atom);
    const oldValue = values[index];
    if (hasInterceptors(adm)) {
      const change = interceptChange<IArrayWillChange<any>>(adm as any, {
        type: "update",
        object: adm.proxy as any, // since "this" is the real array we need to pass its proxy
        index,
        newValue,
      });
      if (!change) return;
      newValue = change.newValue;
    }
    newValue = adm.enhancer(newValue, oldValue);
    const changed = newValue !== oldValue;
    if (changed) {
      values[index] = newValue;
      adm.notifyArrayChildUpdate(index, newValue, oldValue);
    }
  } else if (index === values.length) {
    // add a new item
    adm.spliceWithArray(index, 0, [newValue]);
  } else {
    // out of bounds
    throw new Error(
      `[mobx.array] Index out of bounds, ${index} is larger than ${values.length}`
    );
  }
}
```

in `adm.notifyArrayChildUpdate(index, newValue, oldValue);`, `this.atom.reportChanged();` would get called, and then the following function

[src/core/observable.ts#L180](https://github.com/mobxjs/mobx/blob/5.13.0/src/core/observable.ts#L180)

here the `observable` is the `Atom` notifier of the `reaction` that linked with it just now,

so `observable.observers` is the array that contains the `reaction1` and `reaction2` we created.

```ts
export function propagateChanged(observable: IObservable) {
  // invariantLOS(observable, "changed start");
  if (observable.lowestObserverState === IDerivationState.STALE) return;
  observable.lowestObserverState = IDerivationState.STALE;

  // Ideally we use for..of here, but the downcompiled version is really slow...
  observable.observers.forEach((d) => {
    if (d.dependenciesState === IDerivationState.UP_TO_DATE) {
      if (d.isTracing !== TraceMode.NONE) {
        logTraceInfo(d, observable);
      }
      d.onBecomeStale();
    }
    d.dependenciesState = IDerivationState.STALE;
  });
  // invariantLOS(observable, "changed end");
}
```

the `onBecomeStale` of `Reaction` would call registered function again.

```ts
onBecomeStale() {
  this.schedule();
}
```
