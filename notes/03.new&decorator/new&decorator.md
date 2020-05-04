# Mobx Source Code Reading Note 3

## new & decorator

### Notice

To make this note more clear to get understood, noncritical codes in some functions may be truncated. Complete codes can be found via those hyperlinks.

### Demo

```ts
class DemoStore {
  @mobx.observable
  observedArray = ["foo", "bar", "hoo", "hee"];
}
const demoStoreInstance = new DemoStore();
console.log(demoStoreInstance.observedArray);
```

#### What does new do?

```ts
function New(fn: Function) {
  // this is actually not the complete implementation of new,
  // but this is enough for understanding what does new do
  const instance = { __proto__: fn.prototype };
  fn.apply(instance, Array.prototype.slice.call(arguments, 1));
  return instance;
}

const demoStoreInstance1 = New(DemoStore);
console.log(demoStoreInstance1 instanceof DemoStore); // result: true
```

When we declare `class DemoStore`, `property descriptor` of `observedArray` property in `DemoStore.prototype` is defined. [index.js#L12](./index.js#L12).
Then when we `new` a instance of `DemoStore`, we [create](./index.js#L22) a `instance` and the `fn` in `fn.apply()` is the `function DemoStore` in [index.js#L9](./index.js#L9).
So basically, `instance.observedArray = ["foo", "bar", "hoo", "hee"];` executed, which means the property descriptor of `observedArray` in `DemoStore.prototype` gets called.

Below is what this property descripor is

[src/utils/decorators.ts#L32](https://github.com/mobxjs/mobx/blob/5.13.0/src/utils/decorators.ts#L32)

```ts
function createPropertyInitializerDescriptor(
  prop: string,
  enumerable: boolean
): PropertyDescriptor {
  const cache = enumerable
    ? enumerableDescriptorCache
    : nonEnumerableDescriptorCache;
  return (
    cache[prop] ||
    (cache[prop] = {
      configurable: true,
      enumerable: enumerable,
      get() {
        initializeInstance(this);
        return this[prop];
      },
      set(value) {
        initializeInstance(this);
        this[prop] = value;
      },
    })
  );
}
```

when we `New(DemoStore)`, initial value would be assigned to `instance.observedArray` (index.js#L10)[./index.js#L10], `set` above would get called.

`this` in `initializeInstance(this)` would be the `instance` (index.js#L22)[./index.js#L22], `demoStoreInstance` (index.js#L17)[./index.js#L17] or `demoStoreInstance1` (index.js#L26)[./index.js#L26], which are the same in this context.

`demoStoreInstance` would be referred to below .

[src/utils/decorators.ts#L55](https://github.com/mobxjs/mobx/blob/5.13.0/src/utils/decorators.ts#L55)

```ts
export function initializeInstance(target: DecoratorTarget) {
  if (target[mobxDidRunLazyInitializersSymbol] === true) return;
  const decorators = target[mobxPendingDecorators];
  if (decorators) {
    addHiddenProp(target, mobxDidRunLazyInitializersSymbol, true);
    for (let key in decorators) {
      const d = decorators[key];
      d.propertyCreator(
        target,
        d.prop,
        d.descriptor,
        d.decoratorTarget,
        d.decoratorArguments
      );
    }
  }
}
```

arguments passed to `propertyCreator` function as follow:

1. `target` is `demoStoreInstance`
2. `prop` is `"observedArray"`
3. `descriptor` is `undefined`
4. `decoratorTarget` is `DemoStore.prototype`
5. `decoratorArguments` is `[]`

and `propertyCreator` is

[src/api/observabledecorator.ts#L20](https://github.com/mobxjs/mobx/blob/5.13.0/src/api/observabledecorator.ts#L20)

```ts
(
  target: any,
  propertyName: PropertyKey,
  descriptor: BabelDescriptor | undefined,
  _decoratorTarget,
  decoratorArgs: any[]
) => {
  const initialValue = descriptor
    ? descriptor.initializer
      ? descriptor.initializer.call(target)
      : descriptor.value
    : undefined;
  asObservableObject(target).addObservableProp(
    propertyName,
    initialValue,
    enhancer
  );
};
```

[src/types/observableobject.ts#L328](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observableobject.ts#L328)

```ts
export function asObservableObject(
  target: any,
  name: PropertyKey = "",
  defaultEnhancer: IEnhancer<any> = deepEnhancer
): ObservableObjectAdministration {
  if (Object.prototype.hasOwnProperty.call(target, $mobx)) return target[$mobx];

  process.env.NODE_ENV !== "production" &&
    invariant(
      Object.isExtensible(target),
      "Cannot make the designated object observable; it is not extensible"
    );
  if (!isPlainObject(target))
    name = (target.constructor.name || "ObservableObject") + "@" + getNextId();
  if (!name) name = "ObservableObject@" + getNextId();

  const adm = new ObservableObjectAdministration(
    target,
    new Map(),
    stringifyKey(name),
    defaultEnhancer
  );
  addHiddenProp(target, $mobx, adm);
  return adm;
}
```

create an instance of `ObservableObjectAdministration` under `$mobx` property of `demoStoreInstance`

[src/types/observableobject.ts#L160](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observableobject.ts#L160)

```ts
export class ObservableObjectAdministration
  implements IInterceptable<IObjectWillChange>, IListenable {
  keysAtom: IAtom;
  changeListeners;
  interceptors;
  private proxy: any;
  private pendingKeys: undefined | Map<PropertyKey, ObservableValue<boolean>>;

  constructor(
    public target: any,
    public values = new Map<
      PropertyKey,
      ObservableValue<any> | ComputedValue<any>
    >(),
    public name: string,
    public defaultEnhancer: IEnhancer<any>
  ) {
    this.keysAtom = new Atom(name + ".keys");
  }

  addObservableProp(
    propName: PropertyKey,
    newValue,
    enhancer: IEnhancer<any> = this.defaultEnhancer
  ) {
    const { target } = this;
    assertPropertyConfigurable(target, propName);

    if (hasInterceptors(this)) {
      const change = interceptChange<IObjectWillChange>(this, {
        object: this.proxy || target,
        name: propName,
        type: "add",
        newValue,
      });
      if (!change) return;
      newValue = (change as any).newValue;
    }
    const observable = new ObservableValue(
      newValue,
      enhancer,
      `${this.name}.${stringifyKey(propName)}`,
      false
    );
    this.values.set(propName, observable);
    newValue = (observable as any).value; // observableValue might have changed it

    Object.defineProperty(
      target,
      propName,
      generateObservablePropConfig(propName)
    );
    this.notifyPropertyAddition(propName, newValue);
  }
}
```

`ObservableValue` applys `enhancer` to `newValue`, creating a `Observable`, which is the same with that in Note 1.

[src/types/observableobject.ts#L357](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observableobject.ts#L357)

```ts
export function generateObservablePropConfig(propName) {
  return (
    observablePropertyConfigs[propName] ||
    (observablePropertyConfigs[propName] = {
      configurable: true,
      enumerable: true,
      get() {
        return this[$mobx].read(propName);
      },
      set(v) {
        this[$mobx].write(propName, v);
      },
    })
  );
}
```

So far, both the get and set action done to `observedArray` would be handled by `demoStoreInstance[$mobx]`

[src/types/observableobject.ts#L93](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/observableobject.ts#L93)

```ts
export class ObservableObjectAdministration
    implements IInterceptable<IObjectWillChange>, IListenable {
    keysAtom: IAtom
    changeListeners
    interceptors
    private proxy: any
    private pendingKeys: undefined | Map<PropertyKey, ObservableValue<boolean>>

    constructor(
        public target: any,
        public values = new Map<PropertyKey, ObservableValue<any> | ComputedValue<any>>(),
        public name: string,
        public defaultEnhancer: IEnhancer<any>
    ) {
        this.keysAtom = new Atom(name + ".keys")
    }

    read(key: PropertyKey) {
        return this.values.get(key)!.get()
    }

    write(key: PropertyKey, newValue) {
        const instance = this.target
        const observable = this.values.get(key)
        if (observable instanceof ComputedValue) {
            observable.set(newValue)
            return
        }

        // intercept
        if (hasInterceptors(this)) {
            const change = interceptChange<IObjectWillChange>(this, {
                type: "update",
                object: this.proxy || instance,
                name: key,
                newValue
            })
            if (!change) return
            newValue = (change as any).newValue
        }
        newValue = (observable as any).prepareNewValue(newValue)

        // notify spy & observers
        if (newValue !== globalState.UNCHANGED) {
            const notify = hasListeners(this)
            const notifySpy = isSpyEnabled()
            const change =
                notify || notifySpy
                    ? {
                          type: "update",
                          object: this.proxy || instance,
                          oldValue: (observable as any).value,
                          name: key,
                          newValue
                      }
                    : null

            if (notifySpy && process.env.NODE_ENV !== "production")
                spyReportStart({ ...change, name: this.name, key })
            ;(observable as ObservableValue<any>).setNewValue(newValue)
            if (notify) notifyListeners(this, change)
            if (notifySpy && process.env.NODE_ENV !== "production") spyReportEnd()
        }
    }
```

<!--
When get read, the value under `demoStoreInstance[$mobx].values` would be returned, and when get set, observers would be notified by calling `notifyListener(this, change)`

here `this` is `demoStoreInstance[$mobx]`
and `change` is a object that contains new value

```ts
{
  type: "update",
  object: this.proxy || instance,
  oldValue: (observable as any).value,
  name: key,
  newValue,
}
```

[src/types/listen-utils.ts#L21](https://github.com/mobxjs/mobx/blob/5.13.0/src/types/listen-utils.ts#L21)

```ts
export function notifyListeners<T>(listenable: IListenable, change: T) {
  const prevU = untrackedStart();
  let listeners = listenable.changeListeners;
  if (!listeners) return;
  listeners = listeners.slice();
  for (let i = 0, l = listeners.length; i < l; i++) {
    listeners[i](change);
  }
  untrackedEnd(prevU);
}
```

So far we haven't set any listener for `demoStoreInstance.observedArray`, but it looks like they will be in `listenable.changeListeners` which is `demoStoreInstance[$mobx].changeListeners` -->
